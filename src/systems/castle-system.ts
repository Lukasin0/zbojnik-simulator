import * as THREE from 'three';
import { CASTLE_GUARDS, LOC, STEALTH as S, type CastleGuardDef } from '@/config/constants';
import type { Actor } from '@/entities/actor';
import { Pandur } from '@/entities/enemy';
import { CASTLE_GUARD } from '@/entities/looks';
import { CASTLE_ALARM, GUARD_FOUND_BODY, GUARD_HUH, GUARD_NOTHING, line } from '@/story/lines';
import { angleDiff, lerp } from '@/utils/math-utils';
import type { World } from '@/world/world';

export interface CastleContext {
  player: Actor & { crouching: boolean; armed: boolean };
  /** player + living companions */
  zbojnici: Actor[];
  night: number;
  disguised: boolean;
  onStrike(e: Pandur, target: Actor): void;
  onPandurDown(e: Pandur): void;
  onAlarm(): void;
  bark(target: THREE.Object3D, text: string, seconds: number): void;
  /** strongest detection 0..1, null = nobody is looking */
  setDetection(v: number | null): void;
}

interface Guard {
  p: Pandur;
  route: THREE.Vector3[];
  /** fixed post (one waypoint) */
  post: boolean;
  yaw: number;
  wp: number;
  pause: number;
  bestDist: number;
  stuck: number;
  /** 0..1 – how sure he is that someone is there */
  detect: number;
  investigating: boolean;
  readonly lastSeen: THREE.Vector3;
  cone: THREE.Mesh;
  coneMat: THREE.MeshBasicMaterial;
  phase: number;
}

const CONE_CALM = new THREE.Color(0xffe08a);
const CONE_ALERT = new THREE.Color(0xff3a22);
const tmp = new THREE.Vector3();

/**
 * Hradná stráž of Likava: rounds and posts, vision cones, a detection meter, investigating, raising the
 * alarm (also on finding a knocked-out comrade) and calming down once the zbojník is gone.
 * Engine-agnostic rules – the numbers live in STEALTH / CASTLE_GUARDS.
 */
export class CastleSystem {
  private readonly guards: Guard[] = [];
  alarm = false;
  private calmTimer = 0;
  private respawnTimer = 0;
  private time = 0;
  private readonly center: THREE.Vector3;
  /** One shared light that follows the lantern nearest to the player (a fixed light count = no shader recompiles). */
  private readonly lanternLight = new THREE.PointLight(0xffb060, 0, 10, 1.6);

  constructor(
    parent: THREE.Object3D,
    private readonly world: World,
  ) {
    const c = LOC.castle;
    this.center = world.ground(c.x, c.z);
    parent.add(this.lanternLight);
    const coneGeo = new THREE.CircleGeometry(1, 18, -Math.PI / 2 - S.fov, S.fov * 2).rotateX(-Math.PI / 2);
    CASTLE_GUARDS.forEach((def: CastleGuardDef, i) => {
      const route = def.route.map(([x, z]) => world.ground(c.x + x, c.z + z));
      const p = new Pandur(parent, CASTLE_GUARD);
      p.state = 'idle';
      p.goalSpeed = S.walkSpeed;
      p.teleport(route[0].x, route[0].z, world);
      p.goal.copy(p.position);
      p.facing = def.yaw ?? 0;
      const coneMat = new THREE.MeshBasicMaterial({ color: CONE_CALM, transparent: true, opacity: 0.15, depthWrite: false, fog: false });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.renderOrder = 2;
      parent.add(cone);
      this.guards.push({
        p,
        route,
        post: route.length === 1,
        yaw: def.yaw ?? 0,
        wp: route.length > 1 ? 1 : 0,
        pause: 0,
        bestDist: Infinity,
        stuck: 0,
        detect: 0,
        investigating: false,
        lastSeen: new THREE.Vector3(),
        cone,
        coneMat,
        phase: i * 1.7,
      });
    });
  }

  get enemies(): Pandur[] {
    return this.guards.map((g) => g.p);
  }

  get fighting(): Pandur[] {
    return this.guards.filter((g) => g.p.alerted && g.p.isAlive()).map((g) => g.p);
  }

  get combatActive(): boolean {
    return this.alarm && this.guards.some((g) => g.p.isAlive());
  }

  get actors(): Actor[] {
    return this.guards.map((g) => g.p);
  }

  /** How far the guard sees right now (night, crouching). */
  private sightRange(night: number, crouch: boolean): number {
    return lerp(S.sightDay, S.sightNight, night) * (crouch ? S.crouchSight : 1);
  }

  /**
   * 0 = not seen; otherwise 1 - d/range (closer = higher). Needs the target in the cone and in clear
   * line of sight; a lit lantern shows anyone within its radius even at night.
   */
  private sees(g: Guard, target: THREE.Vector3, night: number, crouch: boolean): number {
    const p = g.p;
    const dx = target.x - p.position.x;
    const dz = target.z - p.position.z;
    const d = Math.hypot(dx, dz);
    let range = this.sightRange(night, crouch);
    if (p.model.lanternLit) range = Math.max(range, S.lanternRadius * (crouch ? 0.8 : 1));
    if (d > range) return 0;
    if (Math.abs(angleDiff(p.facing, Math.atan2(dx, dz))) > S.fov) return 0;
    if (!this.world.lineClear(p.position.x, p.position.z, target.x, target.z)) return 0;
    return Math.max(0.05, 1 - d / range);
  }

  private raiseAlarm(from: Guard, ctx: CastleContext, text: string): void {
    if (this.alarm) return;
    this.alarm = true;
    this.calmTimer = 0;
    ctx.bark(from.p.model.root, text, 3);
    for (const g of this.guards) {
      if (!g.p.isAlive()) continue;
      if (g.p.position.distanceTo(from.p.position) < S.alarmRadius) {
        g.p.alert();
        g.detect = 1;
      }
    }
    from.p.alert();
    ctx.onAlarm();
  }

  private calm(): void {
    this.alarm = false;
    this.calmTimer = 0;
    for (const g of this.guards) {
      g.detect = 0;
      g.investigating = false;
      if (!g.p.isAlive()) continue;
      g.p.calmDown();
      g.wp = this.nearestWaypoint(g);
    }
  }

  private nearestWaypoint(g: Guard): number {
    let best = 0;
    g.route.forEach((r, i) => {
      if (r.distanceTo(g.p.position) < g.route[best].distanceTo(g.p.position)) best = i;
    });
    return best;
  }

  update(dt: number, ctx: CastleContext): void {
    this.time += dt;
    const player = ctx.player;
    const far = player.position.distanceTo(this.center);
    const active = far < 160;
    for (const g of this.guards) g.p.model.setVisible(far < 260);
    this.updateLantern(ctx, active);
    if (!active) {
      for (const g of this.guards) g.cone.visible = false;
      this.respawnIfDue(dt, far);
      ctx.setDetection(null);
      return;
    }

    let maxDetect = 0;
    if (!this.alarm) {
      for (const g of this.guards) {
        if (!g.p.isAlive()) continue;
        // a guard who takes a blow (but stays up) shouts at once
        if (g.p.hp < g.p.maxHp || g.p.alerted) {
          this.raiseAlarm(g, ctx, line(CASTLE_ALARM));
          break;
        }
        // seen?
        let seen = 0;
        for (const z of ctx.zbojnici) {
          if (!z.isAlive()) continue;
          const crouch = z === player && player.crouching;
          const s = this.sees(g, z.position, ctx.night, crouch);
          if (s > 0) {
            let gain = (S.gainBase + S.gainNear * s) * (crouch ? 0.6 : 1);
            if (z === player && player.armed) gain *= 1.25;
            if (ctx.disguised) gain *= 0.6;
            seen = Math.max(seen, gain);
            g.lastSeen.copy(z.position);
          }
        }
        // a comrade lying on the ground?
        for (const o of this.guards) {
          if (o === g || o.p.isAlive()) continue;
          if (this.sees(g, o.p.position, ctx.night, false) > 0) {
            this.raiseAlarm(g, ctx, line(GUARD_FOUND_BODY));
            break;
          }
        }
        if (this.alarm) break;
        const before = g.detect;
        g.detect = seen > 0 ? Math.min(1, g.detect + seen * dt) : Math.max(0, g.detect - S.decay * dt);
        if (g.detect >= 1) {
          this.raiseAlarm(g, ctx, line(CASTLE_ALARM));
          break;
        }
        if (!g.investigating && g.detect >= S.investigate) {
          g.investigating = true;
          ctx.bark(g.p.model.root, line(GUARD_HUH), 2.5);
        } else if (g.investigating && g.detect <= 0) {
          g.investigating = false;
          ctx.bark(g.p.model.root, line(GUARD_NOTHING), 2.5);
          g.wp = this.nearestWaypoint(g);
        } else if (before > 0 && g.detect === 0) {
          g.wp = this.nearestWaypoint(g);
        }
        maxDetect = Math.max(maxDetect, g.detect);
        this.move(g, dt);
      }
    } else {
      // the zbojník got away, or every guard who knew lies on the ground
      if (far > S.calmDistance) this.calmTimer += dt;
      else this.calmTimer = 0;
      if (this.calmTimer > S.calmTime || !this.guards.some((g) => g.p.isAlive() && g.p.alerted)) this.calm();
    }

    const targets = ctx.zbojnici.filter((z) => z.isAlive());
    for (const g of this.guards) {
      g.p.update(dt, {
        world: this.world,
        targets,
        onStrike: (e, t) => ctx.onStrike(e, t),
        onDeath: (e) => ctx.onPandurDown(e),
        onWake: () => {},
      });
      this.updateCone(g, ctx, far);
    }
    ctx.setDetection(this.alarm ? 1 : maxDetect > 0.02 ? maxDetect : null);
    this.respawnIfDue(dt, far);
  }

  /** Rounds, posts with a look left and right, or walking over to where something moved. */
  private move(g: Guard, dt: number): void {
    const p = g.p;
    if (g.investigating) {
      const d = Math.hypot(g.lastSeen.x - p.position.x, g.lastSeen.z - p.position.z);
      if (d > 1.5) {
        p.goal.set(p.position.x + ((g.lastSeen.x - p.position.x) / d) * 1.1, 0, p.position.z + ((g.lastSeen.z - p.position.z) / d) * 1.1);
      } else {
        p.goal.copy(p.position);
        p.facing += Math.sin(this.time * 1.3 + g.phase) * dt * 1.2;
      }
      return;
    }
    const target = g.route[g.wp % g.route.length];
    const d = Math.hypot(target.x - p.position.x, target.z - p.position.z);
    if (g.post) {
      if (d > 0.6) {
        p.goal.set(p.position.x + ((target.x - p.position.x) / d) * 1.1, 0, p.position.z + ((target.z - p.position.z) / d) * 1.1);
      } else {
        p.goal.copy(p.position);
        p.facing = g.yaw + Math.sin(this.time * 0.35 + g.phase) * 0.7;
      }
      return;
    }
    if (g.pause > 0) {
      g.pause -= dt;
      p.goal.copy(p.position);
      p.facing += Math.sin(this.time * 0.9 + g.phase) * dt * 0.9;
      return;
    }
    if (d < 1.2) {
      g.wp++;
      g.pause = 2 + ((g.phase * 7) % 2);
      g.bestDist = Infinity;
      g.stuck = 0;
      return;
    }
    if (d < g.bestDist - 0.3) {
      g.bestDist = d;
      g.stuck = 0;
    } else if ((g.stuck += dt) > 4) {
      g.wp++;
      g.bestDist = Infinity;
      g.stuck = 0;
    }
    p.goal.set(p.position.x + ((target.x - p.position.x) / d) * 1.1, 0, p.position.z + ((target.z - p.position.z) / d) * 1.1);
  }

  private updateCone(g: Guard, ctx: CastleContext, far: number): void {
    const show = far < 48 && !this.alarm && g.p.isAlive() && g.p.unaware;
    g.cone.visible = show;
    if (!show) return;
    let range = this.sightRange(ctx.night, ctx.player.crouching);
    if (g.p.model.lanternLit) range = Math.max(range, S.lanternRadius);
    g.cone.position.set(g.p.position.x, g.p.position.y + 0.06, g.p.position.z);
    g.cone.rotation.y = g.p.facing;
    g.cone.scale.setScalar(range);
    g.coneMat.color.copy(CONE_CALM).lerp(CONE_ALERT, g.detect);
    g.coneMat.opacity = 0.1 + g.detect * 0.25;
  }

  /** Lanterns are lit after dusk; the one nearest the player carries the real light. */
  private updateLantern(ctx: CastleContext, active: boolean): void {
    const lit = ctx.night > 0.35;
    let best: Guard | null = null;
    let bestD = 40;
    for (const g of this.guards) {
      g.p.model.setLantern(lit && g.p.isAlive());
      if (!lit || !active || !g.p.isAlive()) continue;
      const d = g.p.position.distanceTo(ctx.player.position);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    if (best && best.p.model.leftLanternPosition(tmp)) {
      this.lanternLight.position.copy(tmp);
      this.lanternLight.intensity = 1.8 * ctx.night * (0.92 + Math.sin(this.time * 9) * 0.05);
    } else {
      this.lanternLight.intensity = 0;
    }
  }

  /** Knocked-out guards are replaced once the zbojník is far away for long enough. */
  private respawnIfDue(dt: number, far: number): void {
    if (this.alarm || !this.guards.some((g) => !g.p.isAlive())) {
      this.respawnTimer = 0;
      return;
    }
    if (far > 120) this.respawnTimer += dt;
    if (this.respawnTimer < S.respawn) return;
    this.respawnTimer = 0;
    for (const g of this.guards) {
      if (g.p.isAlive()) continue;
      g.p.revive();
      g.p.teleport(g.route[0].x, g.route[0].z, this.world);
      g.p.goal.copy(g.p.position);
      g.p.facing = g.yaw;
      g.wp = g.route.length > 1 ? 1 : 0;
      g.detect = 0;
    }
  }

  markers(): { x: number; z: number; color: string; size: number }[] {
    return this.guards
      .filter((g) => g.p.isAlive() && (g.p.alerted || g.detect > 0.3))
      .map((g) => ({ x: g.p.position.x, z: g.p.position.z, color: g.p.alerted ? '#ff3a22' : '#ffd04a', size: 3 }));
  }

  /** Debug snapshot. */
  snapshot(): unknown {
    return {
      alarm: this.alarm,
      guards: this.guards.map((g) => ({
        state: g.p.state,
        detect: Math.round(g.detect * 100) / 100,
        inv: g.investigating,
        x: Math.round(g.p.position.x),
        z: Math.round(g.p.position.z),
      })),
    };
  }
}
