import * as THREE from 'three';
import { PhysicsBody, type GroundProvider } from '@/components/physics-body';
import type { HitSource, Hittable } from '@/systems/combat-system';
import { angleDiff, damp, lerp } from '@/utils/math-utils';
import { at, part } from '@/world/materials';
import type { Actor } from './actor';

export const BEAR_TUNING = {
  hp: 480,
  speed: 4.6,
  damage: 16,
  range: 2.5,
  windup: 0.8,
  recover: 1.1,
  /** wakes up when somebody comes this close */
  wakeRadius: 7,
  /** gives up and runs below this share of health */
  fleeAt: 0.25,
} as const;

export type BearState = 'sleep' | 'chase' | 'windup' | 'recover' | 'stagger' | 'dance' | 'flee' | 'gone';

export interface BearContext {
  world: GroundProvider;
  targets: Actor[];
  onStrike(bear: Bear, target: Actor): void;
  onRoar(bear: Bear): void;
  /** Left the hideout – beaten or charmed by the fujara. */
  onGone(bear: Bear, how: 'beaten' | 'danced'): void;
}

const FUR = 0x5a3a22;
const FUR_LIGHT = 0x8a6a4a;

/** Dunčo – the brown bear who moved into the zbojníci's hideout first. */
export class Bear implements Hittable {
  readonly faction = 'zver' as const;
  readonly hitHeight = 1.5;
  readonly body = new PhysicsBody();
  readonly root = new THREE.Group();
  hp: number = BEAR_TUNING.hp;
  readonly maxHp: number = BEAR_TUNING.hp;
  state: BearState = 'sleep';
  facing = 0;
  hitsTaken = 0;
  private prevFacing = 0;
  private timer = 0;
  private target: Actor | null = null;
  private struck = false;
  private phase = 0;
  private rear = 0;
  private hurt = 0;
  private how: 'beaten' | 'danced' = 'beaten';
  private readonly exit = new THREE.Vector3();
  private readonly torso = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly legs: THREE.Group[] = [];

  constructor(parent: THREE.Object3D, x: number, z: number, exit: THREE.Vector3, world: GroundProvider) {
    this.body.radius = 0.95;
    this.exit.copy(exit);
    this.build();
    parent.add(this.root);
    this.body.teleport(x, z, world);
    this.root.position.copy(this.body.position);
  }

  private build(): void {
    // the torso pivots at the hind legs so he can rear up
    this.torso.position.set(0, 0.85, -0.55);
    this.root.add(this.torso);
    const trunk = part(new THREE.SphereGeometry(1, 9, 7), FUR);
    trunk.scale.set(0.72, 0.68, 1.15);
    trunk.position.set(0, 0.15, 0.6);
    this.torso.add(trunk);
    const hump = part(new THREE.SphereGeometry(0.42, 7, 5), FUR);
    hump.position.set(0, 0.6, 1.1);
    this.torso.add(hump);
    this.head.position.set(0, 0.45, 1.75);
    this.torso.add(this.head);
    this.head.add(part(new THREE.SphereGeometry(0.4, 8, 6), FUR));
    this.head.add(at(part(new THREE.BoxGeometry(0.28, 0.24, 0.36), FUR_LIGHT), 0, -0.08, 0.36));
    this.head.add(at(part(new THREE.BoxGeometry(0.12, 0.08, 0.06), 0x1a1410), 0, -0.02, 0.55));
    for (const s of [-1, 1]) {
      this.head.add(at(part(new THREE.SphereGeometry(0.11, 6, 4), FUR), 0.26 * s, 0.32, -0.05));
      this.head.add(at(part(new THREE.BoxGeometry(0.06, 0.05, 0.03), 0x0a0808), 0.15 * s, 0.1, 0.33));
    }
    const legSpots: [number, number, THREE.Object3D][] = [
      [-0.38, 1.25, this.torso],
      [0.38, 1.25, this.torso],
      [-0.4, 0, this.torso],
      [0.4, 0, this.torso],
    ];
    for (const [x, z, parentPart] of legSpots) {
      const leg = new THREE.Group();
      leg.position.set(x, 0, z);
      leg.add(at(part(new THREE.CylinderGeometry(0.17, 0.15, 0.85, 7), FUR), 0, -0.42, 0));
      leg.add(at(part(new THREE.BoxGeometry(0.28, 0.12, 0.34), 0x3a2414), 0, -0.82, 0.06));
      parentPart.add(leg);
      this.legs.push(leg);
    }
  }

  get position(): THREE.Vector3 {
    return this.body.position;
  }

  get radius(): number {
    return this.body.radius;
  }

  get alerted(): boolean {
    return this.state === 'chase' || this.state === 'windup' || this.state === 'recover' || this.state === 'stagger';
  }

  get asleep(): boolean {
    return this.state === 'sleep';
  }

  isAlive(): boolean {
    return this.state !== 'gone' && this.state !== 'flee' && this.state !== 'dance';
  }

  receiveHit(damage: number, from: THREE.Vector3, _source: HitSource, force = 3.5): void {
    if (!this.isAlive()) return;
    this.hp = Math.max(0, this.hp - damage);
    this.hurt = 0.25;
    this.hitsTaken++;
    const dx = this.position.x - from.x;
    const dz = this.position.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    this.body.velocity.x += (dx / d) * force * 0.35;
    this.body.velocity.z += (dz / d) * force * 0.35;
    if (this.hp <= this.maxHp * BEAR_TUNING.fleeAt) {
      this.leave('beaten');
      return;
    }
    if (this.state === 'sleep') this.wake();
    else if (force > 6 && this.state !== 'windup') {
      this.state = 'stagger';
      this.timer = 0.6;
    }
  }

  wake(): void {
    if (this.state !== 'sleep') return;
    this.state = 'chase';
    this.timer = -1;
  }

  /** The fujara charmed him: a little dance on his hind legs, then off into the cave. */
  dance(): void {
    if (this.state === 'gone' || this.state === 'flee' || this.state === 'dance') return;
    this.state = 'dance';
    this.timer = 5.5;
  }

  private leave(how: 'beaten' | 'danced'): void {
    this.how = how;
    this.state = 'flee';
    this.timer = 9;
  }

  update(dt: number, ctx: BearContext): void {
    this.body.storePrev();
    this.prevFacing = this.facing;
    if (this.state === 'gone') return;
    this.hurt = Math.max(0, this.hurt - dt);
    let vx = 0;
    let vz = 0;
    let speed = 0;
    const T = BEAR_TUNING;

    switch (this.state) {
      case 'sleep':
        for (const t of ctx.targets) {
          if (t.isAlive() && t.position.distanceTo(this.position) < T.wakeRadius) {
            this.wake();
            break;
          }
        }
        break;
      case 'chase': {
        if (this.timer < 0) {
          // just woke up – roar first
          this.timer = 0;
          ctx.onRoar(this);
        }
        this.target = this.nearest(ctx.targets);
        if (!this.target) break;
        const dx = this.target.position.x - this.position.x;
        const dz = this.target.position.z - this.position.z;
        const d = Math.hypot(dx, dz);
        this.turnTowards(Math.atan2(dx, dz), 5, dt);
        if (d > T.range * 0.9) {
          speed = T.speed;
          vx = (dx / d) * speed;
          vz = (dz / d) * speed;
        } else {
          this.state = 'windup';
          this.timer = T.windup;
          this.struck = false;
        }
        break;
      }
      case 'windup':
        this.timer -= dt;
        if (this.target) this.faceTowards(this.target.position, 4, dt);
        if (this.timer <= 0 && !this.struck) {
          this.struck = true;
          if (this.target && this.target.isAlive() && this.target.position.distanceTo(this.position) < T.range + 0.6) {
            ctx.onStrike(this, this.target);
          }
          this.state = 'recover';
          this.timer = T.recover;
        }
        break;
      case 'recover':
      case 'stagger':
        this.timer -= dt;
        if (this.timer <= 0) this.state = 'chase';
        break;
      case 'dance':
        this.timer -= dt;
        if (this.timer <= 0) this.leave('danced');
        break;
      case 'flee': {
        this.timer -= dt;
        const dx = this.exit.x - this.position.x;
        const dz = this.exit.z - this.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.2 || this.timer <= 0) {
          this.state = 'gone';
          this.root.visible = false;
          ctx.onGone(this, this.how);
          return;
        }
        speed = T.speed * 1.2;
        vx = (dx / d) * speed;
        vz = (dz / d) * speed;
        this.turnTowards(Math.atan2(dx, dz), 6, dt);
        break;
      }
    }
    this.phase += dt * (2 + speed * 1.6);
    this.body.steer(vx, vz, this.state === 'stagger' ? 2 : 6, dt);
    this.body.integrate(dt, ctx.world);
  }

  private nearest(targets: Actor[]): Actor | null {
    let best: Actor | null = null;
    let bestD = 40;
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

  private turnTowards(yaw: number, lambda: number, dt: number): void {
    this.facing += angleDiff(this.facing, yaw) * (1 - Math.exp(-lambda * dt));
  }

  private faceTowards(p: THREE.Vector3, lambda: number, dt: number): void {
    this.turnTowards(Math.atan2(p.x - this.position.x, p.z - this.position.z), lambda, dt);
  }

  render(alpha: number, frameDt: number): void {
    if (!this.root.visible) return;
    const b = this.body;
    this.root.position.lerpVectors(b.prev, b.position, alpha);
    this.root.rotation.y = this.prevFacing + angleDiff(this.prevFacing, this.facing) * alpha;
    const moving = Math.min(1, b.horizontalSpeed / 3);
    const swing = Math.sin(this.phase) * 0.55 * moving;
    // rear up on the hind legs for a swipe – and for the dance
    const rearTarget = this.state === 'windup' ? 0.85 : this.state === 'dance' ? 1.25 : 0;
    this.rear = damp(this.rear, rearTarget, this.state === 'recover' ? 9 : 6, frameDt);
    this.torso.rotation.x = -this.rear;
    this.torso.rotation.z = this.state === 'dance' ? Math.sin(this.phase * 1.4) * 0.25 : this.hurt * 0.4;
    const asleep = this.state === 'sleep';
    this.torso.position.y = lerp(0.85, 0.42, asleep ? 1 : 0);
    this.head.rotation.x = asleep ? 0.5 : -this.rear * 0.4 + Math.sin(this.phase * 0.5) * 0.05;
    this.legs.forEach((leg, i) => {
      const front = i < 2;
      if (asleep) leg.rotation.x = front ? -1.3 : 1.3;
      else if (front && this.rear > 0.3) leg.rotation.x = -1.2 - Math.sin(this.phase * 2) * 0.4 * (this.state === 'dance' ? 1 : 0.2);
      else leg.rotation.x = (i % 2 === 0 ? swing : -swing) * (front ? 1 : -1);
    });
    if (asleep) this.torso.position.y += Math.sin(this.phase * 0.6) * 0.02;
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
