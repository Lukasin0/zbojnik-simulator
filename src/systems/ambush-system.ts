import * as THREE from 'three';
import { PANDUR_TUNING, ROAD_END_X, ROAD_START_X } from '@/config/constants';
import { Coach } from '@/entities/coach';
import { Pandur } from '@/entities/enemy';
import type { Actor } from '@/entities/actor';
import type { World } from '@/world/world';
import { Npc } from '@/entities/npc';
import { ZEMAN } from '@/entities/looks';

export interface EncounterOptions {
  startX: number;
  dir: 1 | -1;
  loot: number;
  noble: string;
  story: boolean;
  escorts: number;
}

export interface AmbushContext {
  zbojnici: Actor[];
  /** x of the fallen tree on the road, or null when the road is free. */
  logX: number | null;
  onStrike(enemy: Pandur, target: Actor): void;
  onPandurDown(enemy: Pandur): void;
  onAlert(): void;
  onDefeated(): void;
  onEscaped(story: boolean): void;
  bark(target: THREE.Object3D, text: string, seconds?: number): void;
}

const ESCORT_SLOTS: [number, number][] = [
  [3.2, -1.9],
  [3.2, 1.9],
  [-3.6, 0],
  [-3.6, 1.6],
];

const tmp = new THREE.Vector3();

/** Spawns and runs a coach encounter: escort, roadblock, fujara lullaby, fight, loot. */
export class AmbushSystem {
  coach: Coach | null = null;
  escorts: Pandur[] = [];
  noble: Npc | null = null;
  alerted = false;
  looted = false;
  loot = 0;
  nobleName = '';
  story = false;
  private lulled = false;
  private atLog = false;
  private logTimer = 0;
  private defeatedReported = false;
  private leaveTimer = 0;

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly world: World,
  ) {}

  get active(): boolean {
    return this.coach !== null;
  }

  get combatActive(): boolean {
    return this.alerted && this.escorts.some((e) => e.isAlive());
  }

  get defeated(): boolean {
    return this.active && this.escorts.every((e) => !e.isAlive());
  }

  get lootable(): boolean {
    return this.defeated && !this.looted;
  }

  spawn(o: EncounterOptions): void {
    this.despawn();
    const ground = (x: number, z: number): number => this.world.groundHeight(x, z);
    this.coach = new Coach(this.parent, o.startX, o.dir, ground);
    this.loot = o.loot;
    this.nobleName = o.noble;
    this.story = o.story;
    this.alerted = false;
    this.looted = false;
    this.lulled = false;
    this.atLog = false;
    this.logTimer = 0;
    this.defeatedReported = false;
    this.leaveTimer = 0;
    for (let i = 0; i < o.escorts; i++) {
      const p = new Pandur(this.parent);
      const [a, s] = ESCORT_SLOTS[i % ESCORT_SLOTS.length];
      this.coach.offsetPoint(a, s, tmp);
      p.teleport(tmp.x, tmp.z, this.world);
      p.facing = this.coach.facing;
      this.escorts.push(p);
    }
  }

  despawn(): void {
    this.coach?.dispose();
    this.coach = null;
    for (const e of this.escorts) e.dispose();
    this.escorts = [];
    this.noble?.dispose();
    this.noble = null;
  }

  /** Fujara lullaby: escorts that are not yet alerted doze off (caller checks hearing range). */
  lull(): boolean {
    if (!this.coach || this.alerted) return false;
    this.lulled = true;
    if (this.atLog || this.coach.state !== 'driving') this.escorts.forEach((e) => e.fallAsleep());
    return true;
  }

  alertAll(ctx: AmbushContext): void {
    if (this.alerted) return;
    this.alerted = true;
    this.escorts.forEach((e) => e.alert());
    if (this.coach && this.coach.state === 'driving') this.coach.state = 'stopped';
    const loud = this.escorts.find((e) => e.isAlive());
    if (loud) ctx.bark(loud.model.root, 'Zbojníci! Do zbrane!', 2.5);
    ctx.onAlert();
  }

  /** The nobleman steps out of the coach to be relieved of his ducats. */
  showNoble(): Npc | null {
    if (!this.coach || this.noble) return this.noble;
    this.coach.offsetPoint(0, 2.2, tmp);
    this.noble = new Npc('sedliak1', this.nobleName, ZEMAN, this.parent, tmp.x, tmp.z, this.coach.facing + Math.PI / 2, this.world);
    return this.noble;
  }

  markLooted(): void {
    this.looted = true;
    if (this.coach) this.coach.state = 'looted';
  }

  update(dt: number, ctx: AmbushContext): void {
    const coach = this.coach;
    if (!coach) return;
    const ground = (x: number, z: number): number => this.world.groundHeight(x, z);

    // roadblock
    let blocked = false;
    if (ctx.logX !== null) {
      const ahead = coach.dir * (ctx.logX - coach.x);
      blocked = ahead > 0 && ahead < 9;
    }
    if (blocked && !this.atLog && coach.state === 'driving') {
      this.atLog = true;
      coach.state = 'stopped';
      const first = this.escorts[0];
      if (first) ctx.bark(first.model.root, 'Čo to má byť?! Strom na ceste!', 3);
    }
    coach.update(dt, !this.alerted && !blocked, ground);

    // escort goals
    this.escorts.forEach((e, i) => {
      if (e.alerted || e.state === 'dead' || e.state === 'sleepy') return;
      if (this.atLog && ctx.logX !== null) {
        e.state = 'idle';
        const lz = this.world.roadZ(ctx.logX);
        e.goal.set(ctx.logX - coach.dir * 2.2, 0, lz - 2 + i * 1.6);
        e.goalSpeed = 2.2;
      } else {
        const [a, s] = ESCORT_SLOTS[i % ESCORT_SLOTS.length];
        coach.offsetPoint(a, s, e.goal);
        e.goalSpeed = coach.speed;
      }
    });
    if (this.atLog && !this.alerted) {
      this.logTimer += dt;
      if (this.lulled && this.logTimer > 3) {
        for (const e of this.escorts) {
          if (e.state !== 'sleepy' && e.isAlive()) {
            e.fallAsleep();
            ctx.bark(e.model.root, 'Zzz… tá fujara… zzz', 3);
          }
        }
      }
    }

    // detection
    if (!this.alerted) {
      outer: for (const e of this.escorts) {
        if (!e.isAlive()) continue;
        if (e.hp < e.maxHp) {
          this.alertAll(ctx);
          break;
        }
        const radius = e.state === 'sleepy' ? PANDUR_TUNING.sleepyAlertRadius : PANDUR_TUNING.alertRadius;
        for (const z of ctx.zbojnici) {
          if (z.isAlive() && z.position.distanceTo(e.position) < radius) {
            this.alertAll(ctx);
            break outer;
          }
        }
      }
    }

    const targets = ctx.zbojnici.filter((z) => z.isAlive());
    for (const e of this.escorts) {
      e.update(dt, {
        world: this.world,
        targets,
        onStrike: (en, t) => ctx.onStrike(en, t),
        onDeath: (en) => ctx.onPandurDown(en),
        onWake: (en) => ctx.bark(en.model.root, 'Hm?! Čo… kto…?!', 2),
      });
    }
    this.noble?.update(dt, this.world, ctx.zbojnici[0]?.position ?? coach.position);

    if (this.alerted && this.defeated && !this.defeatedReported) {
      this.defeatedReported = true;
      ctx.onDefeated();
    }

    // escaped along the road
    if (coach.x > ROAD_END_X || coach.x < ROAD_START_X) {
      const story = this.story;
      this.despawn();
      ctx.onEscaped(story);
      return;
    }

    // looted coach leaves once the družina walks away
    if (this.looted) {
      const player = ctx.zbojnici[0];
      if (player && player.position.distanceTo(coach.position) > 45) this.leaveTimer += dt;
      if (this.leaveTimer > 4) this.despawn();
    }
  }

  render(alpha: number, frameDt: number, time: number): void {
    this.coach?.render(alpha, time);
    for (const e of this.escorts) e.render(alpha, frameDt);
    this.noble?.render(alpha, frameDt);
  }
}
