import type { Actor } from './actor';

export interface MeleeStats {
  damage: number;
  speed: number;
  range: number;
  windup: number;
  recover: number;
}

export type MeleePhase = 'chase' | 'windup' | 'recover' | 'stagger';

/**
 * Minimal close-combat AI: run at the target, wind up, strike, recover. Shared by villagers who got
 * provoked and the wandering zbojníci. (Pandúri keep their own richer state machine in enemy.ts.)
 */
export class MeleeBrain {
  phase: MeleePhase = 'chase';
  /** -1 = no swing, else 0..1 animation progress (copy into Actor.attackT) */
  attackT = -1;
  private timer = 0;

  constructor(public stats: MeleeStats) {}

  reset(): void {
    this.phase = 'chase';
    this.attackT = -1;
    this.timer = 0;
  }

  stagger(seconds: number): void {
    this.phase = 'stagger';
    this.timer = seconds;
    this.attackT = -1;
  }

  /** Steer `self` at `target`; writes the wanted velocity into `out`. */
  tick(self: Actor, target: Actor, dt: number, strike: () => void, out: { x: number; z: number }): void {
    const s = this.stats;
    out.x = 0;
    out.z = 0;
    switch (this.phase) {
      case 'chase': {
        const dx = target.position.x - self.position.x;
        const dz = target.position.z - self.position.z;
        const d = Math.hypot(dx, dz) || 1;
        self.turnTowards(Math.atan2(dx, dz), 10, dt);
        if (d > s.range * 0.85) {
          out.x = (dx / d) * s.speed;
          out.z = (dz / d) * s.speed;
        } else {
          this.phase = 'windup';
          this.timer = s.windup;
          this.attackT = 0;
        }
        break;
      }
      case 'windup':
        this.timer -= dt;
        this.attackT = Math.min(0.62, (1 - this.timer / s.windup) * 0.62);
        self.faceTowards(target.position, 6, dt);
        if (this.timer <= 0) {
          if (target.isAlive() && target.position.distanceTo(self.position) < s.range + 0.5) strike();
          this.phase = 'recover';
          this.timer = s.recover;
        }
        break;
      case 'recover':
        this.timer -= dt;
        this.attackT = this.attackT >= 0 ? Math.min(0.99, this.attackT + dt * 1.5) : -1;
        if (this.timer <= 0) {
          this.attackT = -1;
          this.phase = 'chase';
        }
        break;
      case 'stagger':
        this.timer -= dt;
        if (this.timer <= 0) this.phase = 'chase';
        break;
    }
  }
}
