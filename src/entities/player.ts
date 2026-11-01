import * as THREE from 'three';
import { PLAYER_TUNING as T } from '@/config/constants';
import type { GroundProvider } from '@/components/physics-body';
import type { PlayerIntent } from '@/components/input-handler';
import type { HitSource } from '@/systems/combat-system';
import { Cooldown } from '@/utils/timer';
import { damp } from '@/utils/math-utils';
import { Actor } from './actor';
import { COMBO, COMBO_WINDOW, HEAVY, type AttackDef } from './attacks';
import { JANOSIK } from './looks';

export interface PlayerWorld extends GroundProvider {
  isMud(x: number, z: number): boolean;
  waterDepth(x: number, z: number): number;
}

export interface PlayerHooks {
  onSwing(p: Player, attack: AttackDef): void;
  onMeleeHit(p: Player, attack: AttackDef): void;
  onShoot(p: Player): void;
  onJump(p: Player): void;
  onHurt(p: Player, amount: number): void;
  onNoStamina(): void;
  onReloading(): void;
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
  /** Holding the shoot button – the camera goes over the shoulder. */
  aiming = false;
  krpce = false;
  damageBonus = 0;
  /** The attack being swung right now. */
  current: AttackDef | null = null;
  private hitDone = false;
  private lunged = false;
  /** Index of the next combo step. */
  private comboStep = 0;
  private sinceAttack = 99;
  private queued = false;
  private readonly shootCd = new Cooldown(T.shootCooldown);
  private staminaDelay = 0;
  private invuln = 0;
  private aimHold = 0;

  constructor(parent: THREE.Object3D) {
    super(JANOSIK, parent, T.baseHp);
    this.body.radius = 0.38;
  }

  get attacking(): boolean {
    return this.current !== null;
  }

  /** 0..1 progress of the current swing (-1 when idle). */
  get swingProgress(): number {
    return this.attackT;
  }

  get reloadProgress(): number {
    return this.shootCd.progress;
  }

  private canPay(cost: number, hooks: PlayerHooks): boolean {
    if (this.godMode || this.stamina >= cost) return true;
    hooks.onNoStamina();
    return false;
  }

  private startAttack(def: AttackDef, aimYaw: number, hooks: PlayerHooks): void {
    this.current = def;
    this.attackKind = def.anim;
    this.attackT = 0;
    this.hitDone = false;
    this.lunged = false;
    this.queued = false;
    this.facing = aimYaw;
    if (!this.godMode) this.stamina -= def.stamina;
    this.staminaDelay = T.staminaRegenDelay;
    hooks.onSwing(this, def);
  }

  update(dt: number, intent: PlayerIntent, world: PlayerWorld, hooks: PlayerHooks): void {
    this.beginTick();
    if (!this.isAlive()) {
      this.aiming = false;
      this.current = null;
      this.body.steer(0, 0, 8, dt);
      this.body.integrate(dt, world);
      return;
    }
    this.shootCd.update(dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.staminaDelay = Math.max(0, this.staminaDelay - dt);
    this.raz = Math.max(0, this.raz - T.razDecay * dt);
    this.tickEmote(dt);

    const moving = intent.magnitude > 0.1;
    // any real action interrupts a dance or a wave
    if (this.emoting && (moving || intent.attack || intent.heavy || intent.jump || intent.aim)) this.cancelEmote();

    const p = this.body.position;
    let speedMul = 1;
    if (world.isMud(p.x, p.z)) speedMul *= this.krpce ? T.mudSlowKrpce : T.mudSlow;
    if (world.waterDepth(p.x, p.z) > 0.3) speedMul *= T.waterSlow;
    if (this.krpce) speedMul *= 1.08;
    if (this.attacking) speedMul *= 0.35;
    this.aiming = intent.aim && !this.attacking;
    if (this.aiming) {
      speedMul *= 0.5;
      this.aimHold = Math.max(this.aimHold, 0.15);
    }

    this.sprinting = intent.sprint && moving && this.stamina > 1 && !this.attacking && !this.aiming;
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

    if (intent.jump && this.body.onGround && !this.attacking) {
      if (this.canPay(T.jumpCost, hooks)) {
        this.body.velocity.y = this.sprinting ? T.sprintJumpVelocity : T.jumpVelocity;
        this.body.onGround = false;
        if (!this.godMode) this.stamina -= T.jumpCost;
        this.staminaDelay = T.staminaRegenDelay;
        hooks.onJump(this);
      }
    }

    this.updateMelee(dt, intent, hooks);

    if (intent.shoot && !this.attacking) {
      if (this.shootCd.ready) {
        this.shootCd.trigger();
        this.facing = intent.aimYaw;
        this.aimHold = 0.45;
        hooks.onShoot(this);
      } else {
        hooks.onReloading();
      }
    }
    this.aimHold = Math.max(0, this.aimHold - dt);
    this.aimT = damp(this.aimT, this.aimHold > 0 ? 1 : 0, 18, dt);

    const regen = this.pose === 'sit' ? T.staminaRegen * 2 : T.staminaRegen;
    if (this.staminaDelay <= 0) this.stamina = Math.min(this.maxStamina, this.stamina + regen * dt);
    if (this.godMode) this.hp = this.maxHp;

    this.body.integrate(dt, world);
  }

  /** Three-hit combo on the light attack, spinning heavy blow on the other button. */
  private updateMelee(dt: number, intent: PlayerIntent, hooks: PlayerHooks): void {
    this.sinceAttack += dt;
    if (this.sinceAttack > COMBO_WINDOW && !this.attacking) this.comboStep = 0;

    if (!this.attacking) {
      if (intent.heavy) {
        if (this.canPay(HEAVY.stamina, hooks)) this.startAttack(HEAVY, intent.aimYaw, hooks);
      } else if (intent.attack) {
        const def = COMBO[this.comboStep % COMBO.length];
        if (this.canPay(def.stamina, hooks)) this.startAttack(def, intent.aimYaw, hooks);
      }
    } else if (intent.attack && this.current !== HEAVY && this.attackT > 0.3) {
      // buffer the next click so the combo flows
      this.queued = true;
    }

    const cur = this.current;
    if (!cur) return;
    this.attackT += dt / cur.duration;

    // short step into the swing
    if (!this.lunged && this.attackT >= cur.hitAt - 0.15) {
      this.lunged = true;
      this.body.velocity.x += Math.sin(this.facing) * cur.lunge;
      this.body.velocity.z += Math.cos(this.facing) * cur.lunge;
    }
    if (!this.hitDone && this.attackT >= cur.hitAt) {
      this.hitDone = true;
      hooks.onMeleeHit(this, cur);
    }

    const comboIndex = COMBO.indexOf(cur);
    const isLast = comboIndex === COMBO.length - 1;
    // a buffered click cancels the recovery into the next combo step
    const chain = this.queued && comboIndex >= 0 && !isLast && this.attackT >= 0.72;
    if (this.attackT >= 1 || chain) {
      this.current = null;
      this.attackT = -1;
      this.sinceAttack = 0;
      this.comboStep = comboIndex >= 0 && !isLast ? comboIndex + 1 : 0;
      if (chain) {
        const next = COMBO[this.comboStep];
        if (this.canPay(next.stamina, hooks)) this.startAttack(next, intent.aimYaw, hooks);
        else this.comboStep = 0;
      }
    }
  }

  get damage(): number {
    return (T.baseDamage + this.damageBonus) * (1 + this.raz / 100);
  }

  receiveHit(damage: number, from: THREE.Vector3, source: HitSource): void {
    if (!this.isAlive() || this.invuln > 0 || this.godMode) return;
    if (source === 'player' || source === 'companion') return;
    this.cancelEmote();
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
    this.current = null;
    this.attackT = -1;
    this.stamina = this.maxStamina;
  }
}
