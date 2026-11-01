import * as THREE from 'three';
import type { CharacterLook, Pose } from '@/components/character-model';
import type { GroundProvider } from '@/components/physics-body';
import type { NpcId } from '@/types/game-types';
import { Actor } from './actor';

/** Villagers with a home walk to their door in the evening and come out again in the morning. */
export interface SleepSchedule {
  /** spot right in front of the house door */
  door: THREE.Vector3;
  bedtime: number;
  wakeup: number;
}

type Routine = 'out' | 'goingHome' | 'asleep' | 'woken';

function isBedtime(hour: number, s: SleepSchedule): boolean {
  return s.bedtime > s.wakeup ? hour >= s.bedtime || hour < s.wakeup : hour >= s.bedtime && hour < s.wakeup;
}

/** Villager / quest giver; turns to face the captain when near, keeps a day & night routine. */
export class Npc extends Actor {
  readonly faction = 'zbojnik' as const;
  private readonly home = new THREE.Vector3();
  private readonly homeYaw: number;
  private wanderTimer = Math.random() * 5;
  private readonly wanderGoal = new THREE.Vector3();
  private schedule: SleepSchedule | null = null;
  private routine: Routine = 'out';
  private routineTimer = 0;

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

  /** Give the villager a house to sleep in (hours may wrap past midnight). */
  sleepsAt(door: THREE.Vector3, bedtime: number, wakeup: number): this {
    this.schedule = { door, bedtime, wakeup };
    return this;
  }

  get asleep(): boolean {
    return this.routine === 'asleep';
  }

  get door(): THREE.Vector3 | null {
    return this.schedule?.door ?? null;
  }

  override isAlive(): boolean {
    return true;
  }

  receiveHit(): void {
    /* villagers are not valid targets */
  }

  /** Somebody bangs on the door at night – the villager comes out for a while, grumbling. */
  knock(world: GroundProvider, from: THREE.Vector3): void {
    if (this.routine !== 'asleep') return;
    this.appear(world);
    this.facing = Math.atan2(from.x - this.position.x, from.z - this.position.z);
    this.routine = 'woken';
    this.routineTimer = 40;
  }

  update(dt: number, world: GroundProvider, playerPos: THREE.Vector3, hour = 12): void {
    this.beginTick();
    const s = this.schedule;
    if (s) {
      const bed = isBedtime(hour, s);
      if (this.routine === 'asleep') {
        if (bed) return;
        this.appear(world);
        this.routine = 'out';
      } else if (this.routine === 'woken') {
        this.routineTimer -= dt;
        if (this.routineTimer <= 0 && playerPos.distanceTo(this.position) > 5) this.routine = bed ? 'goingHome' : 'out';
      } else if (bed !== (this.routine === 'goingHome')) {
        this.routine = bed ? 'goingHome' : 'out';
        this.routineTimer = 0;
      }
    }
    const wasEmoting = this.emoting;
    this.tickEmote(dt);
    if (wasEmoting && !this.emoting) this.pose = this.basePose;
    const near = playerPos.distanceTo(this.position) < 6;
    let vx = 0;
    let vz = 0;
    const walkTo = (x: number, z: number, speed: number): number => {
      const dx = x - this.position.x;
      const dz = z - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.5) {
        vx = (dx / d) * speed;
        vz = (dz / d) * speed;
        this.turnTowards(Math.atan2(dx, dz), 4, dt);
      }
      return d;
    };
    if (s && this.routine === 'goingHome') {
      this.routineTimer += dt;
      const d = walkTo(s.door.x, s.door.z, 1.6);
      // nobody watches – or the way is blocked: just be home already
      if (d < 0.8 || this.routineTimer > 40 || playerPos.distanceTo(this.position) > 60) this.goInside(world);
    } else if (near && this.basePose === 'normal') {
      this.faceTowards(playerPos, 5, dt);
    } else if (this.routine === 'woken') {
      this.turnTowards(this.homeYaw, 2, dt);
    } else if (this.wanderRadius > 0) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 4 + Math.random() * 6;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * this.wanderRadius;
        this.wanderGoal.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
      }
      walkTo(this.wanderGoal.x, this.wanderGoal.z, 1.3);
    } else if (this.basePose === 'normal' && walkTo(this.home.x, this.home.z, 1.4) <= 0.5) {
      this.turnTowards(this.homeYaw, 2, dt);
    }
    if (this.basePose === 'normal') {
      this.body.steer(vx, vz, 6, dt);
      this.body.integrate(dt, world);
    }
  }

  private goInside(world: GroundProvider): void {
    if (!this.schedule) return;
    this.routine = 'asleep';
    this.cancelEmote();
    this.teleport(this.schedule.door.x, this.schedule.door.z, world);
    this.model.setVisible(false);
    this.body.collides = false;
  }

  private appear(world: GroundProvider): void {
    if (!this.schedule) return;
    this.teleport(this.schedule.door.x, this.schedule.door.z, world);
    this.model.setVisible(true);
    this.body.collides = this.basePose === 'normal';
  }
}
