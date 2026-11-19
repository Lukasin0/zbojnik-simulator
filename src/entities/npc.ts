import * as THREE from 'three';
import type { CharacterLook, Pose } from '@/components/character-model';
import type { GroundProvider } from '@/components/physics-body';
import { BRAWL_OVERRIDES, BRAWL_TUNING as B } from '@/config/constants';
import type { HitSource } from '@/systems/combat-system';
import type { Faction, NpcId } from '@/types/game-types';
import { Actor } from './actor';
import { MeleeBrain } from './melee-brain';

/** How a villager feels about the captain right now. */
export type Temper = 'calm' | 'warned' | 'hostile' | 'down';
export type TemperEvent = 'warn' | 'fight' | 'down' | 'calm' | 'up' | 'help';

export interface NpcFightContext {
  /** the captain – the only one who provokes villagers */
  player: Actor;
  /** alerted drábi / pandúri nearby (wandering zbojníci rush to help against them) */
  foes: readonly Actor[];
  onStrike(npc: Npc, target: Actor): void;
  onEvent(npc: Npc, ev: TemperEvent): void;
}

const tmpV = { x: 0, z: 0 };

/** Villagers with a home walk to their door in the evening and come out again in the morning. */
export interface SleepSchedule {
  /** spot right in front of the house door */
  door: THREE.Vector3;
  bedtime: number;
  wakeup: number;
}

type Routine = 'out' | 'goingHome' | 'asleep' | 'woken';

function isBedtime(hour: number, s: SleepSchedule): boolean {
  return s.bedtime > s.wakeup ? hour >= s.bedtime || hour < s.wakeup : hour >= s.bedtime && hour < s.wakeup;
}

/** Villager / quest giver; turns to face the captain when near, keeps a day & night routine. */
export class Npc extends Actor {
  readonly faction: Faction;
  temper: Temper = 'calm';
  /** > 0 → still angry, refuses to talk */
  grudge = 0;
  private temperTimer = 0;
  private provokedByPlayer = false;
  private pendingEvent: TemperEvent | null = null;
  private foe: Actor | null = null;
  private readonly brain: MeleeBrain;
  private readonly home = new THREE.Vector3();
  private readonly homeYaw: number;
  private wanderTimer = Math.random() * 5;
  private readonly wanderGoal = new THREE.Vector3();
  private schedule: SleepSchedule | null = null;
  private routine: Routine = 'out';
  private routineTimer = 0;
  /** Fixed round (the výberca walking from stall to stall); null = wander/stand. */
  private route: THREE.Vector3[] | null = null;
  private routeIndex = 0;
  private routePause = 0;
  /** Called whenever the round reaches a stop. */
  onRouteStop: ((npc: Npc, index: number) => void) | null = null;
  /** Stops the round (e.g. the robbed výberca stands and shouts). */
  halted = false;

  constructor(
    readonly id: NpcId,
    readonly displayName: string,
    look: CharacterLook,
    parent: THREE.Object3D,
    x: number,
    z: number,
    yaw: number,
    world: GroundProvider,
    readonly basePose: Pose = 'normal',
    readonly wanderRadius = 0,
    faction: Faction = 'civil',
  ) {
    const o = BRAWL_OVERRIDES[id] ?? {};
    super(look, parent, o.hp ?? B.hp);
    this.faction = faction;
    this.brain = new MeleeBrain({
      damage: o.damage ?? B.damage,
      speed: o.speed ?? B.speed,
      range: B.range,
      windup: B.windup,
      recover: B.recover,
    });
    this.body.radius = 0.4;
    this.teleport(x, z, world);
    this.home.copy(this.position);
    this.wanderGoal.copy(this.home);
    this.facing = yaw;
    this.homeYaw = yaw;
    this.pose = basePose;
    this.body.collides = basePose === 'normal';
  }

  /** Give the villager a house to sleep in (hours may wrap past midnight). */
  sleepsAt(door: THREE.Vector3, bedtime: number, wakeup: number): this {
    this.schedule = { door, bedtime, wakeup };
    return this;
  }

  /** Walk a loop of stops, pausing at each one. */
  walksRoute(points: THREE.Vector3[]): this {
    this.route = points;
    return this;
  }

  get asleep(): boolean {
    return this.routine === 'asleep';
  }

  get door(): THREE.Vector3 | null {
    return this.schedule?.door ?? null;
  }

  override isAlive(): boolean {
    return this.temper !== 'down' && this.routine !== 'asleep';
  }

  /** Damage of one of this villager's blows. */
  get strikeDamage(): number {
    return this.brain.stats.damage;
  }

  /** In a fight with the captain (companions join in). */
  get alerted(): boolean {
    return this.temper === 'hostile' && this.provokedByPlayer;
  }

  /** Willing to talk / trade. */
  get friendly(): boolean {
    return (this.temper === 'calm' || this.temper === 'warned') && this.grudge <= 0;
  }

  receiveHit(damage: number, from: THREE.Vector3, source: HitSource, force = 3.5): void {
    if (!this.isAlive()) return;
    this.cancelEmote();
    const byCaptain = source !== 'enemy';
    this.standUp();
    if (byCaptain && this.temper === 'calm') {
      // first blow: a warning – and a bruise
      this.temper = 'warned';
      this.temperTimer = B.warnTime;
      this.hp = Math.max(1, this.hp - damage * B.warnDamage);
      this.knockback(from, 2);
      this.facing = Math.atan2(from.x - this.position.x, from.z - this.position.z);
      this.pendingEvent = 'warn';
      return;
    }
    if (byCaptain) {
      if (this.temper !== 'hostile' || !this.provokedByPlayer) this.pendingEvent = 'fight';
      this.temper = 'hostile';
      this.provokedByPlayer = true;
    }
    this.hp = Math.max(0, this.hp - damage);
    this.knockback(from, force);
    this.brain.stagger(0.25 + force * 0.04);
    this.attackT = -1;
    if (this.hp <= 0) {
      this.temper = 'down';
      this.temperTimer = B.knockoutTime;
      this.pose = 'dead';
      this.pendingEvent = 'down';
    }
  }

  /** Sitting / working villagers jump to their feet when it comes to blows. */
  private standUp(): void {
    if (this.pose !== 'normal' && this.pose !== 'dead') this.pose = 'normal';
    this.body.collides = true;
  }

  private settle(world: GroundProvider): void {
    this.temper = 'calm';
    this.provokedByPlayer = false;
    this.foe = null;
    this.brain.reset();
    this.attackT = -1;
    this.pose = this.basePose;
    this.body.collides = this.basePose === 'normal';
    // sitters go straight back to their bench
    if (this.basePose !== 'normal') this.teleport(this.home.x, this.home.z, world);
  }

  /** Fight / knock-out / warning logic. Returns true when it took over this tick. */
  private updateTemper(dt: number, world: GroundProvider, ctx: NpcFightContext | undefined): boolean {
    if (this.grudge > 0) this.grudge -= dt;
    if (this.pendingEvent && ctx) {
      ctx.onEvent(this, this.pendingEvent);
      this.pendingEvent = null;
    }
    // wandering zbojníci rush at drábi who are fighting nearby
    if (ctx && this.faction === 'band' && this.temper !== 'down' && !this.provokedByPlayer) {
      let best: Actor | null = null;
      let bestD = 22;
      for (const f of ctx.foes) {
        const d = f.position.distanceTo(this.position);
        if (f.isAlive() && d < bestD) {
          bestD = d;
          best = f;
        }
      }
      if (best && this.temper !== 'hostile') {
        this.temper = 'hostile';
        this.standUp();
        ctx.onEvent(this, 'help');
      }
      if (this.temper === 'hostile') this.foe = best;
    }
    switch (this.temper) {
      case 'calm':
        return false;
      case 'warned':
        this.temperTimer -= dt;
        if (this.temperTimer <= 0) this.settle(world);
        return false;
      case 'down':
        this.temperTimer -= dt;
        this.body.steer(0, 0, 6, dt);
        this.body.integrate(dt, world);
        if (this.temperTimer <= 0) {
          this.hp = this.maxHp;
          this.grudge = B.grudgeTime;
          this.settle(world);
          ctx?.onEvent(this, 'up');
        }
        return true;
      case 'hostile': {
        if (this.provokedByPlayer && ctx) this.foe = ctx.player;
        const foe = this.foe;
        if (!ctx || !foe || !foe.isAlive() || foe.position.distanceTo(this.position) > B.giveUpDistance) {
          if (this.provokedByPlayer) {
            this.grudge = B.grudgeTime;
            ctx?.onEvent(this, 'calm');
          }
          this.hp = Math.max(this.hp, this.maxHp * 0.6);
          this.settle(world);
          return false;
        }
        this.brain.tick(this, foe, dt, () => ctx.onStrike(this, foe), tmpV);
        this.attackT = this.brain.attackT;
        this.body.steer(tmpV.x, tmpV.z, this.brain.phase === 'stagger' ? 2 : 9, dt);
        this.body.integrate(dt, world);
        return true;
      }
    }
  }

  /** Somebody bangs on the door at night – the villager comes out for a while, grumbling. */
  knock(world: GroundProvider, from: THREE.Vector3): void {
    if (this.routine !== 'asleep') return;
    this.appear(world);
    this.facing = Math.atan2(from.x - this.position.x, from.z - this.position.z);
    this.routine = 'woken';
    this.routineTimer = 40;
  }

  update(dt: number, world: GroundProvider, playerPos: THREE.Vector3, hour = 12, fight?: NpcFightContext): void {
    this.beginTick();
    if (this.updateTemper(dt, world, fight)) return;
    const s = this.schedule;
    if (s) {
      const bed = isBedtime(hour, s);
      if (this.routine === 'asleep') {
        if (bed) return;
        this.appear(world);
        this.routine = 'out';
      } else if (this.routine === 'woken') {
        this.routineTimer -= dt;
        if (this.routineTimer <= 0 && playerPos.distanceTo(this.position) > 5) this.routine = bed ? 'goingHome' : 'out';
      } else if (bed !== (this.routine === 'goingHome')) {
        this.routine = bed ? 'goingHome' : 'out';
        this.routineTimer = 0;
      }
    }
    const wasEmoting = this.emoting;
    this.tickEmote(dt);
    if (wasEmoting && !this.emoting) this.pose = this.basePose;
    const near = playerPos.distanceTo(this.position) < 6;
    let vx = 0;
    let vz = 0;
    const walkTo = (x: number, z: number, speed: number): number => {
      const dx = x - this.position.x;
      const dz = z - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.5) {
        vx = (dx / d) * speed;
        vz = (dz / d) * speed;
        this.turnTowards(Math.atan2(dx, dz), 4, dt);
      }
      return d;
    };
    if (s && this.routine === 'goingHome') {
      this.routineTimer += dt;
      const d = walkTo(s.door.x, s.door.z, 1.6);
      // nobody watches – or the way is blocked: just be home already
      if (d < 0.8 || this.routineTimer > 40 || playerPos.distanceTo(this.position) > 60) this.goInside(world);
    } else if (this.route && this.routine === 'out') {
      // busy people do not stop for the captain – which is what makes them easy to rob
      if (!this.halted) this.followRoute(this.route, dt, walkTo);
    } else if (near && this.basePose === 'normal') {
      this.faceTowards(playerPos, 5, dt);
    } else if (this.routine === 'woken') {
      this.turnTowards(this.homeYaw, 2, dt);
    } else if (this.wanderRadius > 0) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 4 + Math.random() * 6;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * this.wanderRadius;
        this.wanderGoal.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
      }
      walkTo(this.wanderGoal.x, this.wanderGoal.z, 1.3);
    } else if (this.basePose === 'normal' && walkTo(this.home.x, this.home.z, 1.4) <= 0.5) {
      this.turnTowards(this.homeYaw, 2, dt);
    }
    if (this.basePose === 'normal') {
      this.body.steer(vx, vz, 6, dt);
      this.body.integrate(dt, world);
    }
  }

  private followRoute(route: THREE.Vector3[], dt: number, walkTo: (x: number, z: number, speed: number) => number): void {
    if (this.routePause > 0) {
      this.routePause -= dt;
      return;
    }
    const stop = route[this.routeIndex % route.length];
    if (walkTo(stop.x, stop.z, 1.2) < 0.6) {
      this.routePause = 4 + Math.random() * 2;
      this.onRouteStop?.(this, this.routeIndex % route.length);
      this.routeIndex++;
    }
  }

  private goInside(world: GroundProvider): void {
    if (!this.schedule) return;
    this.routine = 'asleep';
    this.cancelEmote();
    this.teleport(this.schedule.door.x, this.schedule.door.z, world);
    this.model.setVisible(false);
    this.body.collides = false;
  }

  private appear(world: GroundProvider): void {
    if (!this.schedule) return;
    this.teleport(this.schedule.door.x, this.schedule.door.z, world);
    this.model.setVisible(true);
    this.body.collides = this.basePose === 'normal';
  }
}
