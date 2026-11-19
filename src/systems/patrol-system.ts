import * as THREE from 'three';
import { PATROLS, PATROL_TUNING as P, type PatrolDef } from '@/config/constants';
import type { Actor } from '@/entities/actor';
import { Pandur } from '@/entities/enemy';
import { BAND_LOOKS, DRAB } from '@/entities/looks';
import { Npc, type NpcFightContext } from '@/entities/npc';
import type { NpcId } from '@/types/game-types';
import { lerp } from '@/utils/math-utils';
import type { World } from '@/world/world';

export interface PatrolContext {
  /** player + living companions */
  zbojnici: Actor[];
  player: Actor;
  /** 0 day … 1 night */
  night: number;
  disguised: boolean;
  /** drábi only walk the valley once the story has made the captain known */
  drabiActive: boolean;
  hour: number;
  fight: NpcFightContext;
  onStrike(e: Pandur, target: Actor): void;
  onPandurDown(e: Pandur): void;
  onAlert(leader: Pandur): void;
  onGreet(band: Npc): void;
}

interface DrabGroup {
  def: PatrolDef;
  route: THREE.Vector3[];
  members: Pandur[];
  /** formation offsets behind the leader */
  offsets: THREE.Vector2[];
  wp: number;
  alerted: boolean;
  respawnTimer: number;
  stuckTimer: number;
  bestDist: number;
  active: boolean;
}

interface BandGroup {
  route: THREE.Vector3[];
  members: Npc[];
  greetCd: number;
}

const tmp = new THREE.Vector3();

/** Drábi walking their rounds (hostile) and other zbojnícke partie roaming the hills (friendly). */
export class PatrolSystem {
  private readonly drabi: DrabGroup[] = [];
  private readonly bands: BandGroup[] = [];

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly world: World,
  ) {
    let look = 0;
    for (const def of PATROLS) {
      const route = def.route.map(([x, z]) => world.ground(x, z));
      if (def.kind === 'drabi') {
        const members: Pandur[] = [];
        const offsets: THREE.Vector2[] = [];
        for (let i = 0; i < def.size; i++) {
          const p = new Pandur(parent, DRAB);
          p.state = 'idle';
          p.goalSpeed = P.walkSpeed;
          const off = new THREE.Vector2(((i % 2) * 2 - 1) * 1.1 * Math.min(1, i), -1.6 * Math.ceil(i / 2));
          offsets.push(off);
          p.teleport(route[0].x + off.x, route[0].z + off.y, world);
          p.goal.copy(p.position);
          members.push(p);
        }
        this.drabi.push({ def, route, members, offsets, wp: 1, alerted: false, respawnTimer: 0, stuckTimer: 0, bestDist: Infinity, active: true });
      } else {
        const members: Npc[] = [];
        for (let i = 0; i < def.size; i++) {
          const ox = (i - (def.size - 1) / 2) * 1.6;
          const oz = (i % 2) * 1.2;
          // 'band' is not a story NPC id – these men have no dialogs, only barks and fists
          const n = new Npc('band' as NpcId, 'Zbojník', BAND_LOOKS[look++ % BAND_LOOKS.length], parent, route[0].x + ox, route[0].z + oz, 0, world, 'normal', 0, 'band');
          n.walksRoute(route.map((r) => world.ground(r.x + ox, r.z + oz)));
          members.push(n);
        }
        this.bands.push({ route, members, greetCd: 0 });
      }
    }
  }

  /** Hittable drábi for the combat system. */
  get enemies(): Pandur[] {
    const out: Pandur[] = [];
    for (const g of this.drabi) if (g.active) out.push(...g.members);
    return out;
  }

  /** Band members for the combat system (they can be provoked too). */
  get bandMembers(): Npc[] {
    return this.bands.flatMap((b) => b.members);
  }

  /** Drábi currently fighting – companions and other partie join in. */
  get fightingDrabi(): Pandur[] {
    return this.enemies.filter((e) => e.alerted && e.isAlive());
  }

  get combatActive(): boolean {
    return this.drabi.some((g) => g.active && g.alerted && g.members.some((m) => m.isAlive()));
  }

  update(dt: number, ctx: PatrolContext): void {
    const playerPos = ctx.player.position;
    const bandTargets = this.bandMembers.filter((b) => b.isAlive());
    const targets = [...ctx.zbojnici.filter((z) => z.isAlive()), ...bandTargets];
    for (const g of this.drabi) this.updateDrabi(g, dt, ctx, targets);
    for (const b of this.bands) {
      const lead = b.members[0];
      const near = lead.position.distanceTo(playerPos) < P.activeDistance;
      b.greetCd -= dt;
      for (const m of b.members) {
        m.model.setVisible(near);
        if (near) m.update(dt, this.world, playerPos, ctx.hour, ctx.fight);
      }
      if (near && b.greetCd <= 0) {
        const greeter = b.members.find((m) => m.friendly && m.isAlive() && m.position.distanceTo(playerPos) < 6);
        if (greeter) {
          b.greetCd = 40;
          ctx.onGreet(greeter);
        }
      }
    }
  }

  private updateDrabi(g: DrabGroup, dt: number, ctx: PatrolContext, targets: Actor[]): void {
    const playerPos = ctx.player.position;
    const lead = g.members.find((m) => m.isAlive()) ?? null;
    // wiped out → come back later, out of sight
    if (!lead) {
      g.alerted = false;
      g.respawnTimer += dt;
      if (g.respawnTimer > P.respawn && g.route[0].distanceTo(playerPos) > P.activeDistance) this.respawn(g);
      return;
    }
    const near = lead.position.distanceTo(playerPos) < P.activeDistance;
    const show = ctx.drabiActive && near;
    if (!ctx.drabiActive && g.alerted) this.calm(g);
    g.active = ctx.drabiActive;
    for (const m of g.members) m.model.setVisible(show);
    if (!show) return;

    if (!g.alerted) {
      // spot the zbojníci – or notice being hit
      const sight = ctx.disguised ? P.sightDisguised : lerp(P.sightDay, P.sightNight, ctx.night);
      const alive = g.members.filter((m) => m.isAlive());
      const seen = alive.some((m) => ctx.zbojnici.some((z) => z.isAlive() && z.position.distanceTo(m.position) < sight));
      const hurt = alive.some((m) => m.hp < m.maxHp);
      const bandNear = alive.some((m) => targets.some((t) => t.faction === 'band' && t.position.distanceTo(m.position) < sight * 0.8));
      if (seen || hurt || bandNear) {
        g.alerted = true;
        for (const m of g.members) m.alert();
        if (seen || (hurt && lead.position.distanceTo(playerPos) < 30)) ctx.onAlert(lead);
      } else {
        this.walk(g, lead, dt);
      }
    } else {
      // everyone got away → back to the round
      const lost = g.members.every((m) => !m.isAlive() || targets.every((t) => t.position.distanceTo(m.position) > P.loseDistance));
      if (lost) this.calm(g);
    }
    for (const m of g.members) {
      m.update(dt, {
        world: this.world,
        targets,
        onStrike: (e, t) => ctx.onStrike(e, t),
        onDeath: (e) => ctx.onPandurDown(e),
        onWake: () => {},
      });
    }
  }

  /** Leader walks waypoint to waypoint (a carrot 1 m ahead keeps him at a walk); the rest keep formation. */
  private walk(g: DrabGroup, lead: Pandur, dt: number): void {
    const wp = g.route[g.wp % g.route.length];
    const d = Math.hypot(wp.x - lead.position.x, wp.z - lead.position.z);
    if (d < 1.5) {
      g.wp++;
      g.bestDist = Infinity;
      g.stuckTimer = 0;
      return;
    }
    // blocked by trees or a fence? give up on this waypoint
    if (d < g.bestDist - 0.3) {
      g.bestDist = d;
      g.stuckTimer = 0;
    } else if ((g.stuckTimer += dt) > 4) {
      g.wp++;
      g.bestDist = Infinity;
      g.stuckTimer = 0;
    }
    const dirX = (wp.x - lead.position.x) / d;
    const dirZ = (wp.z - lead.position.z) / d;
    lead.goal.set(lead.position.x + dirX * 1.1, 0, lead.position.z + dirZ * 1.1);
    const yaw = lead.facing;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    g.members.forEach((m, i) => {
      if (m === lead || !m.isAlive()) return;
      const o = g.offsets[i];
      // offset in the leader's frame: x = right, y = forward
      tmp.set(lead.position.x - cos * o.x + sin * o.y, 0, lead.position.z + sin * o.x + cos * o.y);
      m.goal.copy(tmp);
    });
  }

  private calm(g: DrabGroup): void {
    g.alerted = false;
    for (const m of g.members) m.calmDown();
    // resume from the nearest waypoint
    const lead = g.members.find((m) => m.isAlive());
    if (!lead) return;
    let best = 0;
    g.route.forEach((r, i) => {
      if (r.distanceTo(lead.position) < g.route[best].distanceTo(lead.position)) best = i;
    });
    g.wp = best;
    g.bestDist = Infinity;
  }

  private respawn(g: DrabGroup): void {
    g.respawnTimer = 0;
    g.wp = 1;
    g.alerted = false;
    g.members.forEach((m, i) => {
      m.revive();
      m.teleport(g.route[0].x + g.offsets[i].x, g.route[0].z + g.offsets[i].y, this.world);
      m.goal.copy(m.position);
    });
  }

  /** All actors for render interpolation / separation. */
  get actors(): Actor[] {
    return [...this.drabi.flatMap((g) => g.members), ...this.bandMembers];
  }

  /** Minimap markers. */
  markers(): { x: number; z: number; color: string; size: number }[] {
    const out: { x: number; z: number; color: string; size: number }[] = [];
    for (const g of this.drabi) {
      if (!g.active) continue;
      for (const m of g.members) if (m.alerted && m.isAlive()) out.push({ x: m.position.x, z: m.position.z, color: '#7a2a22', size: 3 });
    }
    return out;
  }

  /** Debug / map: how many drábi are walking right now. */
  get stats(): { drabi: number; bands: number } {
    return { drabi: this.enemies.filter((e) => e.isAlive()).length, bands: this.bandMembers.length };
  }

  dispose(): void {
    for (const a of this.actors) {
      this.parent.remove(a.model.root);
      a.dispose();
    }
  }
}
