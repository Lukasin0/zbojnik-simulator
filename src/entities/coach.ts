import * as THREE from 'three';
import { COACH_SPEED } from '@/config/constants';
import { CharacterModel } from '@/components/character-model';
import { createCoachModel } from '@/world/props';
import { roadZ } from '@/world/terrain';
import { KOCIS } from './looks';

export type CoachState = 'driving' | 'stopped' | 'looted';

/** Panský koč driving along the hradská by the Váh. */
export class Coach {
  readonly root: THREE.Group;
  readonly position = new THREE.Vector3();
  private readonly prev = new THREE.Vector3();
  facing = 0;
  private prevFacing = 0;
  state: CoachState = 'driving';
  /** +1 = east, -1 = west */
  dir: 1 | -1;
  x: number;
  private readonly wheels: THREE.Object3D[];
  private readonly legs: THREE.Object3D[];
  private readonly driver: CharacterModel;
  private wheelAngle = 0;
  private gait = 0;
  speed = 0;

  constructor(parent: THREE.Object3D, startX: number, dir: 1 | -1, groundAt: (x: number, z: number) => number) {
    const built = createCoachModel();
    this.root = built.root;
    this.wheels = built.wheels;
    this.legs = built.legs;
    this.driver = new CharacterModel(KOCIS);
    this.driver.root.position.set(0, 1.0, 1.75);
    this.root.add(this.driver.root);
    parent.add(this.root);
    this.dir = dir;
    this.x = startX;
    this.place(groundAt);
    this.prev.copy(this.position);
    this.prevFacing = this.facing;
  }

  private place(groundAt: (x: number, z: number) => number): void {
    const z = roadZ(this.x);
    this.position.set(this.x, groundAt(this.x, z), z);
    const ahead = roadZ(this.x + this.dir * 2);
    this.facing = Math.atan2(this.dir * 2, ahead - z);
  }

  /** Point on the road `ahead` metres in front of the coach and `side` metres to its right. */
  offsetPoint(ahead: number, side: number, out: THREE.Vector3): THREE.Vector3 {
    const fx = Math.sin(this.facing);
    const fz = Math.cos(this.facing);
    return out.set(this.position.x + fx * ahead - fz * side, 0, this.position.z + fz * ahead + fx * side);
  }

  update(dt: number, wantsToDrive: boolean, groundAt: (x: number, z: number) => number): void {
    this.prev.copy(this.position);
    this.prevFacing = this.facing;
    const target = wantsToDrive && this.state === 'driving' ? COACH_SPEED : 0;
    this.speed += (target - this.speed) * (1 - Math.exp(-2.5 * dt));
    this.x += this.dir * this.speed * dt;
    this.place(groundAt);
    this.wheelAngle += (this.speed * dt) / 0.55;
    this.gait += this.speed * dt * 2.2;
  }

  render(alpha: number, time: number): void {
    this.root.position.lerpVectors(this.prev, this.position, alpha);
    this.root.rotation.y = this.prevFacing + (this.facing - this.prevFacing) * alpha;
    for (const w of this.wheels) w.rotation.x = this.wheelAngle;
    const moving = Math.min(1, this.speed / 2);
    this.legs.forEach((l, i) => {
      l.rotation.x = Math.sin(this.gait + (i % 2 === 0 ? 0 : Math.PI) + (i > 3 ? 0.5 : 0)) * 0.5 * moving;
    });
    this.driver.update(1 / 60, {
      speed: 0,
      onGround: true,
      attack: -1,
      aim: 0,
      pose: this.state === 'driving' ? 'sit' : 'sleep',
      hurt: Math.sin(time * 2) * 0.05,
    });
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
