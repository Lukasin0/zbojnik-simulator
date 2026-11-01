import * as THREE from 'three';
import { COMPANION_TUNING as T } from '@/config/constants';
import type { CharacterLook } from '@/components/character-model';
import type { GroundProvider } from '@/components/physics-body';
import type { HitSource } from '@/systems/combat-system';
import type { CompanionId } from '@/types/game-types';
import { Actor } from './actor';
import type { Pandur } from './enemy';
import { NPC_ATTACKS } from './attacks';

export interface CompanionContext {
  world: GroundProvider;
  leader: Actor;
  leaderYaw: number;
  enemies: Pandur[];
  combat: boolean;
  onStrike(c: Companion, target: Pandur): void;
}

/** A recruited member of the družina. Follows the captain and fights alerted pandúri. */
export class Companion extends Actor {
  readonly faction = 'zbojnik' as const;
  downed = false;
  private cooldown = 0;
  private downTimer = 0;
  private target: Pandur | null = null;
  private struck = false;
  private swing = Math.floor(Math.random() * 3);

  constructor(
    readonly id: CompanionId,
    readonly displayName: string,
    look: CharacterLook,
    parent: THREE.Object3D,
    readonly slot: { side: number; back: number },
  ) {
    super(look, parent, T.hp);
    this.body.radius = 0.38;
  }

  override isAlive(): boolean {
    return !this.downed && this.hp > 0;
  }

  receiveHit(damage: number, from: THREE.Vector3, source: HitSource): void {
    if (this.downed || source === 'player' || source === 'companion') return;
    this.hp = Math.max(0, this.hp - damage);
    this.knockback(from, 3);
    this.cancelEmote();
    if (this.hp <= 0) {
      this.downed = true;
      this.downTimer = 0;
      this.pose = 'downed';
      this.attackT = -1;
    }
  }

  reviveFull(): void {
    this.downed = false;
    this.hp = this.maxHp;
    this.pose = 'normal';
  }

  update(dt: number, ctx: CompanionContext): void {
    this.beginTick();
    this.cooldown = Math.max(0, this.cooldown - dt);
    let vx = 0;
    let vz = 0;

    if (this.downed) {
      this.downTimer += dt;
      if (!ctx.combat && this.downTimer > 4) {
        this.downed = false;
        this.hp = Math.round(this.maxHp * 0.4);
        this.pose = 'normal';
      }
      this.body.steer(0, 0, 8, dt);
      this.body.integrate(dt, ctx.world);
      return;
    }

    // dancing / waving along with the captain – a fight ends the fun
    this.tickEmote(dt);
    if (ctx.combat) this.cancelEmote();
    if (this.emoting) {
      this.faceTowards(ctx.leader.position, 4, dt);
      this.body.steer(0, 0, 8, dt);
      this.body.integrate(dt, ctx.world);
      return;
    }

    if (this.attackT >= 0) {
      this.attackT += dt / 0.55;
      if (!this.struck && this.attackT > 0.55) {
        this.struck = true;
        if (this.target && this.target.isAlive() && this.target.position.distanceTo(this.position) < T.range + 0.6) {
          ctx.onStrike(this, this.target);
        }
      }
      if (this.attackT >= 1) this.attackT = -1;
    }

    // choose a fight target near the captain
    this.target = null;
    if (ctx.combat) {
      let best = 18;
      for (const e of ctx.enemies) {
        if (!e.isAlive() || !e.alerted) continue;
        const d = e.position.distanceTo(this.position);
        if (d < best && e.position.distanceTo(ctx.leader.position) < 25) {
          best = d;
          this.target = e;
        }
      }
    }

    if (this.target) {
      const tp = this.target.position;
      const dx = tp.x - this.position.x;
      const dz = tp.z - this.position.z;
      const d = Math.hypot(dx, dz);
      this.turnTowards(Math.atan2(dx, dz), 10, dt);
      if (d > T.range * 0.85) {
        vx = (dx / d) * T.runSpeed;
        vz = (dz / d) * T.runSpeed;
      } else if (this.cooldown <= 0 && this.attackT < 0) {
        this.attackT = 0;
        this.struck = false;
        this.attackKind = NPC_ATTACKS[this.swing++ % NPC_ATTACKS.length];
        this.cooldown = T.cooldown + Math.random() * 0.4;
      }
    } else {
      // formation slot behind the captain
      const yaw = ctx.leaderYaw;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const gx = ctx.leader.position.x - fx * this.slot.back - fz * this.slot.side;
      const gz = ctx.leader.position.z - fz * this.slot.back + fx * this.slot.side;
      const dx = gx - this.position.x;
      const dz = gz - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 40) {
        this.teleport(gx, gz, ctx.world);
        return;
      }
      if (d > 1.2) {
        const sp = d > 7 ? T.runSpeed : Math.min(T.speed, d * 1.6);
        vx = (dx / d) * sp;
        vz = (dz / d) * sp;
        this.turnTowards(Math.atan2(dx, dz), 8, dt);
      } else {
        this.turnTowards(yaw, 3, dt);
      }
    }

    this.body.steer(vx, vz, 9, dt);
    if (this.body.onGround && ctx.leader.body.velocity.y > 5 && ctx.leader.position.distanceTo(this.position) < 6) {
      this.body.velocity.y = 8;
    }
    this.body.integrate(dt, ctx.world);
  }
}
