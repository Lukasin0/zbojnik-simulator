import * as THREE from 'three';
import { PANDUR_TUNING as T } from '@/config/constants';
import type { GroundProvider } from '@/components/physics-body';
import type { HitSource } from '@/systems/combat-system';
import { Actor } from './actor';
import { PANDUR } from './looks';

export type PandurState = 'escort' | 'idle' | 'sleepy' | 'chase' | 'windup' | 'recover' | 'stagger' | 'dead';

export interface EnemyContext {
  world: GroundProvider;
  /** Living zbojníci (player + companions). */
  targets: Actor[];
  onStrike(enemy: Pandur, target: Actor): void;
  onDeath(enemy: Pandur): void;
  onWake(enemy: Pandur): void;
}

/** Panský pandúr – escort of the coach. */
export class Pandur extends Actor {
  readonly faction = 'pandur' as const;
  state: PandurState = 'escort';
  /** Point to walk to while escorting / idle. */
  readonly goal = new THREE.Vector3();
  goalSpeed = 0;
  /** Seconds of grogginess after waking from the fujara lullaby. */
  drowsy = 0;
  private timer = 0;
  private target: Actor | null = null;
  private wakeRequested = false;

  constructor(parent: THREE.Object3D) {
    super(PANDUR, parent, T.hp);
    this.body.radius = 0.4;
    this.attackKind = 'slashR';
  }

  get alerted(): boolean {
    return this.state === 'chase' || this.state === 'windup' || this.state === 'recover' || this.state === 'stagger';
  }

  alert(): void {
    if (this.state === 'dead' || this.alerted) return;
    if (this.state === 'sleepy') {
      this.drowsy = 6;
      this.wakeRequested = true;
    }
    this.pose = 'normal';
    this.state = 'chase';
  }

  /** The zbojník got away – back to guard duty, bruises forgotten. */
  calmDown(): void {
    if (this.state === 'dead') return;
    this.state = 'idle';
    this.pose = 'normal';
    this.attackT = -1;
    this.drowsy = 0;
    this.hp = this.maxHp;
  }

  fallAsleep(): void {
    if (this.state === 'dead' || this.alerted) return;
    this.state = 'sleepy';
    this.pose = 'sleep';
  }

  receiveHit(damage: number, from: THREE.Vector3, _source: HitSource, force = 3.5): void {
    if (this.state === 'dead') return;
    const wasSleeping = this.state === 'sleepy';
    this.hp = Math.max(0, this.hp - damage * (wasSleeping ? 1.5 : 1));
    this.knockback(from, force);
    // heavy blows lift the poor fellow off his feet
    if (force > 6) {
      this.body.velocity.y = Math.max(this.body.velocity.y, force * 0.55);
      this.body.onGround = false;
    }
    this.hitsTaken++;
    if (this.hp <= 0) {
      this.state = 'dead';
      this.pose = 'dead';
      this.attackT = -1;
      return;
    }
    if (wasSleeping) {
      this.drowsy = 6;
      this.wakeRequested = true;
    }
    this.pose = 'normal';
    this.state = 'stagger';
    this.timer = 0.3 + force * 0.05;
    this.attackT = -1;
  }

  /** Counts hits so the ambush system can make him complain now and then. */
  hitsTaken = 0;

  private pickTarget(targets: Actor[]): Actor | null {
    let best: Actor | null = null;
    let bestD = Infinity;
    for (const t of targets) {
      if (!t.isAlive()) continue;
      const d = t.position.distanceTo(this.position);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  update(dt: number, ctx: EnemyContext): void {
    this.beginTick();
    if (this.wakeRequested) {
      this.wakeRequested = false;
      ctx.onWake(this);
    }
    this.drowsy = Math.max(0, this.drowsy - dt);
    const speedMul = this.drowsy > 0 ? T.drowsySpeed / T.speed : 1;
    let vx = 0;
    let vz = 0;

    switch (this.state) {
      case 'escort':
      case 'idle': {
        const dx = this.goal.x - this.position.x;
        const dz = this.goal.z - this.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.4) {
          const sp = Math.min(T.speed, Math.max(this.goalSpeed, d * 1.5));
          vx = (dx / d) * sp;
          vz = (dz / d) * sp;
          this.turnTowards(Math.atan2(dx, dz), 8, dt);
        }
        break;
      }
      case 'sleepy':
        break;
      case 'chase': {
        this.target = this.pickTarget(ctx.targets);
        if (!this.target) {
          this.state = 'idle';
          break;
        }
        const tp = this.target.position;
        const dx = tp.x - this.position.x;
        const dz = tp.z - this.position.z;
        const d = Math.hypot(dx, dz);
        this.turnTowards(Math.atan2(dx, dz), 10, dt);
        if (d > T.range * 0.85) {
          vx = (dx / d) * T.speed * speedMul;
          vz = (dz / d) * T.speed * speedMul;
        } else {
          this.state = 'windup';
          this.timer = this.drowsy > 0 ? T.drowsyWindup : T.windup;
          this.attackT = 0;
        }
        break;
      }
      case 'windup': {
        const total = this.drowsy > 0 ? T.drowsyWindup : T.windup;
        this.timer -= dt;
        this.attackT = Math.min(0.62, (1 - this.timer / total) * 0.62);
        if (this.target) this.faceTowards(this.target.position, 6, dt);
        if (this.timer <= 0) {
          if (this.target && this.target.isAlive()) {
            const d = this.target.position.distanceTo(this.position);
            if (d < T.range + 0.5) ctx.onStrike(this, this.target);
          }
          this.state = 'recover';
          this.timer = T.recover;
        }
        break;
      }
      case 'recover':
        this.timer -= dt;
        this.attackT = this.attackT >= 0 ? Math.min(0.99, this.attackT + dt * 1.5) : -1;
        if (this.timer <= 0) {
          this.attackT = -1;
          this.state = 'chase';
        }
        break;
      case 'stagger':
        this.timer -= dt;
        if (this.timer <= 0) this.state = 'chase';
        break;
      case 'dead':
        break;
    }

    this.body.steer(vx, vz, this.state === 'stagger' ? 2 : 9, dt);
    this.body.integrate(dt, ctx.world);
    if (this.state === 'dead' && this.pose === 'dead' && !this.deathReported) {
      this.deathReported = true;
      ctx.onDeath(this);
    }
  }

  private deathReported = false;
}
