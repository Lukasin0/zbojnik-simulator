import * as THREE from 'three';
import type { HitSource, Hittable } from '@/systems/combat-system';
import { createDummy, createSpruceGeometries, createTarget } from './props';
import { at, mat, part } from './materials';
import { easeInQuad } from '@/utils/math-utils';

/** Straw nobleman for sword practice on Rovná hora. */
export class TrainingDummy implements Hittable {
  readonly position: THREE.Vector3;
  readonly radius = 0.45;
  readonly hitHeight = 2.0;
  readonly faction = 'prop' as const;
  readonly group: THREE.Group;
  private hp = 2;
  private wobble = 0;
  onDestroyed: (() => void) | null = null;
  onHit: ((pos: THREE.Vector3) => void) | null = null;

  constructor(x: number, y: number, z: number, facing: number) {
    this.position = new THREE.Vector3(x, y, z);
    this.group = createDummy();
    this.group.position.copy(this.position);
    this.group.rotation.y = facing;
  }

  isAlive(): boolean {
    return this.hp > 0;
  }

  receiveHit(_damage: number, _from: THREE.Vector3, source: HitSource): void {
    if (source === 'shot' || this.hp <= 0) return;
    this.hp--;
    this.wobble = 1;
    this.onHit?.(this.position);
    if (this.hp <= 0) {
      this.group.visible = false;
      this.onDestroyed?.();
    }
  }

  setDestroyed(): void {
    this.hp = 0;
    this.group.visible = false;
  }

  update(dt: number, time: number): void {
    if (this.wobble <= 0) return;
    this.wobble = Math.max(0, this.wobble - dt * 1.6);
    this.group.rotation.z = Math.sin(time * 30) * 0.25 * this.wobble;
  }
}

/** Round shooting target – only a musket ball knocks it over. */
export class ShootingTarget implements Hittable {
  readonly position: THREE.Vector3;
  readonly radius = 0.6;
  readonly hitHeight = 2.0;
  readonly faction = 'prop' as const;
  readonly group: THREE.Group;
  private standing = true;
  private fall = 0;
  onDestroyed: (() => void) | null = null;

  constructor(x: number, y: number, z: number, facing: number) {
    this.position = new THREE.Vector3(x, y, z);
    this.group = createTarget();
    this.group.position.copy(this.position);
    this.group.rotation.y = facing;
  }

  isAlive(): boolean {
    return this.standing;
  }

  receiveHit(_damage: number, _from: THREE.Vector3, source: HitSource): void {
    if (source !== 'shot' || !this.standing) return;
    this.standing = false;
    this.onDestroyed?.();
  }

  setDestroyed(): void {
    this.standing = false;
    this.fall = 1;
    this.group.rotation.x = -Math.PI / 2;
  }

  update(dt: number): void {
    if (this.standing || this.fall >= 1) return;
    this.fall = Math.min(1, this.fall + dt * 2.5);
    this.group.rotation.x = -easeInQuad(this.fall) * (Math.PI / 2);
  }
}

/** The marked spruce next to the road – fell it to block the coach. */
export class AmbushTree implements Hittable {
  readonly position: THREE.Vector3;
  readonly radius = 0.5;
  readonly hitHeight = 2.5;
  readonly faction = 'prop' as const;
  readonly group = new THREE.Group();
  private hp = 5;
  private falling = 0;
  private shake = 0;
  cuttable = false;
  fallen = false;
  onChop: ((pos: THREE.Vector3, left: number) => void) | null = null;
  onBlocked: (() => void) | null = null;
  onFallen: (() => void) | null = null;
  private readonly pivot = new THREE.Group();

  constructor(x: number, y: number, z: number) {
    this.position = new THREE.Vector3(x, y, z);
    this.group.position.copy(this.position);
    const { trunk, crown } = createSpruceGeometries();
    const t = part(trunk, 0x5a3c26);
    t.scale.set(1.5, 4.0, 1.5);
    const c = part(crown, 0x2f4f2a);
    c.scale.set(1.2, 1.9, 1.2);
    c.position.y = 2.2;
    this.pivot.add(t, c);
    // red ribbon – the mark of the ambush
    this.pivot.add(at(part(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 8), 0xb3261e, { emissive: 0x501010 }), 0, 1.6, 0));
    this.group.add(this.pivot);
    this.group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.4, 7), mat(0x7a5a3a)), 0, 0.2, 0));
  }

  isAlive(): boolean {
    return !this.fallen && this.falling === 0;
  }

  receiveHit(_damage: number, _from: THREE.Vector3, source: HitSource): void {
    if (source !== 'player' || !this.isAlive()) return;
    if (!this.cuttable) {
      this.onBlocked?.();
      return;
    }
    this.hp--;
    this.shake = 1;
    this.onChop?.(this.position, this.hp);
    if (this.hp <= 0) this.falling = 0.0001;
  }

  /** Instantly lay the tree across the road (loading a save). */
  setFallen(on: boolean): void {
    this.fallen = on;
    this.falling = 0;
    this.hp = on ? 0 : 5;
    this.pivot.rotation.x = on ? Math.PI / 2 - 0.08 : 0;
  }

  update(dt: number, time: number): void {
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3);
      this.pivot.rotation.z = Math.sin(time * 40) * 0.03 * this.shake;
    }
    if (this.falling > 0 && !this.fallen) {
      this.falling = Math.min(1, this.falling + dt * 0.8);
      this.pivot.rotation.x = easeInQuad(this.falling) * (Math.PI / 2 - 0.08);
      if (this.falling >= 1) {
        this.fallen = true;
        this.onFallen?.();
      }
    }
  }
}
