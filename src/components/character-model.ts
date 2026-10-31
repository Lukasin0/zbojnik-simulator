import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { damp, easeInQuad, easeOutCubic, lerp } from '@/utils/math-utils';
import { at, part, stripeTexture } from '@/world/materials';

export type HatStyle = 'zbojnik' | 'shako' | 'cap' | 'wig' | 'kerchief' | 'bacov' | 'none';
export type WeaponStyle = 'valaska' | 'saber' | 'staff' | 'none';
export type Pose = 'normal' | 'dead' | 'sit' | 'sleep' | 'cheer' | 'downed';

export interface CharacterLook {
  skin: number;
  hair: number;
  shirt: number;
  pants: number;
  shoes: number;
  socks?: [number, number];
  wideSleeves?: boolean;
  belt?: number;
  beltLevel?: number;
  vest?: number;
  coat?: number;
  coatLong?: boolean;
  trim?: number;
  skirt?: number;
  apron?: number;
  cape?: number;
  hat: HatStyle;
  hatColor?: number;
  feather?: boolean;
  braids?: boolean;
  mustache?: boolean;
  beard?: number;
  weapon: WeaponStyle;
  pistol?: boolean;
  girth?: number;
  height?: number;
}

export interface AnimParams {
  speed: number;
  onGround: boolean;
  /** -1 = no attack, else 0..1 progress */
  attack: number;
  /** 0..1 aim blend (pistol pose) */
  aim: number;
  pose: Pose;
  /** 0..1 flinch */
  hurt: number;
  talking?: boolean;
}

const LEG_TOP = 0.92;

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = parts.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(ng.attributes)) {
      if (name !== 'position' && name !== 'normal') ng.deleteAttribute(name);
    }
    return ng;
  });
  return mergeGeometries(prepared, false) ?? prepared[0];
}

/**
 * Procedural low-poly humanoid. Joints are plain groups so walk, chop, aim,
 * sit, sleep and death poses are animated in code (no rig needed until the
 * Mixamo models arrive).
 */
export class CharacterModel {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly hipL = new THREE.Group();
  private readonly hipR = new THREE.Group();
  private readonly kneeL = new THREE.Group();
  private readonly kneeR = new THREE.Group();
  private readonly shoulderL = new THREE.Group();
  private readonly shoulderR = new THREE.Group();
  private beltGroup = new THREE.Group();
  private featherMesh: THREE.Mesh | null = null;
  private phase = Math.random() * 10;
  private breath = Math.random() * 10;
  private poseBlend = 0;
  private currentPose: Pose = 'normal';
  private stride = 0;
  private air = 0;

  constructor(private readonly look: CharacterLook) {
    const s = look.height ?? 1;
    this.root.scale.setScalar(s);
    this.root.add(this.body);
    this.buildLegs();
    this.body.add(this.torso);
    this.torso.position.y = LEG_TOP;
    this.buildTorso();
    this.buildArms();
    this.buildHead();
  }

  private buildLegs(): void {
    const L = this.look;
    for (const side of [-1, 1]) {
      const hip = side < 0 ? this.hipL : this.hipR;
      const knee = side < 0 ? this.kneeL : this.kneeR;
      hip.position.set(0.11 * side, LEG_TOP, 0);
      this.body.add(hip);
      const thighR = L.wideSleeves ? 0.095 : 0.08;
      hip.add(at(part(new THREE.CylinderGeometry(thighR, 0.075, 0.47, 7), L.pants), 0, -0.22, 0));
      knee.position.y = -0.45;
      hip.add(knee);
      if (L.socks) {
        const tex = stripeTexture(L.socks[0], L.socks[1], 9);
        const sock = part(new THREE.CylinderGeometry(0.068, 0.058, 0.38, 7), 0xffffff, { map: tex });
        sock.position.y = -0.19;
        knee.add(sock);
      } else {
        knee.add(at(part(new THREE.CylinderGeometry(0.07, 0.06, 0.38, 7), L.pants), 0, -0.19, 0));
      }
      const shoe = part(new THREE.BoxGeometry(0.11, 0.07, 0.24), L.shoes);
      shoe.position.set(0, -0.405, 0.04);
      knee.add(shoe);
    }
  }

  private buildTorso(): void {
    const L = this.look;
    const g = L.girth ?? 1;
    const shirt = part(new THREE.CylinderGeometry(0.2, 0.17, 0.56, 8), L.shirt);
    shirt.position.y = 0.3;
    shirt.scale.set(g, 1, g * 0.85);
    this.torso.add(shirt);
    if (L.vest !== undefined) {
      const vest = part(new THREE.CylinderGeometry(0.212, 0.185, 0.42, 8), L.vest);
      vest.position.set(0, 0.34, -0.012);
      vest.scale.set(g, 1, g * 0.87);
      this.torso.add(vest);
    }
    if (L.coat !== undefined) {
      const len = L.coatLong ? 0.95 : 0.6;
      const coat = part(new THREE.CylinderGeometry(0.215, L.coatLong ? 0.27 : 0.22, len, 8), L.coat);
      coat.position.y = 0.58 - len / 2;
      coat.scale.set(g, 1, g * 0.88);
      this.torso.add(coat);
      if (L.trim !== undefined) {
        const buttons: THREE.BufferGeometry[] = [];
        for (let i = 0; i < 4; i++) {
          const b = new THREE.BoxGeometry(0.03, 0.03, 0.02);
          b.translate(0, 0.5 - i * 0.1, 0.2 * g * 0.88 + 0.01);
          buttons.push(b);
        }
        this.torso.add(part(merged(buttons), L.trim, { metalness: 0.6, roughness: 0.4 }));
      }
    }
    if (L.skirt !== undefined) {
      const skirt = part(new THREE.CylinderGeometry(0.2, 0.36, 0.78, 9), L.skirt);
      skirt.position.y = -0.33;
      this.torso.add(skirt);
    }
    if (L.apron !== undefined) {
      const apron = part(new THREE.BoxGeometry(0.3, L.skirt !== undefined ? 0.7 : 0.6, 0.02), L.apron);
      apron.position.set(0, L.skirt !== undefined ? -0.27 : -0.1, (L.skirt !== undefined ? 0.25 : 0.19) * g);
      apron.rotation.x = -0.12;
      this.torso.add(apron);
    }
    if (L.cape !== undefined) {
      const cape = part(new THREE.BoxGeometry(0.56, 0.95, 0.06), L.cape);
      cape.position.set(0, 0.1, -0.2 * g);
      cape.rotation.x = 0.08;
      this.torso.add(cape);
    }
    this.torso.add(this.beltGroup);
    this.setBeltLevel(L.beltLevel ?? 0);
    if (L.pistol) {
      const pistol = new THREE.Group();
      pistol.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.22), 0x4a2c18));
      const barrel = part(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 6), 0x6b6f75, { metalness: 0.7, roughness: 0.35 });
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.03, 0.12);
      pistol.add(barrel);
      pistol.position.set(-0.1, 0.2, 0.23 * g);
      pistol.rotation.set(-0.9, 0.3, 0);
      this.torso.add(pistol);
    }
  }

  /** The famous wide leather belt – wider with each upgrade. */
  setBeltLevel(level: number): void {
    const L = this.look;
    this.torso.remove(this.beltGroup);
    this.beltGroup = new THREE.Group();
    this.torso.add(this.beltGroup);
    if (L.belt === undefined) return;
    const g = L.girth ?? 1;
    const h = 0.16 + level * 0.05;
    const belt = part(new THREE.CylinderGeometry(0.214, 0.205, h, 9), L.belt);
    belt.scale.set(g, 1, g * 0.86);
    belt.position.y = 0.1;
    this.beltGroup.add(belt);
    const buckles: THREE.BufferGeometry[] = [];
    const count = 2 + level;
    for (let i = 0; i < count; i++) {
      const b = new THREE.BoxGeometry(0.075, 0.025, 0.03);
      b.translate(0.06, 0.1 - h / 2 + ((i + 0.5) * h) / count, 0.186 * g);
      buckles.push(b);
    }
    this.beltGroup.add(part(merged(buckles), 0xc8ccd2, { metalness: 0.8, roughness: 0.3 }));
  }

  setFeather(on: boolean): void {
    if (this.featherMesh) this.featherMesh.visible = on;
  }

  private buildArms(): void {
    const L = this.look;
    const g = L.girth ?? 1;
    for (const side of [-1, 1]) {
      const sh = side < 0 ? this.shoulderL : this.shoulderR;
      sh.position.set(0.25 * side * g, 0.52, 0);
      this.torso.add(sh);
      const sleeveColor = L.coat !== undefined ? L.coat : L.shirt;
      const bottom = L.wideSleeves ? 0.125 : 0.065;
      sh.add(at(part(new THREE.CylinderGeometry(0.065, bottom, 0.5, 7), sleeveColor), 0, -0.25, 0));
      sh.add(at(part(new THREE.IcosahedronGeometry(0.052, 0), L.skin), 0, -0.55, 0));
    }
    this.buildWeapon();
  }

  private buildWeapon(): void {
    const w = this.look.weapon;
    if (w === 'none') return;
    const holder = new THREE.Group();
    holder.position.y = -0.55;
    this.shoulderR.add(holder);
    if (w === 'valaska') {
      holder.add(at(part(new THREE.CylinderGeometry(0.018, 0.022, 0.88, 6), 0x7a4a26), 0, -0.36, 0));
      const blade = part(new THREE.BoxGeometry(0.025, 0.13, 0.17), 0xb9bec4, { metalness: 0.75, roughness: 0.35 });
      blade.position.set(0, -0.74, -0.07);
      holder.add(blade);
    } else if (w === 'saber') {
      holder.add(at(part(new THREE.BoxGeometry(0.05, 0.08, 0.05), 0xc9a227, { metalness: 0.7 }), 0, -0.02, 0));
      const blade = part(new THREE.BoxGeometry(0.012, 0.72, 0.035), 0xd0d4d8, { metalness: 0.8, roughness: 0.3 });
      blade.position.y = -0.42;
      holder.add(blade);
    } else if (w === 'staff') {
      holder.add(at(part(new THREE.CylinderGeometry(0.022, 0.026, 1.7, 6), 0x6e4a2a), 0, -0.2, 0));
    }
  }

  private buildHead(): void {
    const L = this.look;
    this.head.position.y = 0.7;
    this.torso.add(this.head);
    this.torso.add(at(part(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 6), L.skin), 0, 0.6, 0));
    const skull = part(new THREE.IcosahedronGeometry(0.125, 1), L.skin);
    skull.scale.set(0.95, 1.12, 1);
    this.head.add(skull);
    const nose = part(new THREE.BoxGeometry(0.03, 0.05, 0.04), L.skin);
    nose.position.set(0, -0.01, 0.125);
    this.head.add(nose);
    const eyes = [-1, 1].map((sx) => new THREE.BoxGeometry(0.025, 0.018, 0.01).translate(0.045 * sx, 0.025, 0.115));
    this.head.add(part(merged(eyes), 0x1a1410));
    const hair = part(new THREE.SphereGeometry(0.133, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), L.hair);
    hair.position.set(0, 0.02, -0.012);
    hair.rotation.x = -0.25;
    this.head.add(hair);
    if (L.braids) {
      const beads: THREE.BufferGeometry[] = [];
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const b = new THREE.IcosahedronGeometry(0.03 - i * 0.002, 0);
          b.translate(0.105 * sx + sx * Math.min(i, 2) * 0.012, -0.06 - i * 0.065, 0.02 + Math.min(i, 3) * 0.015);
          beads.push(b);
        }
      }
      this.head.add(part(merged(beads), L.hair));
    }
    if (L.mustache) {
      const m = part(new THREE.BoxGeometry(0.1, 0.022, 0.03), L.hair);
      m.position.set(0, -0.055, 0.115);
      this.head.add(m);
    }
    if (L.beard !== undefined) {
      const b = part(new THREE.BoxGeometry(0.16, 0.12, 0.08), L.beard);
      b.position.set(0, -0.11, 0.07);
      this.head.add(b);
    }
    this.buildHat();
  }

  private buildHat(): void {
    const L = this.look;
    const color = L.hatColor ?? 0x161414;
    const hat = new THREE.Group();
    hat.position.y = 0.1;
    this.head.add(hat);
    switch (L.hat) {
      case 'zbojnik': {
        hat.add(at(part(new THREE.CylinderGeometry(0.27, 0.28, 0.025, 12), color), 0, 0.02, 0));
        hat.add(at(part(new THREE.CylinderGeometry(0.12, 0.135, 0.1, 10), color), 0, 0.075, 0));
        const band = part(new THREE.CylinderGeometry(0.137, 0.137, 0.025, 10), 0xb3261e);
        band.position.y = 0.045;
        hat.add(band);
        hat.rotation.z = 0.06;
        const feather = part(new THREE.ConeGeometry(0.025, 0.32, 4), 0xece6da);
        feather.position.set(0.12, 0.18, -0.03);
        feather.rotation.set(-0.3, 0, -0.5);
        feather.visible = L.feather ?? false;
        hat.add(feather);
        this.featherMesh = feather;
        break;
      }
      case 'bacov':
        hat.add(at(part(new THREE.CylinderGeometry(0.3, 0.31, 0.03, 12), color), 0, 0.02, 0));
        hat.add(at(part(new THREE.SphereGeometry(0.13, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), color), 0, 0.03, 0));
        break;
      case 'shako': {
        hat.add(at(part(new THREE.CylinderGeometry(0.135, 0.12, 0.24, 8), color), 0, 0.1, 0));
        const visor = part(new THREE.BoxGeometry(0.2, 0.015, 0.1), color);
        visor.position.set(0, 0, 0.12);
        hat.add(visor);
        hat.add(at(part(new THREE.BoxGeometry(0.05, 0.05, 0.02), 0xc9a227, { metalness: 0.7 }), 0, 0.14, 0.13));
        break;
      }
      case 'cap':
        hat.add(at(part(new THREE.SphereGeometry(0.14, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), color), 0, -0.02, 0));
        break;
      case 'kerchief':
        hat.add(at(part(new THREE.SphereGeometry(0.142, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.6), color), 0, -0.04, 0));
        hat.add(at(part(new THREE.BoxGeometry(0.08, 0.06, 0.05), color), 0, -0.18, -0.1));
        break;
      case 'wig': {
        const curls: THREE.BufferGeometry[] = [];
        for (let i = 0; i < 7; i++) {
          const a = (i / 6) * Math.PI - Math.PI / 2;
          curls.push(new THREE.IcosahedronGeometry(0.06, 0).translate(Math.sin(a) * 0.13, -0.08, -Math.cos(a) * 0.07));
        }
        curls.push(new THREE.SphereGeometry(0.14, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55));
        hat.add(part(merged(curls), 0xf2efe8));
        hat.add(at(part(new THREE.CylinderGeometry(0.02, 0.035, 0.18, 5), 0xf2efe8), 0, -0.15, -0.14));
        break;
      }
      case 'none':
        break;
    }
  }

  update(dt: number, p: AnimParams): void {
    if (p.pose !== this.currentPose) {
      this.currentPose = p.pose;
      this.poseBlend = 0;
    }
    this.poseBlend = Math.min(1, this.poseBlend + dt * (p.pose === 'dead' ? 2.2 : 3.5));
    this.breath += dt * 2.2;

    const moving = Math.min(1, p.speed / 5);
    this.stride = damp(this.stride, moving, 10, dt);
    this.air = damp(this.air, p.onGround ? 0 : 1, 12, dt);
    this.phase += dt * (3.2 + p.speed * 1.35);
    const sw = Math.sin(this.phase) * 0.75 * this.stride;

    // base locomotion
    let hipL = sw * (1 - this.air) - 0.55 * this.air;
    let hipR = -sw * (1 - this.air) + 0.25 * this.air;
    let kneeL = Math.max(0, -Math.sin(this.phase)) * 0.9 * this.stride + 0.9 * this.air;
    let kneeR = Math.max(0, Math.sin(this.phase)) * 0.9 * this.stride + 0.4 * this.air;
    let armL = -sw * 0.8;
    let armR = sw * 0.6 - 0.12;
    let armLz = -0.08;
    let armRz = 0.08;
    let bodyY = Math.abs(Math.cos(this.phase)) * 0.06 * this.stride + Math.sin(this.breath) * 0.005;
    let bodyRx = 0;
    let torsoRx = 0.06 * this.stride - p.hurt * 0.35;
    let torsoRy = 0;
    let headRx = p.talking ? Math.sin(this.breath * 3) * 0.05 : 0;

    if (p.attack >= 0) {
      const t = p.attack;
      let a: number;
      if (t < 0.38) a = lerp(-0.1, -3.35, easeOutCubic(t / 0.38));
      else if (t < 0.6) a = lerp(-3.35, -0.75, easeInQuad((t - 0.38) / 0.22));
      else a = lerp(-0.75, -0.1, (t - 0.6) / 0.4);
      armR = a;
      armRz = 0.15;
      torsoRy = t < 0.38 ? lerp(0, 0.35, t / 0.38) : lerp(0.35, -0.25, Math.min(1, (t - 0.38) / 0.3));
      torsoRx += t > 0.38 && t < 0.7 ? 0.2 : 0;
    }
    if (p.aim > 0) {
      armR = lerp(armR, -1.55, p.aim);
      armRz = lerp(armRz, 0, p.aim);
      armL = lerp(armL, -1.0, p.aim);
      armLz = lerp(armLz, -0.45, p.aim);
    }

    // poses
    const k = easeOutCubic(this.poseBlend);
    switch (p.pose) {
      case 'dead':
        bodyRx = lerp(0, -Math.PI / 2, k);
        bodyY = lerp(bodyY, 0.13, k);
        armL = armR = -0.3;
        armLz = -1.2;
        armRz = 1.2;
        hipL = hipR = 0;
        kneeL = kneeR = 0.1;
        break;
      case 'downed':
      case 'sit':
      case 'sleep':
        hipL = hipR = -1.45 * k;
        kneeL = kneeR = 1.45 * k;
        bodyY = lerp(bodyY, -0.43, k);
        armL = armR = -0.35;
        if (p.pose !== 'sit') {
          headRx = 0.55 * k;
          torsoRx = 0.25 * k;
        }
        if (p.pose === 'downed') torsoRx = 0.45 * k;
        break;
      case 'cheer':
        armL = armR = -2.8;
        armLz = -0.3;
        armRz = 0.3;
        bodyY += Math.abs(Math.sin(this.breath * 3)) * 0.12;
        break;
      case 'normal':
        break;
    }

    this.hipL.rotation.x = hipL;
    this.hipR.rotation.x = hipR;
    this.kneeL.rotation.x = kneeL;
    this.kneeR.rotation.x = kneeR;
    this.shoulderL.rotation.x = armL;
    this.shoulderR.rotation.x = armR;
    this.shoulderL.rotation.z = armLz;
    this.shoulderR.rotation.z = armRz;
    this.body.position.y = bodyY;
    this.body.rotation.x = bodyRx;
    this.torso.rotation.x = torsoRx;
    this.torso.rotation.y = torsoRy;
    this.head.rotation.x = headRx;
  }

  /** World position of the right hand (muzzle flashes, sparks). */
  handPosition(out: THREE.Vector3): THREE.Vector3 {
    return this.shoulderR.localToWorld(out.set(0, -0.6, 0));
  }

  setVisible(v: boolean): void {
    this.root.visible = v;
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
