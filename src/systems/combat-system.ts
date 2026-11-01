import * as THREE from 'three';
import type { Faction } from '@/types/game-types';
import { angleDiff } from '@/utils/math-utils';

export type HitSource = 'player' | 'companion' | 'enemy' | 'shot';

export interface Hittable {
  readonly position: THREE.Vector3;
  readonly radius: number;
  readonly hitHeight: number;
  readonly faction: Faction;
  isAlive(): boolean;
  /** `force` = knockback strength (heavy blows send pandúri flying). */
  receiveHit(damage: number, from: THREE.Vector3, source: HitSource, force?: number): void;
}

const tmp = new THREE.Vector3();

/** Resolves melee cones and musket ray casts against everything registered. */
export class CombatSystem {
  private readonly targets = new Set<Hittable>();

  register(h: Hittable): void {
    this.targets.add(h);
  }

  unregister(h: Hittable): void {
    this.targets.delete(h);
  }

  private hostile(attacker: Faction, target: Faction): boolean {
    if (attacker === 'zbojnik') return target !== 'zbojnik';
    if (attacker === 'pandur') return target === 'zbojnik';
    return false;
  }

  /** Hits every valid target inside the swing cone. Returns the hit targets. */
  melee(
    origin: THREE.Vector3,
    facing: number,
    range: number,
    arc: number,
    damage: number,
    faction: Faction,
    source: HitSource,
    force?: number,
  ): Hittable[] {
    const hits: Hittable[] = [];
    for (const t of this.targets) {
      if (!t.isAlive() || !this.hostile(faction, t.faction)) continue;
      const dx = t.position.x - origin.x;
      const dz = t.position.z - origin.z;
      const dist = Math.hypot(dx, dz) - t.radius;
      if (dist > range) continue;
      if (Math.abs(t.position.y - origin.y) > 2.2) continue;
      const ang = Math.atan2(dx, dz);
      if (dist > 0.6 && Math.abs(angleDiff(facing, ang)) > arc / 2) continue;
      t.receiveHit(damage, origin, source, force);
      hits.push(t);
    }
    return hits;
  }

  /** Musket shot: nearest target along the ray (sphere stack approximation). */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, faction: Faction): { target: Hittable; dist: number } | null {
    let best: { target: Hittable; dist: number } | null = null;
    for (const t of this.targets) {
      if (!t.isAlive() || !this.hostile(faction, t.faction)) continue;
      const r = Math.max(0.4, t.radius);
      for (const k of [0.3, 0.55, 0.8]) {
        tmp.set(t.position.x, t.position.y + t.hitHeight * k, t.position.z).sub(origin);
        const proj = tmp.dot(dir);
        if (proj < 0 || proj > maxDist) continue;
        const d2 = tmp.lengthSq() - proj * proj;
        if (d2 > r * r) continue;
        const hitDist = proj - Math.sqrt(r * r - d2);
        if (!best || hitDist < best.dist) best = { target: t, dist: hitDist };
      }
    }
    return best;
  }

  nearest(pos: THREE.Vector3, faction: Faction, maxDist: number): Hittable | null {
    let best: Hittable | null = null;
    let bestD = maxDist;
    for (const t of this.targets) {
      if (!t.isAlive() || t.faction !== faction) continue;
      const d = t.position.distanceTo(pos);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }
}
