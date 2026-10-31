import * as THREE from 'three';
import { CharacterModel, type AnimParams, type CharacterLook, type Pose } from '@/components/character-model';
import { PhysicsBody, type GroundProvider } from '@/components/physics-body';
import type { HitSource, Hittable } from '@/systems/combat-system';
import type { Faction } from '@/types/game-types';
import { angleDiff, damp } from '@/utils/math-utils';

/** Base class for every character: physics body + procedural model + health. */
export abstract class Actor implements Hittable {
  readonly body = new PhysicsBody();
  readonly model: CharacterModel;
  readonly hitHeight = 1.8;
  abstract readonly faction: Faction;
  facing = 0;
  private prevFacing = 0;
  hp: number;
  maxHp: number;
  pose: Pose = 'normal';
  protected attackT = -1;
  protected aimT = 0;
  protected hurtT = 0;
  talking = false;

  constructor(look: CharacterLook, parent: THREE.Object3D, hp: number) {
    this.model = new CharacterModel(look);
    parent.add(this.model.root);
    this.hp = hp;
    this.maxHp = hp;
  }

  get position(): THREE.Vector3 {
    return this.body.position;
  }

  get radius(): number {
    return this.body.radius;
  }

  isAlive(): boolean {
    return this.hp > 0;
  }

  abstract receiveHit(damage: number, from: THREE.Vector3, source: HitSource): void;

  /** Call at the start of every fixed tick for render interpolation. */
  beginTick(): void {
    this.body.storePrev();
    this.prevFacing = this.facing;
  }

  teleport(x: number, z: number, world: GroundProvider): void {
    this.body.teleport(x, z, world);
    this.model.root.position.copy(this.body.position);
  }

  turnTowards(yaw: number, lambda: number, dt: number): void {
    this.facing += angleDiff(this.facing, yaw) * (1 - Math.exp(-lambda * dt));
  }

  faceTowards(target: THREE.Vector3, lambda: number, dt: number): void {
    this.turnTowards(Math.atan2(target.x - this.position.x, target.z - this.position.z), lambda, dt);
  }

  /** Knock back away from a point. */
  knockback(from: THREE.Vector3, strength: number): void {
    const dx = this.position.x - from.x;
    const dz = this.position.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    this.body.velocity.x += (dx / d) * strength;
    this.body.velocity.z += (dz / d) * strength;
    this.hurtT = 1;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  protected animParams(): AnimParams {
    return {
      speed: this.body.horizontalSpeed,
      onGround: this.body.onGround,
      attack: this.attackT,
      aim: this.aimT,
      pose: this.pose,
      hurt: this.hurtT,
      talking: this.talking,
    };
  }

  /** Interpolate the visual between the last two simulation states and animate. */
  render(alpha: number, frameDt: number): void {
    const root = this.model.root;
    root.position.lerpVectors(this.body.prev, this.body.position, alpha);
    root.rotation.y = this.prevFacing + angleDiff(this.prevFacing, this.facing) * alpha;
    this.hurtT = damp(this.hurtT, 0, 6, frameDt);
    this.model.update(frameDt, this.animParams());
  }

  dispose(): void {
    this.model.dispose();
  }
}
