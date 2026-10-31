import * as THREE from 'three';
import { GRAVITY } from '@/config/constants';
import { damp } from '@/utils/math-utils';

export interface GroundProvider {
  groundHeight(x: number, z: number): number;
  /** Push a circle out of static colliders; returns true when something was hit. */
  resolveCircle(p: THREE.Vector3, radius: number): boolean;
  clampToBounds(p: THREE.Vector3): void;
}

/** Kinematic body: gravity, ground snapping, static collision and play-area bounds. */
export class PhysicsBody {
  readonly position = new THREE.Vector3();
  readonly prev = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  radius = 0.4;
  onGround = true;
  collides = true;

  storePrev(): void {
    this.prev.copy(this.position);
  }

  teleport(x: number, z: number, world: GroundProvider): void {
    this.position.set(x, world.groundHeight(x, z), z);
    this.prev.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.onGround = true;
  }

  /** Smoothly steer horizontal velocity toward a target. */
  steer(vx: number, vz: number, accel: number, dt: number): void {
    this.velocity.x = damp(this.velocity.x, vx, accel, dt);
    this.velocity.z = damp(this.velocity.z, vz, accel, dt);
  }

  integrate(dt: number, world: GroundProvider): void {
    this.velocity.y += GRAVITY * dt;
    this.position.addScaledVector(this.velocity, dt);
    if (this.collides) world.resolveCircle(this.position, this.radius);
    world.clampToBounds(this.position);
    const ground = world.groundHeight(this.position.x, this.position.z);
    const snap = this.onGround && this.velocity.y <= 0 && this.position.y - ground < 0.45;
    if (this.position.y <= ground || snap) {
      this.position.y = ground;
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  get horizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }
}
