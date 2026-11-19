import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { damp, easeInQuad, easeOutCubic, lerp } from '@/utils/math-utils';
import { at, part, stripeTexture } from '@/world/materials';
import type { AttackAnim } from '@/entities/attacks';

export type HatStyle = 'zbojnik' | 'shako' | 'cap' | 'wig' | 'kerchief' | 'bacov' | 'none';
export type WeaponStyle = 'valaska' | 'saber' | 'staff' | 'lantern' | 'none';
export type Pose = 'normal' | 'dead' | 'sit' | 'sleep' | 'cheer' | 'downed' | 'wave' | 'laugh' | 'odzemok' | 'climb';

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
  /** krpce (opánky) with leather laces wound up the calf instead of shoes/boots */
  krpce?: boolean;
  /** folk embroidery (výšivka) colour on the vest's front edges + rosettes */
  vestTrim?: number;
  /** brass studs (cvočky) on the wide zbojnícky opasok */
  beltStuds?: boolean;
  eyeColor?: number;
  /** lantern in the left hand (night guards) – toggled with setLantern() */
  lantern?: boolean;
}

export interface AnimParams {
  speed: number;
  onGround: boolean;
  /** -1 = no attack, else 0..1 progress */
  attack: number;
  attackKind?: AttackAnim;
  /** 0..1 aim blend (pistol pose) */
  aim: number;
  pose: Pose;
  /** 0..1 flinch */
  hurt: number;
  talking?: boolean;
  /** -1 = none, else 0..1 progress of reaching for (or putting away) the valaška behind the belt */
  draw?: number;
  /** 0..1 – sneaking crouch */
  crouch?: number;
}

const LEG_TOP = 0.92;
const WOOD_STRAP = 0x3a2418;

interface AttackPose {
  armX: number;
  armZ: number;
  torsoY: number;
  torsoX: number;
  bodyY: number;
  spin: number;
  armLx?: number;
  armLz?: number;
}

/** Progress of `t` inside [a, b], clamped to 0..1. */
function seg(t: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}

/**
 * Keyframed weapon-arm poses. The weapon arm sits on +X: rotation.z > 0 swings it outward,
 * < 0 across the chest; a positive torso yaw pulls the weapon shoulder back (wind-up).
 */
function attackPose(kind: AttackAnim, t: number): AttackPose {
  const rest = { armX: -0.12, armZ: 0.08, torsoY: 0, torsoX: 0 };
  switch (kind) {
    case 'slashR': {
      // diagonal forehand: high and wide → low across the body
      const w = easeOutCubic(seg(t, 0, 0.36));
      const s = easeInQuad(seg(t, 0.36, 0.6));
      const r = seg(t, 0.6, 1);
      const armX = lerp(lerp(lerp(rest.armX, -2.5, w), -0.8, s), rest.armX, r);
      const armZ = lerp(lerp(lerp(rest.armZ, 1.25, w), -0.75, s), rest.armZ, r);
      const torsoY = lerp(lerp(lerp(0, 0.5, w), -0.6, s), 0, r);
      return { armX, armZ, torsoY, torsoX: 0.15 * s * (1 - r), bodyY: -0.04 * s * (1 - r), spin: 0, armLz: -0.5 * w * (1 - r) };
    }
    case 'slashL': {
      // backhand: from across the chest sweeping outward
      const w = easeOutCubic(seg(t, 0, 0.32));
      const s = easeInQuad(seg(t, 0.32, 0.56));
      const r = seg(t, 0.56, 1);
      const armX = lerp(lerp(lerp(rest.armX, -1.75, w), -1.45, s), rest.armX, r);
      const armZ = lerp(lerp(lerp(rest.armZ, -1.1, w), 1.35, s), rest.armZ, r);
      const torsoY = lerp(lerp(lerp(0, -0.65, w), 0.6, s), 0, r);
      return { armX, armZ, torsoY, torsoX: 0.08 * s * (1 - r), bodyY: 0, spin: 0, armLz: -0.7 * s * (1 - r) };
    }
    case 'overhead': {
      // leap and chop from above
      const w = easeOutCubic(seg(t, 0, 0.42));
      const s = easeInQuad(seg(t, 0.42, 0.6));
      const r = seg(t, 0.6, 1);
      const armX = lerp(lerp(lerp(rest.armX, -3.35, w), -0.7, s), rest.armX, r);
      const hop = Math.sin(seg(t, 0, 0.6) * Math.PI) * 0.28;
      const impact = -0.14 * s * (1 - r);
      return {
        armX,
        armZ: 0.15,
        torsoY: lerp(lerp(0, 0.3, w), -0.2, s) * (1 - r),
        torsoX: -0.18 * w * (1 - s) + 0.38 * s * (1 - r),
        bodyY: hop + impact,
        spin: 0,
        armLx: -1.2 * w * (1 - r),
      };
    }
    case 'spin': {
      // crouch, then a full turn with the valaška held out at arm's length
      const w = easeOutCubic(seg(t, 0, 0.28));
      const sp = seg(t, 0.28, 0.82);
      const r = seg(t, 0.82, 1);
      const out = w * (1 - r);
      return {
        armX: lerp(rest.armX, -0.45, out),
        armZ: lerp(rest.armZ, 1.5, out),
        torsoY: 0.55 * w * (1 - sp),
        torsoX: 0.12 * out,
        bodyY: -0.14 * out,
        // ends at exactly one full turn, which looks identical to the rest pose
        spin: -sp * sp * (3 - 2 * sp) * Math.PI * 2,
        armLx: -0.3 * out,
        armLz: -1.3 * out,
      };
    }
  }
}

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
  private poseTime = 0;
  private currentPose: Pose = 'normal';
  private weaponHolder: THREE.Group | null = null;
  private hatGroup: THREE.Group | null = null;
  private braidMesh: THREE.Mesh | null = null;
  private pistolGroup: THREE.Group | null = null;
  private disguiseParts: THREE.Object3D[] | null = null;
  private stride = 0;
  private air = 0;
  private leftLantern: THREE.Group | null = null;
  private eyes: THREE.Group | null = null;
  private mouth: THREE.Mesh | null = null;
  private blinkTimer = 1 + Math.random() * 4;
  /** First frame: put joints straight to their targets instead of easing from the T-pose. */
  private settled = false;

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
      if (L.krpce) {
        knee.add(this.buildKrpce(L.shoes));
      } else {
        const shoe = part(new THREE.BoxGeometry(0.11, 0.07, 0.24), L.shoes);
        shoe.position.set(0, -0.405, 0.04);
        knee.add(shoe);
      }
    }
  }

  /** Flat leather opánky with a pointed, upturned toe and laces criss-crossing up the calf. */
  private buildKrpce(color: number): THREE.Mesh {
    const geos: THREE.BufferGeometry[] = [
      new THREE.BoxGeometry(0.105, 0.05, 0.23).translate(0, -0.415, 0.035),
      new THREE.BoxGeometry(0.06, 0.04, 0.06).rotateX(-0.5).translate(0, -0.4, 0.16),
    ];
    // laces: thin rings tilted alternately so they read as a criss-cross
    for (let i = 0; i < 5; i++) {
      const y = -0.36 + i * 0.06;
      const r = 0.06 + (y + 0.38) * 0.03 + 0.006;
      geos.push(new THREE.CylinderGeometry(r, r, 0.012, 8, 1, true).rotateX((i % 2 ? 1 : -1) * 0.22).translate(0, y, 0));
    }
    return part(merged(geos), color, { roughness: 0.85 });
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
      if (L.vestTrim !== undefined) {
        // embroidered front edges and a column of rosettes on each side
        const zf = 0.205 * g * 0.87 + 0.004;
        const strips: THREE.BufferGeometry[] = [];
        const roses: THREE.BufferGeometry[] = [];
        for (const sx of [-1, 1]) {
          strips.push(new THREE.BoxGeometry(0.028, 0.4, 0.01).translate(0.045 * sx, 0.34, zf));
          for (let i = 0; i < 3; i++) {
            roses.push(new THREE.OctahedronGeometry(0.022, 0).scale(1, 1, 0.4).translate(0.1 * sx * g, 0.46 - i * 0.1, zf - 0.012));
          }
        }
        strips.push(new THREE.BoxGeometry(0.42 * g, 0.022, 0.01).translate(0, 0.14, zf - 0.02));
        this.torso.add(part(merged(strips), L.vestTrim));
        this.torso.add(part(merged(roses), 0xb3261e));
      }
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
      this.pistolGroup = pistol;
    }
  }

  /**
   * Handlár disguise: long plain coat, cap and a pedlar's pack instead of the
   * famous hat, braids, pistol and valaška.
   */
  setDisguise(on: boolean, coat: number, cap: number): void {
    if (on && !this.disguiseParts) {
      const g = this.look.girth ?? 1;
      const longCoat = part(new THREE.CylinderGeometry(0.225, 0.29, 1.0, 8), coat);
      longCoat.position.y = 0.08;
      longCoat.scale.set(g, 1, g * 0.9);
      const hood = part(new THREE.SphereGeometry(0.145, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), cap);
      hood.position.y = 0.08;
      const pack = new THREE.Group();
      pack.add(at(part(new THREE.BoxGeometry(0.42, 0.5, 0.22), 0x7a5a38), 0, 0, 0));
      pack.add(at(part(new THREE.BoxGeometry(0.46, 0.06, 0.26), WOOD_STRAP), 0, 0.12, 0));
      pack.position.set(0, 0.35, -0.3 * g);
      this.torso.add(longCoat, pack);
      this.head.add(hood);
      this.disguiseParts = [longCoat, hood, pack];
    }
    this.disguiseParts?.forEach((p) => (p.visible = on));
    if (this.hatGroup) this.hatGroup.visible = !on;
    if (this.braidMesh) this.braidMesh.visible = !on;
    if (this.pistolGroup) this.pistolGroup.visible = !on;
    if (this.weaponHolder) this.weaponHolder.visible = !on;
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
    if (L.beltStuds) {
      // rows of brass cvočky round the front half – one more row per upgrade
      const studs: THREE.BufferGeometry[] = [];
      const rows = 1 + level;
      for (let r = 0; r < rows; r++) {
        const y = 0.1 - h / 2 + ((r + 0.5) * h) / rows;
        for (let i = 0; i < 11; i++) {
          const a = -1.25 + (i / 10) * 2.5 + (r % 2) * 0.12;
          if (Math.abs(Math.sin(a)) < 0.12) continue; // leave the buckle free
          studs.push(new THREE.OctahedronGeometry(0.012, 0).translate(Math.sin(a) * 0.218 * g, y, Math.cos(a) * 0.218 * g * 0.86));
        }
      }
      if (studs.length) this.beltGroup.add(part(merged(studs), 0xc9a227, { metalness: 0.8, roughness: 0.35 }));
    }
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
      sh.add(at(part(new THREE.IcosahedronGeometry(0.06, 0).scale(0.9, 1.1, 0.8), L.skin), 0, -0.56, 0));
    }
    this.buildWeapon();
    if (L.lantern) {
      const holder = new THREE.Group();
      holder.position.y = -0.58;
      holder.add(at(part(new THREE.BoxGeometry(0.012, 0.08, 0.012), 0x2a2420), 0, -0.04, 0));
      holder.add(at(part(new THREE.BoxGeometry(0.13, 0.025, 0.13), 0x2a2420), 0, -0.09, 0));
      holder.add(at(part(new THREE.BoxGeometry(0.1, 0.14, 0.1), 0xffc070, { emissive: 0xffa040, emissiveIntensity: 4 }), 0, -0.17, 0));
      holder.add(at(part(new THREE.BoxGeometry(0.13, 0.025, 0.13), 0x2a2420), 0, -0.25, 0));
      this.shoulderL.add(holder);
      this.leftLantern = holder;
    }
  }

  /** Show / hide the left-hand lantern (night guards light it after dusk). */
  setLantern(on: boolean): void {
    if (this.leftLantern) this.leftLantern.visible = on;
  }

  get lanternLit(): boolean {
    return this.leftLantern?.visible ?? false;
  }

  /** World position of the left-hand lantern glass; false if there is none. */
  leftLanternPosition(out: THREE.Vector3): boolean {
    if (!this.leftLantern) return false;
    this.leftLantern.updateWorldMatrix(true, false);
    this.leftLantern.localToWorld(out.set(0, -0.17, 0));
    return true;
  }

  private buildWeapon(): void {
    const w = this.look.weapon;
    if (w === 'none') return;
    const holder = new THREE.Group();
    holder.position.y = -0.55;
    this.shoulderR.add(holder);
    this.weaponHolder = holder;
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
    } else if (w === 'lantern') {
      // the night watchman's lantern hanging from his fist
      holder.add(at(part(new THREE.BoxGeometry(0.012, 0.08, 0.012), 0x2a2420), 0, -0.04, 0));
      holder.add(at(part(new THREE.BoxGeometry(0.13, 0.025, 0.13), 0x2a2420), 0, -0.09, 0));
      holder.add(at(part(new THREE.BoxGeometry(0.1, 0.14, 0.1), 0xffc070, { emissive: 0xffa040, emissiveIntensity: 4 }), 0, -0.17, 0));
      holder.add(at(part(new THREE.BoxGeometry(0.13, 0.025, 0.13), 0x2a2420), 0, -0.25, 0));
    }
  }

  /** True while the valaška / šabľa is tucked behind the belt instead of in the hand. */
  get sheathed(): boolean {
    return this.weaponHolder !== null && this.weaponHolder.parent === this.torso;
  }

  /**
   * Tuck the weapon behind the belt (diagonally across the small of the back, grip by the right hip,
   * blade up by the left) or put it back into the right hand.
   */
  setSheathed(on: boolean): void {
    const h = this.weaponHolder;
    const w = this.look.weapon;
    if (!h || (w !== 'valaska' && w !== 'saber') || this.sheathed === on) return;
    const g = this.look.girth ?? 1;
    if (on) {
      this.torso.add(h);
      h.position.set(0.2 * g, 0.06, -0.24 * g);
      h.rotation.set(0, 0, -2.09);
    } else {
      this.shoulderR.add(h);
      h.position.set(0, -0.55, 0);
      h.rotation.set(0, 0, 0);
    }
  }

  /** World position of the lantern glass (light follows the swinging arm). */
  lanternPosition(out: THREE.Vector3): THREE.Vector3 {
    if (!this.weaponHolder) return this.handPosition(out);
    this.weaponHolder.updateWorldMatrix(true, false);
    return this.weaponHolder.localToWorld(out.set(0, -0.17, 0));
  }

  private buildHead(): void {
    const L = this.look;
    this.head.position.y = 0.7;
    this.torso.add(this.head);
    this.torso.add(at(part(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 6), L.skin), 0, 0.6, 0));
    const skull = part(new THREE.IcosahedronGeometry(0.125, 1), L.skin);
    skull.scale.set(0.95, 1.12, 1);
    this.head.add(skull);
    const nose = part(new THREE.BoxGeometry(0.03, 0.05, 0.045).translate(0, 0, 0.005), L.skin);
    nose.position.set(0, -0.012, 0.125);
    nose.rotation.x = -0.12;
    this.head.add(nose);
    // ears
    this.head.add(part(merged([-1, 1].map((sx) => new THREE.BoxGeometry(0.02, 0.05, 0.035).translate(0.12 * sx, 0.0, 0.0))), L.skin));
    // eyes: white + iris, in a group that blinks
    const eyes = new THREE.Group();
    eyes.position.set(0, 0.025, 0.113);
    eyes.add(part(merged([-1, 1].map((sx) => new THREE.BoxGeometry(0.034, 0.02, 0.008).translate(0.045 * sx, 0, 0))), 0xf2ece0, { roughness: 0.4 }));
    eyes.add(part(merged([-1, 1].map((sx) => new THREE.BoxGeometry(0.016, 0.018, 0.008).translate(0.045 * sx + 0.002, 0, 0.004))), L.eyeColor ?? 0x2a1e14, { roughness: 0.3 }));
    this.head.add(eyes);
    this.eyes = eyes;
    // brows – a touch of character
    const brows = [-1, 1].map((sx) => new THREE.BoxGeometry(0.042, 0.011, 0.012).rotateZ(-0.12 * sx).translate(0.046 * sx, 0.052, 0.116));
    this.head.add(part(merged(brows), L.hair));
    // mouth
    const mouth = part(new THREE.BoxGeometry(0.045, 0.012, 0.01), 0x6a2e26);
    mouth.position.set(0, -0.068, 0.112);
    this.head.add(mouth);
    this.mouth = mouth;
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
      this.braidMesh = part(merged(beads), L.hair);
      this.head.add(this.braidMesh);
    }
    if (L.mustache) {
      // the proper drooping Slovak fúzy: two halves swept down past the mouth corners
      const halves = [-1, 1].map((sx) =>
        new THREE.BoxGeometry(0.06, 0.02, 0.025).rotateZ(-0.38 * sx).translate(0.03 * sx, -0.06, 0.118),
      );
      const tips = [-1, 1].map((sx) => new THREE.BoxGeometry(0.016, 0.04, 0.02).translate(0.062 * sx, -0.085, 0.11));
      this.head.add(part(merged([...halves, ...tips]), L.beard ?? L.hair));
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
    this.hatGroup = hat;
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
      this.poseTime = 0;
    }
    this.poseTime += dt;
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

    let spin = 0;
    if (p.attack >= 0) {
      const a = attackPose(p.attackKind ?? 'overhead', p.attack);
      armR = a.armX;
      armRz = a.armZ;
      torsoRy = a.torsoY;
      torsoRx += a.torsoX;
      bodyY += a.bodyY;
      spin = a.spin;
      if (a.armLz !== undefined) armLz = a.armLz;
      if (a.armLx !== undefined) armL = a.armLx;
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
      case 'wave': {
        armR = lerp(armR, -2.75, k);
        armRz = lerp(armRz, 0.45 + Math.sin(this.poseTime * 9) * 0.45, k);
        headRx = -0.1;
        torsoRy = 0.15;
        break;
      }
      case 'laugh': {
        const shake = Math.sin(this.poseTime * 22) * 0.06;
        torsoRx = lerp(torsoRx, -0.28 + shake, k);
        headRx = -0.35 + shake;
        armL = armR = -0.55;
        armLz = 0.55;
        armRz = -0.55;
        bodyY += Math.abs(Math.sin(this.poseTime * 11)) * 0.03;
        break;
      }
      case 'odzemok': {
        // the shepherds' dance: deep squats, high kicks and the valaška twirling overhead
        const beat = this.poseTime * 2.5 * Math.PI * 2;
        const kick = Math.sin(beat);
        const kickL = Math.max(0, kick);
        const kickR = Math.max(0, -kick);
        hipL = lerp(hipL, -0.5 - kickL * 1.0, k);
        hipR = lerp(hipR, -0.5 - kickR * 1.0, k);
        kneeL = lerp(kneeL, 1.0 - kickL * 0.95, k);
        kneeR = lerp(kneeR, 1.0 - kickR * 0.95, k);
        const hop = Math.max(0, Math.sin(beat * 0.25)) ** 4 * 0.45;
        bodyY = lerp(bodyY, -0.24 + Math.abs(Math.cos(beat)) * 0.1 + hop, k);
        armR = lerp(armR, -2.9 + Math.sin(beat * 0.5) * 0.35, k);
        armRz = 0.25;
        armL = -0.3;
        armLz = -1.25 + Math.sin(beat) * 0.2;
        torsoRx = -0.12;
        torsoRy = Math.sin(beat * 0.5) * 0.25;
        headRx = -0.1;
        break;
      }
      case 'climb': {
        // hand over hand up a ladder
        const c = Math.sin(this.poseTime * 7);
        armL = lerp(armL, -2.6 + c * 0.45, k);
        armR = lerp(armR, -2.6 - c * 0.45, k);
        armLz = -0.15;
        armRz = 0.15;
        hipL = lerp(hipL, -0.7 - c * 0.5, k);
        hipR = lerp(hipR, -0.7 + c * 0.5, k);
        kneeL = 1.0 + c * 0.4;
        kneeR = 1.0 - c * 0.4;
        torsoRx = 0.1;
        headRx = -0.25;
        break;
      }
      case 'normal':
        break;
    }

    // lantern held out a little in front, barely swinging
    if (this.leftLantern?.visible && p.pose === 'normal') {
      armL = armL * 0.3 - 0.4;
      armLz = -0.12;
    }
    // sneaking: bent knees, lower hips, leaning forward – stacks on top of the walk cycle
    const cr = p.crouch ?? 0;
    if (cr > 0) {
      hipL -= 0.7 * cr;
      hipR -= 0.7 * cr;
      kneeL += 1.1 * cr;
      kneeR += 1.1 * cr;
      bodyY -= 0.3 * cr;
      torsoRx += 0.38 * cr;
      headRx -= 0.28 * cr;
    }

    // reach back over the right hip for the valaška tucked behind the belt, then bring it forward
    if (p.draw !== undefined && p.draw >= 0) {
      const r = Math.sin(Math.PI * Math.min(1, p.draw));
      armR = lerp(armR, 0.75, r);
      armRz = lerp(armRz, 0.32, r);
      torsoRy = lerp(torsoRy, 0.3, r);
    }

    // Ease every joint towards its target: hides the snaps when a swing ends, a pose changes or the
    // valaška changes hands. Swings get a stiff spring so they stay crisp; the spin is applied raw
    // (it wraps a full turn).
    const lam = this.settled ? (p.attack >= 0 ? 45 : 18) : Infinity;
    const ease = (cur: number, target: number): number => (lam === Infinity ? target : damp(cur, target, lam, dt));
    this.settled = true;
    this.hipL.rotation.x = ease(this.hipL.rotation.x, hipL);
    this.hipR.rotation.x = ease(this.hipR.rotation.x, hipR);
    this.kneeL.rotation.x = ease(this.kneeL.rotation.x, kneeL);
    this.kneeR.rotation.x = ease(this.kneeR.rotation.x, kneeR);
    this.shoulderL.rotation.x = ease(this.shoulderL.rotation.x, armL);
    this.shoulderR.rotation.x = ease(this.shoulderR.rotation.x, armR);
    this.shoulderL.rotation.z = ease(this.shoulderL.rotation.z, armLz);
    this.shoulderR.rotation.z = ease(this.shoulderR.rotation.z, armRz);
    this.body.position.y = ease(this.body.position.y, bodyY);
    this.body.rotation.x = ease(this.body.rotation.x, bodyRx);
    this.body.rotation.y = spin;
    this.torso.rotation.x = ease(this.torso.rotation.x, torsoRx);
    this.torso.rotation.y = ease(this.torso.rotation.y, torsoRy);
    this.head.rotation.x = ease(this.head.rotation.x, headRx);

    // face: blink every few seconds, eyes shut when asleep / knocked out, lips move while talking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) this.blinkTimer = 2 + Math.random() * 4;
    const shut = p.pose === 'sleep' || p.pose === 'dead' || p.pose === 'downed';
    if (this.eyes) this.eyes.scale.y = shut || this.blinkTimer < 0.12 ? 0.15 : 1;
    if (this.mouth) this.mouth.scale.y = p.talking ? 1 + Math.abs(Math.sin(this.breath * 5.5)) * 2.4 : 1;
  }

  /** World position of the right hand (muzzle flashes, sparks). */
  handPosition(out: THREE.Vector3): THREE.Vector3 {
    return this.shoulderR.localToWorld(out.set(0, -0.6, 0));
  }

  /** World positions of the weapon grip and blade tip (for swing trails). */
  weaponPoints(base: THREE.Vector3, tip: THREE.Vector3): boolean {
    if (!this.weaponHolder) return false;
    this.weaponHolder.localToWorld(base.set(0, -0.3, 0));
    this.weaponHolder.localToWorld(tip.set(0, -0.82, -0.1));
    return true;
  }

  setVisible(v: boolean): void {
    this.root.visible = v;
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
