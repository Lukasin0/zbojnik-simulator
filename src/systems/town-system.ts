import * as THREE from 'three';
import { LOC } from '@/config/constants';
import type { Actor } from '@/entities/actor';
import { Pandur } from '@/entities/enemy';
import type { Npc } from '@/entities/npc';
import type { World } from '@/world/world';
import { GUARD_DISGUISED, GUARD_SUSPECT, PANDUR_HIT, TOWN_ALARM, VYBERCA_ROBBED, line } from '@/story/lines';

export interface TownContext {
  /** Player first, then companions. */
  zbojnici: Actor[];
  disguised: boolean;
  /** The captain swung or fired this tick. */
  violent: boolean;
  onStrike(enemy: Pandur, target: Actor): void;
  onPandurDown(enemy: Pandur): void;
  onAlarm(): void;
  onCalm(): void;
  bark(target: THREE.Object3D, text: string, seconds?: number): void;
  /** 0..1 – how suspicious the guards are (null = nobody is looking). */
  setSuspicion(v: number | null): void;
}

/** Radius of Liptovský Mikuláš around the square – guards only care inside it. */
export const TOWN_RADIUS = 58;
const SEE_RADIUS = 12;
const CALM_DISTANCE = 45;

const tmp = new THREE.Vector3();

/**
 * Town guards of Liptovský Mikuláš: they stand at their posts, grow suspicious of an
 * undisguised zbojník, raise the alarm on violence or theft and give up once he is gone.
 */
export class TownSystem {
  guards: Pandur[] = [];
  alarm = false;
  /** The výberca the escort guard follows (set by the game). */
  collector: Npc | null = null;
  /** Seconds until the výberca notices his missing purse; -1 = nothing stolen. */
  theftTimer = -1;
  private readonly posts: THREE.Vector3[];
  private suspicion = 0;
  private sawPlayer = false;
  private calmTimer = 0;
  private greetCd = 0;
  private readonly hitsSeen = new Map<Pandur, number>();

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly world: World,
  ) {
    const m = LOC.mikulas;
    // south entrance ×2, radnica, and the výberca's bodyguard (post updated every tick)
    this.posts = [
      world.ground(m.x - 8, m.z + 27),
      world.ground(m.x + 8, m.z + 27),
      world.ground(m.x - 6, m.z - 25),
      world.ground(m.x, m.z),
    ];
    this.spawnGuards();
  }

  /** New game / load: calm town, fresh guards. */
  reset(): void {
    this.alarm = false;
    this.theftTimer = -1;
    this.suspicion = 0;
    this.sawPlayer = false;
    this.calmTimer = 0;
    if (this.collector) this.collector.halted = false;
    this.spawnGuards();
  }

  get combatActive(): boolean {
    return this.alarm && this.guards.some((g) => g.isAlive());
  }

  static inTown(p: THREE.Vector3): boolean {
    return Math.hypot(p.x - LOC.mikulas.x, p.z - LOC.mikulas.z) < TOWN_RADIUS;
  }

  private spawnGuards(): void {
    for (const g of this.guards) g.dispose();
    this.guards = this.posts.map((post) => {
      const g = new Pandur(this.parent);
      g.teleport(post.x, post.z, this.world);
      g.state = 'idle';
      g.goal.copy(post);
      g.goalSpeed = 1.6;
      g.facing = Math.PI;
      return g;
    });
    this.hitsSeen.clear();
  }

  raiseAlarm(ctx: TownContext): void {
    if (this.alarm) return;
    this.alarm = true;
    this.suspicion = 0;
    this.calmTimer = 0;
    if (this.collector) this.collector.halted = true;
    for (const g of this.guards) g.alert();
    const loud = this.guards.find((g) => g.isAlive());
    if (loud) ctx.bark(loud.model.root, line(TOWN_ALARM), 3);
    ctx.setSuspicion(null);
    ctx.onAlarm();
  }

  update(dt: number, ctx: TownContext): void {
    const player = ctx.zbojnici[0];
    const inTown = TownSystem.inTown(player.position);
    this.greetCd = Math.max(0, this.greetCd - dt);

    // the escort guard keeps two steps behind the výberca's left shoulder
    const c = this.collector;
    if (c && c.model.root.visible) {
      const s = Math.sin(c.facing);
      const k = Math.cos(c.facing);
      this.posts[3].set(c.position.x - s * 1.6 + k * 1.3, c.position.y, c.position.z - k * 1.6 - s * 1.3);
    }

    // the stolen purse is missed at last
    if (this.theftTimer > 0) {
      this.theftTimer -= dt;
      if (this.theftTimer <= 0 && c) {
        ctx.bark(c.model.root, line(VYBERCA_ROBBED), 4);
        if (inTown) this.raiseAlarm(ctx);
      }
    }

    if (!this.alarm) {
      let seen = false;
      for (const g of this.guards) {
        if (!g.isAlive()) continue;
        if (g.hp < g.maxHp) {
          this.raiseAlarm(ctx);
          break;
        }
        const d = g.position.distanceTo(player.position);
        if (ctx.violent && d < 18) {
          this.raiseAlarm(ctx);
          break;
        }
        if (!inTown || d > SEE_RADIUS) continue;
        if (ctx.disguised) {
          if (d < 3.5 && this.greetCd <= 0 && Math.random() < 0.01) {
            this.greetCd = 25;
            ctx.bark(g.model.root, line(GUARD_DISGUISED), 3);
          }
          continue;
        }
        seen = true;
        g.faceTowards(player.position, 6, dt);
        if (!this.sawPlayer) {
          this.sawPlayer = true;
          ctx.bark(g.model.root, line(GUARD_SUSPECT), 3);
        }
      }
      if (!this.alarm) {
        this.suspicion = seen ? this.suspicion + dt * 0.45 : Math.max(0, this.suspicion - dt * 0.25);
        if (this.suspicion <= 0) this.sawPlayer = false;
        if (this.suspicion >= 1) this.raiseAlarm(ctx);
        else ctx.setSuspicion(this.suspicion > 0 ? this.suspicion : null);
      }
    }

    if (this.alarm) {
      // they give up once the zbojník is out of sight
      const near = this.guards.some((g) => g.isAlive() && g.position.distanceTo(player.position) < CALM_DISTANCE);
      this.calmTimer = near ? 0 : this.calmTimer + dt;
      if (this.calmTimer > 6 || !this.guards.some((g) => g.isAlive())) this.calm(ctx);
    } else if (this.guards.some((g) => !g.isAlive()) && player.position.distanceTo(tmp.set(LOC.mikulas.x, 0, LOC.mikulas.z)) > 140) {
      // new recruits replace the fallen while nobody watches
      this.spawnGuards();
    }

    const targets = ctx.zbojnici.filter((z) => z.isAlive());
    this.guards.forEach((g, i) => {
      if (!g.alerted && g.state !== 'dead') {
        g.state = 'idle';
        g.goal.copy(this.posts[i]);
        g.goalSpeed = i === 3 ? 1.3 : 1.6;
      }
      const seen = this.hitsSeen.get(g) ?? 0;
      if (g.hitsTaken > seen) {
        this.hitsSeen.set(g, g.hitsTaken);
        if (g.isAlive() && Math.random() < 0.35) ctx.bark(g.model.root, line(PANDUR_HIT), 2);
      }
      g.update(dt, {
        world: this.world,
        targets,
        onStrike: (e, t) => ctx.onStrike(e, t),
        onDeath: (e) => ctx.onPandurDown(e),
        onWake: () => {},
      });
    });
  }

  private calm(ctx: TownContext): void {
    this.alarm = false;
    this.calmTimer = 0;
    this.suspicion = 0;
    this.sawPlayer = false;
    if (this.collector) this.collector.halted = false;
    for (const g of this.guards) {
      if (!g.isAlive()) continue;
      g.calmDown();
    }
    ctx.onCalm();
  }

  render(alpha: number, frameDt: number): void {
    for (const g of this.guards) g.render(alpha, frameDt);
  }
}
