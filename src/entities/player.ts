import * as THREE from 'three';
import { PLAYER_TUNING as T } from '@/config/constants';
import type { GroundProvider } from '@/components/physics-body';
import type { PlayerIntent } from '@/components/input-handler';
import type { HitSource } from '@/systems/combat-system';
import { Cooldown } from '@/utils/timer';
import { damp } from '@/utils/math-utils';
import { Actor } from './actor';
import { JANOSIK } from './looks';

export interface PlayerWorld extends GroundProvider {
  isMud(x: number, z: number): boolean;
  waterDepth(x: number, z: number): number;
}

export interface PlayerHooks {
  onSwing(p: Player): void;
  onMeleeHit(p: Player): void;
  onShoot(p: Player): void;
  onJump(p: Player): void;
  onHurt(p: Player, amount: number): void;
  onNoStamina(): void;
}

/** Juraj Jánošík – controlled by the player. */
export class Player extends Actor {
  readonly faction = 'zbojnik' as const;
  stamina: number = T.maxStamina;
  readonly maxStamina = T.maxStamina;
  /** Morálka / ráž 0..100 – bonus damage */
  raz = 10;
  godMode = false;
  sprinting = false;
  krpce = false;
  damageBonus = 0;
  private hitDone = false;
  private readonly shootCd = new Cooldown(T.shootCooldown);
  private staminaDelay = 0;
  private invuln = 0;
  private aimHold = 0;

  constructor(parent: THREE.Object3D) {
    super(JANOSIK, parent, T.baseHp);
    this.body.radius = 0.38;
  }

  get attacking(): boolean {
    return this.attackT >= 0;
  }

  get reloadProgress(): number {
    return this.shootCd.progress;
  }

  update(dt: number, intent: PlayerIntent, world: PlayerWorld, hooks: PlayerHooks): void {
    this.beginTick();
    if (!this.isAlive()) {
      this.body.steer(0, 0, 8, dt);
      this.body.integrate(dt, world);
      return;
    }
    this.shootCd.update(dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.staminaDelay = Math.max(0, this.staminaDelay - dt);
    this.raz = Math.max(0, this.raz - T.razDecay * dt);

    const p = this.body.position;
    let speedMul = 1;
    if (world.isMud(p.x, p.z)) speedMul *= this.krpce ? T.mudSlowKrpce : T.mudSlow;
    if (world.waterDepth(p.x, p.z) > 0.3) speedMul *= T.waterSlow;
    if (this.krpce) speedMul *= 1.08;
    if (this.attacking) speedMul *= 0.45;

    const moving = intent.magnitude > 0.1;
    this.sprinting = intent.sprint && moving && this.stamina > 1 && !this.attacking;
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - T.sprintCost * dt);
      this.staminaDelay = T.staminaRegenDelay;
    }
    const speed = (this.sprinting ? T.sprintSpeed : T.walkSpeed) * speedMul;
    const accel = this.body.onGround ? 12 : 3;
    this.body.steer(intent.moveX * speed, intent.moveZ * speed, accel, dt);

    if (this.attacking || this.aimHold > 0) {
      this.turnTowards(intent.aimYaw, 18, dt);
    } else if (moving) {
      this.turnTowards(Math.atan2(intent.moveX, intent.moveZ), 12, dt);
    }

    if (intent.jump && this.body.onGround) {
      if (this.stamina >= T.jumpCost || this.godMode) {
        this.body.velocity.y = this.sprinting ? T.sprintJumpVelocity : T.jumpVelocity;
        this.body.onGround = false;
        this.stamina -= this.godMode ? 0 : T.jumpCost;
        this.staminaDelay = T.staminaRegenDelay;
        hooks.onJump(this);
      } else hooks.onNoStamina();
    }

    if (intent.attack && !this.attacking) {
      if (this.stamina >= T.attackCost || this.godMode) {
        this.attackT = 0;
        this.hitDone = false;
        this.facing = intent.aimYaw;
        this.stamina -= this.godMode ? 0 : T.attackCost;
        this.staminaDelay = T.staminaRegenDelay;
        hooks.onSwing(this);
      } else hooks.onNoStamina();
    }
    if (this.attacking) {
      this.attackT += dt / T.attackDuration;
      if (!this.hitDone && this.attackT >= T.attackHitAt / T.attackDuration) {
        this.hitDone = true;
        hooks.onMeleeHit(this);
      }
      if (this.attackT >= 1) this.attackT = -1;
    }

    if (intent.shoot && this.shootCd.ready && !this.attacking) {
      this.shootCd.trigger();
      this.facing = intent.aimYaw;
      this.aimHold = 0.45;
      hooks.onShoot(this);
    }
    this.aimHold = Math.max(0, this.aimHold - dt);
    this.aimT = damp(this.aimT, this.aimHold > 0 ? 1 : 0, 18, dt);

    if (this.staminaDelay <= 0) this.stamina = Math.min(this.maxStamina, this.stamina + T.staminaRegen * dt);
    if (this.godMode) this.hp = this.maxHp;

    this.body.integrate(dt, world);
  }

  get damage(): number {
    return (T.baseDamage + this.damageBonus) * (1 + this.raz / 100);
  }

  receiveHit(damage: number, from: THREE.Vector3, source: HitSource): void {
    if (!this.isAlive() || this.invuln > 0 || this.godMode) return;
    if (source === 'player' || source === 'companion') return;
    this.hp = Math.max(0, this.hp - damage);
    this.invuln = 0.35;
    this.knockback(from, 4);
    this.onHurt?.(this, damage);
    if (this.hp <= 0) this.pose = 'dead';
  }

  /** Assigned by the game so enemy hits can notify HUD/audio. */
  onHurt: ((p: Player, amount: number) => void) | null = null;

  revive(hpFraction: number): void {
    this.hp = Math.max(1, Math.round(this.maxHp * hpFraction));
    this.pose = 'normal';
    this.attackT = -1;
    this.stamina = this.maxStamina;
  }
}
