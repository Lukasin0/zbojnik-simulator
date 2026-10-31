import * as THREE from 'three';
import type { CharacterLook, Pose } from '@/components/character-model';
import type { GroundProvider } from '@/components/physics-body';
import type { NpcId } from '@/types/game-types';
import { Actor } from './actor';

/** Stationary villager / quest giver; turns to face the captain when near. */
export class Npc extends Actor {
  readonly faction = 'zbojnik' as const;
  private readonly home = new THREE.Vector3();
  private readonly homeYaw: number;
  private wanderTimer = Math.random() * 5;
  private readonly wanderGoal = new THREE.Vector3();

  constructor(
    readonly id: NpcId,
    readonly displayName: string,
    look: CharacterLook,
    parent: THREE.Object3D,
    x: number,
    z: number,
    yaw: number,
    world: GroundProvider,
    readonly basePose: Pose = 'normal',
    readonly wanderRadius = 0,
  ) {
    super(look, parent, 100);
    this.body.radius = 0.4;
    this.teleport(x, z, world);
    this.home.copy(this.position);
    this.wanderGoal.copy(this.home);
    this.facing = yaw;
    this.homeYaw = yaw;
    this.pose = basePose;
    this.body.collides = basePose === 'normal';
  }

  override isAlive(): boolean {
    return true;
  }

  receiveHit(): void {
    /* villagers are not valid targets */
  }

  update(dt: number, world: GroundProvider, playerPos: THREE.Vector3): void {
    this.beginTick();
    const near = playerPos.distanceTo(this.position) < 6;
    let vx = 0;
    let vz = 0;
    if (near && this.basePose === 'normal') {
      this.faceTowards(playerPos, 5, dt);
    } else if (this.wanderRadius > 0) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 4 + Math.random() * 6;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * this.wanderRadius;
        this.wanderGoal.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
      }
      const dx = this.wanderGoal.x - this.position.x;
      const dz = this.wanderGoal.z - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.5) {
        vx = (dx / d) * 1.3;
        vz = (dz / d) * 1.3;
        this.turnTowards(Math.atan2(dx, dz), 4, dt);
      }
    } else {
      this.turnTowards(this.homeYaw, 2, dt);
    }
    if (this.basePose === 'normal') {
      this.body.steer(vx, vz, 6, dt);
      this.body.integrate(dt, world);
    }
  }
}
