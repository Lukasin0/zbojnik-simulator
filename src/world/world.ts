import * as THREE from 'three';
import { BOUNDS_MARGIN, BROKEN_LADDER, GORGE, GORGE_STEPS, LOC, REGIONS, WATER_LEVEL, WORLD_SIZE } from '@/config/constants';
import type { GroundProvider } from '@/components/physics-body';
import { fbm, lerp, mulberry32, randRange, smoothstep } from '@/utils/math-utils';
import { bakeStatic, mat } from './materials';
import { Mist } from './mist';
import type { NightReceiver } from './day-night';
import { Terrain, gorgeAt, gorgeFloor, isMud, outsideDistance, pathDistance, riverZ, roadZ } from './terrain';
import {
  createBarrel,
  createBedding,
  createBench,
  createCaveMouth,
  createLadder,
  createLeanTo,
  createCastle,
  createChest,
  createChurch,
  createFenceRing,
  createFlame,
  createForge,
  createHouse,
  createHut,
  createKoliba,
  createKotlik,
  createKrcma,
  createSheep,
  createSign,
  createPillory,
  createSpruceGeometries,
  createStall,
  createTable,
  createTownHall,
  createTownHouse,
  type StallGoods,
  createVatraPile,
  createWell,
} from './props';
import { AmbushTree, ShootingTarget, TrainingDummy } from './interactive-props';

interface CircleCollider {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
}

interface BoxCollider {
  kind: 'box';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

type Collider = CircleCollider | BoxCollider;

interface Fire {
  pos: THREE.Vector3;
  light: THREE.PointLight;
  flame: THREE.Group;
  base: number;
  size: number;
}

interface Sheep {
  mesh: THREE.Group;
  target: THREE.Vector2;
  wait: number;
}

export interface Ladder {
  index: number;
  /** where you stand to climb up / where you arrive climbing down */
  bottom: THREE.Vector3;
  top: THREE.Vector3;
  /** facing the rock while climbing */
  yaw: number;
  fixed: THREE.Group;
  /** the broken ladder shown until it is mended (null = usable) */
  broken: THREE.Group | null;
}

export interface Hideout {
  fire: Fire | null;
  firePos: THREE.Vector3;
  beds: THREE.Group | null;
  bedsPos: THREE.Vector3;
  table: THREE.Group | null;
  tablePos: THREE.Vector3;
  chest: THREE.Group | null;
  chestPos: THREE.Vector3;
  bearPos: THREE.Vector3;
}

/** Foamy stripes for the gorge brook (scrolled every frame). */
function streamTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#5f8fa8';
    g.fillRect(0, 0, 32, 64);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(235,245,250,${0.25 + Math.random() * 0.45})`;
      g.fillRect(Math.random() * 32, Math.random() * 64, 2 + Math.random() * 6, 3 + Math.random() * 9);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const CELL = 12;

/** Builds and owns the static Liptov valley: terrain, river, forest, village, salaš, castle. */
export class World implements GroundProvider, NightReceiver {
  readonly root = new THREE.Group();
  readonly terrain: Terrain;
  readonly dummies: TrainingDummy[] = [];
  readonly targets: ShootingTarget[] = [];
  readonly ambushTree: AmbushTree;
  readonly fires: Fire[] = [];
  readonly vatraPos: THREE.Vector3;
  readonly kotlikPos: THREE.Vector3;
  readonly chestPos: THREE.Vector3;
  readonly fieldPos: THREE.Vector3;
  /** Meshes the third-person camera must stay in front of. */
  readonly occluders: THREE.Object3D[] = [];
  readonly mist: Mist;
  /** Where each villager goes to bed – a spot just outside their door. */
  readonly doors: Record<string, THREE.Vector3> = {};
  /** Where the Mikuláš market vendors stand – behind their stalls. */
  readonly stalls: THREE.Vector3[] = [];
  posterPos = new THREE.Vector3();
  /** Jánošíkove diery */
  readonly ladders: Ladder[] = [];
  readonly waterfalls: THREE.Vector3[] = [];
  /** Zbojnícke chodníky – fast-travel signposts by place id. */
  readonly signposts: Record<string, THREE.Vector3> = {};
  ondrasPos = new THREE.Vector3();
  readonly hideout: Hideout = {
    fire: null,
    firePos: new THREE.Vector3(),
    beds: null,
    bedsPos: new THREE.Vector3(),
    table: null,
    tablePos: new THREE.Vector3(),
    chest: null,
    chestPos: new THREE.Vector3(),
    bearPos: new THREE.Vector3(),
  };
  private streamTexture: THREE.Texture | null = null;
  /** Lanterns & forge – brighter after dark. */
  private readonly nightLights: { light: THREE.PointLight; base: number }[] = [];
  /** Shared window-glass material of every house – glows warm at night. */
  private readonly windowMaterial = mat(0x23262a);
  private night = 0;
  private wetness = 0;
  private readonly colliders: Collider[] = [];
  private readonly grid = new Map<number, number[]>();
  private readonly sheep: Sheep[] = [];
  private readonly water: THREE.Mesh;
  private readonly rng = mulberry32(1713);

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    this.terrain = new Terrain();
    this.root.add(this.terrain.mesh);

    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE, 70, 120, 6),
      new THREE.MeshStandardMaterial({ color: 0x46677a, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.86, flatShading: true }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, WATER_LEVEL, 128);
    this.root.add(this.water);

    this.vatraPos = this.ground(LOC.vatra.x, LOC.vatra.z);
    this.kotlikPos = this.ground(LOC.kotlik.x, LOC.kotlik.z);
    this.chestPos = this.ground(LOC.terchova.x + 2.2, LOC.terchova.z + 3.6);
    this.fieldPos = this.ground(LOC.field.x, LOC.field.z);

    this.buildVillage();
    this.buildRovnaHora();
    this.buildSalas();
    this.buildTerchova();
    this.buildCastle();
    this.buildMikulas();
    this.buildGorge();
    this.buildRoadside();
    const ax = LOC.ambushX;
    const az = roadZ(ax) - 5.5;
    this.ambushTree = new AmbushTree(ax, this.groundHeight(ax, az), az);
    this.root.add(this.ambushTree.group);
    this.addCircle(ax, az, 0.6);
    this.buildForest();
    this.buildRocks();
    this.mist = new Mist((x, z) => this.groundHeight(x, z));
    this.root.add(this.mist.root);
    this.windowMaterial.emissive.set(0xffa040);
    this.windowMaterial.emissiveIntensity = 0;
  }

  /** NightReceiver: windows light up, fires and lanterns get stronger. */
  setNight(night: number): void {
    this.night = night;
    this.windowMaterial.emissiveIntensity = smoothstep(0.35, 0.85, night) * 2.2;
    for (const l of this.nightLights) l.light.intensity = l.base * (0.5 + night * 1.6);
  }

  updateMist(time: number, amount: number, color: THREE.Color): void {
    this.mist.update(time, amount, color);
  }

  ground(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, this.groundHeight(x, z), z);
  }

  // --- Collision -------------------------------------------------------------------

  private cellKey(cx: number, cz: number): number {
    return (cx + 1000) * 4096 + (cz + 1000);
  }

  private index(c: Collider, id: number): void {
    const [minX, maxX, minZ, maxZ] =
      c.kind === 'circle' ? [c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r] : [c.minX, c.maxX, c.minZ, c.maxZ];
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const k = this.cellKey(cx, cz);
        const list = this.grid.get(k) ?? [];
        list.push(id);
        this.grid.set(k, list);
      }
    }
  }

  addCircle(x: number, z: number, r: number): void {
    const c: CircleCollider = { kind: 'circle', x, z, r };
    this.colliders.push(c);
    this.index(c, this.colliders.length - 1);
  }

  /** Axis aligned box centred at x/z; w along X, d along Z (after rotation). */
  addBox(x: number, z: number, w: number, d: number): void {
    const c: BoxCollider = { kind: 'box', minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
    this.colliders.push(c);
    this.index(c, this.colliders.length - 1);
  }

  groundHeight(x: number, z: number): number {
    return this.terrain.height(x, z);
  }

  resolveCircle(p: THREE.Vector3, radius: number): boolean {
    const list = this.grid.get(this.cellKey(Math.floor(p.x / CELL), Math.floor(p.z / CELL)));
    let hit = false;
    const near = new Set<number>(list ?? []);
    // neighbours – a circle near a cell edge can touch the next cell's colliders
    for (const [ox, oz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const extra = this.grid.get(this.cellKey(Math.floor((p.x + ox * radius) / CELL), Math.floor((p.z + oz * radius) / CELL)));
      extra?.forEach((i) => near.add(i));
    }
    for (const i of near) {
      const c = this.colliders[i];
      if (c.kind === 'circle') {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const min = radius + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x = c.x + (dx / d) * min;
          p.z = c.z + (dz / d) * min;
          hit = true;
        }
      } else {
        const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
        const dx = p.x - cx;
        const dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            p.x = cx + (dx / d) * radius;
            p.z = cz + (dz / d) * radius;
          } else {
            // centre inside the box – push out along the shallowest axis
            const pushes = [p.x - c.minX, c.maxX - p.x, p.z - c.minZ, c.maxZ - p.z];
            const m = Math.min(...pushes);
            if (m === pushes[0]) p.x = c.minX - radius;
            else if (m === pushes[1]) p.x = c.maxX + radius;
            else if (m === pushes[2]) p.z = c.minZ - radius;
            else p.z = c.maxZ + radius;
          }
          hit = true;
        }
      }
    }
    return hit;
  }

  /** Keeps actors inside the union of region discs (plus the slope margin) or the gorge floor. */
  clampToBounds(p: THREE.Vector3): void {
    const g = gorgeAt(p.x, p.z);
    const gorgeOver = g.dist - g.r;
    if (gorgeOver <= 0) return;
    let best: (typeof REGIONS)[number] | null = null;
    let bestOver = Infinity;
    for (const r of REGIONS) {
      const over = Math.hypot(p.x - r.x, p.z - r.z) - (r.r + BOUNDS_MARGIN);
      if (over <= 0) return;
      if (over < bestOver) {
        bestOver = over;
        best = r;
      }
    }
    if (gorgeOver < bestOver) {
      // back onto the gorge floor
      const k = g.r / g.dist;
      p.x = g.x + (p.x - g.x) * k;
      p.z = g.z + (p.z - g.z) * k;
      return;
    }
    if (!best) return;
    const dx = p.x - best.x;
    const dz = p.z - best.z;
    const k = (best.r + BOUNDS_MARGIN) / Math.hypot(dx, dz);
    p.x = best.x + dx * k;
    p.z = best.z + dz * k;
  }

  isMud(x: number, z: number): boolean {
    return isMud(x, z, this.wetness);
  }

  /** Rain darkens the ground and makes it glossier; mud spreads (see isMud). */
  setWetness(w: number): void {
    if (Math.abs(w - this.wetness) < 0.002) return;
    this.wetness = w;
    const m = this.terrain.material;
    m.color.setScalar(1 - w * 0.32);
    m.roughness = 0.95 - w * 0.4;
  }

  waterDepth(x: number, z: number): number {
    return Math.max(0, WATER_LEVEL - this.groundHeight(x, z));
  }

  roadZ(x: number): number {
    return roadZ(x);
  }

  // --- Placement helpers ---------------------------------------------------------

  /** Place a baked static prop; rot is a multiple of PI/2. Collider box w×d in local space. */
  private place(group: THREE.Group, x: number, z: number, rot: number, w: number, d: number, sink = 0.15): THREE.Group {
    const baked = bakeStatic(group);
    baked.position.set(x, this.groundHeight(x, z) - sink, z);
    baked.rotation.y = rot;
    this.root.add(baked);
    if (w > 0 && d > 0) {
      const swap = Math.abs(Math.sin(rot)) > 0.5;
      this.addBox(x, z, swap ? d : w, swap ? w : d);
      baked.children.forEach((c) => this.occluders.push(c));
    }
    return baked;
  }

  private addFire(pos: THREE.Vector3, size: number, intensity: number): void {
    const flame = createFlame();
    flame.scale.setScalar(size);
    flame.position.copy(pos);
    this.root.add(flame);
    const light = new THREE.PointLight(0xff8a3a, intensity, 22 * size + 8, 1.6);
    light.position.set(pos.x, pos.y + 1.6 * size, pos.z);
    this.root.add(light);
    this.fires.push({ pos: pos.clone(), light, flame, base: intensity, size });
  }

  // --- Areas ------------------------------------------------------------------------

  private buildVillage(): void {
    const v = LOC.village;
    this.place(createKrcma(), LOC.krcma.x, LOC.krcma.z, -Math.PI / 2, 12, 9);
    const sign = createSign('ŠENK');
    sign.position.set(LOC.krcma.x - 7.5, this.groundHeight(LOC.krcma.x - 7.5, LOC.krcma.z - 6), LOC.krcma.z - 6);
    sign.rotation.y = -Math.PI / 2;
    this.root.add(sign);
    // tables & benches in front of the krčma
    for (const tz of [LOC.krcma.z - 4.5, LOC.krcma.z + 4.5]) {
      const tx = LOC.krcma.x - 10;
      this.place(createTable(), tx, tz, Math.PI / 2, 2.0, 1.0, 0);
      const b1 = createBench(2.0);
      this.place(b1, tx - 1.0, tz, Math.PI / 2, 0, 0, 0);
      const b2 = createBench(2.0);
      this.place(b2, tx + 1.0, tz, Math.PI / 2, 0, 0, 0);
    }
    for (const [bx, bz] of [
      [LOC.krcma.x - 6.6, LOC.krcma.z + 3.5],
      [LOC.krcma.x - 6.6, LOC.krcma.z + 2.5],
      [LOC.krcma.x - 7.4, LOC.krcma.z + 3.0],
    ]) {
      this.place(createBarrel(), bx, bz, 0, 0, 0, 0);
      this.addCircle(bx, bz, 0.45);
    }
    const lantern = new THREE.PointLight(0xffa860, 14, 16, 1.8);
    lantern.position.set(LOC.krcma.x - 6.8, this.groundHeight(LOC.krcma.x - 7, LOC.krcma.z) + 3, LOC.krcma.z);
    this.root.add(lantern);
    this.nightLights.push({ light: lantern, base: 14 });

    this.place(createChurch(), v.x, v.z - 30, 0, 7, 20);
    this.place(createWell(), v.x, v.z, 0, 2.2, 2.2);
    this.place(createForge(), LOC.shop.x, LOC.shop.z, Math.PI, 0, 0, 0.1);
    this.addBox(LOC.shop.x, LOC.shop.z + 2.1, 5.4, 0.5);
    const forgeLight = new THREE.PointLight(0xff6a20, 10, 9, 1.8);
    forgeLight.position.set(LOC.shop.x + 1.2, this.groundHeight(LOC.shop.x, LOC.shop.z) + 1.4, LOC.shop.z + 1.2);
    this.root.add(forgeLight);
    this.nightLights.push({ light: forgeLight, base: 10 });
    this.addBox(LOC.shop.x + 1.2, LOC.shop.z + 1.2, 1.6, 1.4);
    this.place(createHut(), LOC.poor.x, LOC.poor.z + 3, Math.PI, 5, 4.2);

    this.doors.katarina = this.doorOf(LOC.poor.x, LOC.poor.z + 3, Math.PI, 4.2);

    const houses: [number, number, number, string][] = [
      [8, 6, Math.PI / 2, 'mara'],
      [14, -8, 0, 'dom2'],
      [46, -8, 0, 'ponocny'],
      [18, 50, Math.PI, 'jano'],
      [58, 32, -Math.PI / 2, 'palo'],
      [0, 22, Math.PI / 2, 'kovac'],
      [58, -16, -Math.PI / 2, 'dom7'],
    ];
    for (const [x, z, r, owner] of houses) {
      const w = 6 + this.rng() * 2;
      const d = 5 + this.rng() * 2;
      this.place(createHouse({ w, d, h: 2.6 + this.rng() * 0.6, chimney: this.rng() > 0.4 }), x, z, r, w, d);
      this.doors[owner] = this.doorOf(x, z, r, d);
    }
  }

  /** Spot just outside the door of a house placed at x/z with rotation r (door faces local +Z). */
  private doorOf(x: number, z: number, r: number, depth: number): THREE.Vector3 {
    const out = depth / 2 + 0.9;
    return this.ground(x + Math.sin(r) * out, z + Math.cos(r) * out);
  }

  private buildRovnaHora(): void {
    const v = this.vatraPos;
    // no collider on the bonfire – you are supposed to jump over it (and get burnt when you don't)
    this.place(createVatraPile(), v.x, v.z, 0, 0, 0, 0);
    this.addFire(new THREE.Vector3(v.x, v.y + 0.2, v.z), 1.0, 30);
    const dummySpots: [number, number][] = [
      [9, -3],
      [10, 3],
      [8, 8],
    ];
    for (const [dx, dz] of dummySpots) {
      const x = v.x + dx;
      const z = v.z + dz;
      const d = new TrainingDummy(x, this.groundHeight(x, z), z, -Math.PI / 2);
      this.root.add(d.group);
      this.dummies.push(d);
    }
    const targetSpots: [number, number][] = [
      [-16, -7],
      [-19, 0],
      [-16, 7],
    ];
    for (const [dx, dz] of targetSpots) {
      const x = v.x + dx;
      const z = v.z + dz;
      const t = new ShootingTarget(x, this.groundHeight(x, z), z, Math.atan2(v.x - x, v.z - z));
      this.root.add(t.group);
      this.targets.push(t);
    }
    // logs to sit on around the fire
    for (const a of [0.6, 2.4, 4.2]) {
      const x = v.x + Math.cos(a) * 4;
      const z = v.z + Math.sin(a) * 4;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.2, 6), mat(0x5a3c26));
      log.rotation.set(0, -a, Math.PI / 2);
      log.position.set(x, this.groundHeight(x, z) + 0.2, z);
      log.castShadow = true;
      this.root.add(log);
    }
  }

  private buildSalas(): void {
    const s = LOC.salas;
    this.place(createKoliba(), s.x - 4, s.z + 6, 0, 6, 5);
    const fence = createFenceRing(9, 26, Math.PI / 2);
    this.place(fence, s.x + 10, s.z - 4, 0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const mesh = createSheep();
      const x = s.x + 10 + randRange(this.rng, -5, 5);
      const z = s.z - 4 + randRange(this.rng, -5, 5);
      mesh.position.set(x, this.groundHeight(x, z), z);
      this.root.add(mesh);
      this.sheep.push({ mesh, target: new THREE.Vector2(x, z), wait: this.rng() * 3 });
    }
    const k = this.kotlikPos;
    this.place(createKotlik(), k.x, k.z, 0, 0, 0, 0);
    this.addCircle(k.x, k.z, 0.7);
    this.addFire(new THREE.Vector3(k.x, k.y, k.z), 0.32, 8);
  }

  private buildTerchova(): void {
    const t = LOC.terchova;
    this.place(createHouse({ w: 7, d: 5.5, h: 2.8, chimney: true }), t.x, t.z, 0, 7, 5.5);
    this.doors.jan = this.doorOf(t.x, t.z, 0, 5.5);
    this.place(createHouse({ w: 6, d: 5, h: 2.6 }), t.x + 12, t.z + 10, -Math.PI / 2, 6, 5);
    this.place(createHouse({ w: 6, d: 5, h: 2.6 }), t.x - 11, t.z - 12, Math.PI / 2, 6, 5);
    this.place(createChest(), this.chestPos.x, this.chestPos.z, 0, 1.1, 0.7, 0);
  }

  /** Liptovský Mikuláš: market square, radnica, burgher houses, the fair and the inn. */
  private buildMikulas(): void {
    const m = LOC.mikulas;
    this.place(createTownHall(), m.x, m.z - 32, 0, 12, 8);
    this.doors.vyberca = this.doorOf(m.x, m.z - 32, 0, 8);
    this.place(createChurch(), m.x + 50, m.z - 14, -Math.PI / 2, 7, 20);
    const plaster = [0xe8dcc0, 0xe6c99a, 0xd8e0d0, 0xeed6c4, 0xe0d0a8];
    const west = [-14, -2, 10];
    west.forEach((dz, i) => {
      this.place(createTownHouse(7, 6, plaster[i]), m.x - 39, m.z + dz, Math.PI / 2, 7, 6);
      this.doors[`mestoW${i}`] = this.doorOf(m.x - 39, m.z + dz, Math.PI / 2, 6);
    });
    [2, 14].forEach((dz, i) => {
      this.place(createTownHouse(7, 6, plaster[3 + i]), m.x + 39, m.z + dz, -Math.PI / 2, 7, 6);
      this.doors[`mestoE${i}`] = this.doorOf(m.x + 39, m.z + dz, -Math.PI / 2, 6);
    });
    // hostinec on the south-east corner
    this.place(createTownHouse(9, 7, 0xd8c8a8), m.x + 39, m.z + 28, -Math.PI / 2, 9, 7);
    this.doors.hostinec = this.doorOf(m.x + 39, m.z + 28, -Math.PI / 2, 7);
    const inn = createSign('HOSTINEC');
    inn.position.set(m.x + 33.5, this.groundHeight(m.x + 33.5, m.z + 23), m.z + 23);
    inn.rotation.y = -Math.PI / 2;
    this.root.add(inn);

    // the fair – two rows of stalls facing the aisle
    const stalls: [number, number, number, number, StallGoods][] = [
      [-22, -8, 0, 0xb3261e, 'hrnce'],
      [-12, -8, 0, 0x2e5a8a, 'kapusta'],
      [12, -8, 0, 0x3d6b3a, 'medovniky'],
      [22, -8, 0, 0xc9a227, 'cizmy'],
      [-17, 8, Math.PI, 0x6a2a5a, 'kapusta'],
      [17, 8, Math.PI, 0xb3261e, 'hrnce'],
    ];
    for (const [dx, dz, r, color, goods] of stalls) {
      this.place(createStall(color, goods), m.x + dx, m.z + dz, r, 3, 1.9, 0);
      this.stalls.push(this.ground(m.x + dx, m.z + dz - Math.cos(r) * 1.7));
    }
    this.place(createWell(), m.x, m.z, 0, 2.2, 2.2);
    this.place(createPillory(), m.x, m.z + 15, 0, 1.6, 1.6, 0);
    const poster = createSign('HĽADÁ SA');
    poster.position.set(m.x + 8, this.groundHeight(m.x + 8, m.z - 26), m.z - 26);
    this.root.add(poster);
    this.posterPos = this.ground(m.x + 8, m.z - 25);
    const lantern = new THREE.PointLight(0xffa860, 12, 18, 1.8);
    lantern.position.set(m.x, this.groundHeight(m.x, m.z - 26) + 3.4, m.z - 26);
    this.root.add(lantern);
    this.nightLights.push({ light: lantern, base: 12 });

    // vdova Hana's hut below the town
    const h = LOC.hana;
    this.place(createHut(), h.x, h.z, 0, 5, 4.2);
    this.doors.hana = this.doorOf(h.x, h.z, 0, 4.2);
  }

  /** Jánošíkove diery: ladders over the rock steps, the stream, Ondráš's camp and the hideout. */
  private buildGorge(): void {
    GORGE_STEPS.forEach((seg, i) => {
      const a = GORGE[seg];
      const b = GORGE[seg + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const dx = (b.x - a.x) / len;
      const dz = (b.z - a.z) / len;
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const low = gorgeFloor(seg, 0);
      const high = gorgeFloor(seg, 1);
      // ladder leans against the step on the other side than the waterfall
      const side = 1.6;
      const px = -dz * side;
      const pz = dx * side;
      const yaw = Math.atan2(-dx, -dz);
      const lean = Math.atan2(2.4, high - low);
      const length = (high - low) / Math.cos(lean) + 1.2;
      const bx = mx - dx * 1.4 + px;
      const bz = mz - dz * 1.4 + pz;
      const ladder = this.placeFree(createLadder(length, lean), bx, bz, yaw);
      const ladderInfo: Ladder = {
        index: i,
        bottom: this.ground(mx - dx * 2.6 + px, mz - dz * 2.6 + pz),
        top: this.ground(mx + dx * 2.2 + px, mz + dz * 2.2 + pz),
        yaw: Math.atan2(dx, dz),
        fixed: ladder,
        broken: null,
      };
      if (i === BROKEN_LADDER) {
        ladderInfo.broken = this.placeFree(createLadder(length, lean, true), bx, bz, yaw);
        ladder.visible = false;
      }
      this.ladders.push(ladderInfo);
      // the rock step itself cannot be walked up – a row of boulders' worth of colliders
      const r = (a.r + b.r) / 2 + 1.5;
      for (let s = -r; s <= r; s += 0.9) this.addCircle(mx - dz * s, mz + dx * s, 0.7);
      const fall = ((a.r + b.r) / 2) * 0.5;
      this.waterfalls.push(this.ground(mx - dx * 1.6 + dz * fall, mz - dz * 1.6 - dx * fall));
    });
    this.buildStream();

    // Dolné diery – Ondráš's camp
    const n1 = GORGE[1];
    const n2 = GORGE[2];
    const cl = Math.hypot(n2.x - n1.x, n2.z - n1.z);
    const cdx = (n2.x - n1.x) / cl;
    const cdz = (n2.z - n1.z) / cl;
    this.placeFree(createLeanTo(), n2.x + cdz * 5, n2.z - cdx * 5, Math.atan2(-cdz, cdx));
    this.ondrasPos = this.ground(n2.x + cdz * 2, n2.z - cdx * 2);
    this.signposts.diery = this.ground(n2.x - cdx * 6 - cdz * 3, n2.z - cdz * 6 + cdx * 3);

    // Horné diery – the hideout under the overhang
    const n7 = GORGE[GORGE.length - 2];
    const n8 = GORGE[GORGE.length - 1];
    const hl = Math.hypot(n8.x - n7.x, n8.z - n7.z);
    const dx = (n8.x - n7.x) / hl;
    const dz = (n8.z - n7.z) / hl;
    const at2 = (fwd: number, side: number): THREE.Vector3 => this.ground(n8.x + dx * fwd - dz * side, n8.z + dz * fwd + dx * side);
    const face = Math.atan2(-dx, -dz);
    const cave = at2(13.2, 0);
    this.placeFree(createCaveMouth(), cave.x, cave.z, face);
    const slab = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), mat(0x5f5b55));
    const so = at2(10.5, 0);
    slab.position.set(so.x, so.y + 6.4, so.z);
    slab.scale.set(8.5, 1.4, 5.5);
    slab.rotation.y = face;
    slab.castShadow = true;
    this.root.add(slab);
    const fire = at2(3.5, 0);
    this.hideout.firePos.copy(fire);
    this.place(createVatraPile(), fire.x, fire.z, 0, 0, 0, 0).scale.setScalar(0.6);
    this.addFire(new THREE.Vector3(fire.x, fire.y + 0.1, fire.z), 0.55, 0);
    this.hideout.fire = this.fires[this.fires.length - 1];
    this.hideout.fire.flame.visible = false;
    const bedPos = at2(7.5, -5);
    this.hideout.beds = this.placeFree(createBedding(), bedPos.x, bedPos.z, face + Math.PI / 2);
    this.hideout.bedsPos.copy(bedPos);
    const tablePos = at2(6.5, 5);
    const table = new THREE.Group();
    table.add(createTable());
    const b1 = createBench(2.0);
    b1.position.z = -1.0;
    const b2 = createBench(2.0);
    b2.position.z = 1.0;
    table.add(b1, b2);
    this.hideout.table = this.placeFree(table, tablePos.x, tablePos.z, face);
    this.hideout.tablePos.copy(tablePos);
    const chest = at2(11, 3.2);
    this.hideout.chest = this.placeFree(createChest(), chest.x, chest.z, face);
    this.hideout.chestPos.copy(chest);
    this.hideout.bearPos.copy(at2(9, -1));
    for (const g of [this.hideout.beds, this.hideout.table, this.hideout.chest]) g.visible = false;
    this.signposts.ukryt = at2(-7, 4);

    // zbojnícke chodníky – signposts all over Liptov
    this.signposts.vatra = this.ground(LOC.vatra.x + 10, LOC.vatra.z + 12);
    this.signposts.dedina = this.ground(LOC.village.x + 5, LOC.village.z + 7);
    this.signposts.terchova = this.ground(LOC.terchova.x - 7, LOC.terchova.z + 10);
    this.signposts.mikulas = this.ground(LOC.hana.x + 7, LOC.hana.z + 7);
    for (const p of Object.values(this.signposts)) {
      const s = createSign('CHODNÍK');
      s.scale.setScalar(0.8);
      s.position.copy(p);
      s.rotation.y = Math.atan2(LOC.village.x - p.x, LOC.village.z - p.z);
      this.root.add(s);
    }
  }

  /** The brook down the gorge – a ribbon over the floor that turns into waterfalls at the steps. */
  private buildStream(): void {
    const pts: { x: number; z: number; px: number; pz: number }[] = [];
    for (let i = GORGE.length - 2; i >= 0; i--) {
      const a = GORGE[i + 1];
      const b = GORGE[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const dx = (b.x - a.x) / len;
      const dz = (b.z - a.z) / len;
      const steps = Math.ceil(len / 1.2);
      for (let k = i === GORGE.length - 2 ? 0 : 1; k <= steps; k++) {
        const t = k / steps;
        const side = -lerp(a.r, b.r, t) * 0.5;
        pts.push({ x: a.x + (b.x - a.x) * t + dz * side, z: a.z + (b.z - a.z) * t - dx * side, px: dz, pz: -dx });
      }
    }
    const pos: number[] = [];
    const uv: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    let along = 0;
    pts.forEach((p, i) => {
      const y = this.groundHeight(p.x, p.z) + 0.08;
      if (i > 0) along += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const prev = pts[Math.max(0, i - 1)];
      const steep = Math.min(1, Math.abs(this.groundHeight(next.x, next.z) - this.groundHeight(prev.x, prev.z)) / 3);
      for (const s of [-0.7, 0.7]) {
        pos.push(p.x + p.px * s, y + steep * 0.3, p.z + p.pz * s);
        uv.push(s > 0 ? 1 : 0, along / 3);
        const c = 0.55 + steep * 0.45;
        col.push(c, c + 0.05, c + 0.08);
      }
      if (i > 0) {
        const v = i * 2;
        idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.streamTexture = streamTexture();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: this.streamTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.88,
        roughness: 0.2,
        side: THREE.DoubleSide,
      }),
    );
    mesh.renderOrder = 1;
    this.root.add(mesh);
  }

  /** Place a prop at any angle without baking (so it can be shown / hidden later). */
  private placeFree(group: THREE.Group, x: number, z: number, rot: number): THREE.Group {
    group.position.set(x, this.groundHeight(x, z), z);
    group.rotation.y = rot;
    group.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    this.root.add(group);
    return group;
  }

  /** Mend the broken ladder (chapter 5). */
  repairLadder(index: number): void {
    const l = this.ladders[index];
    if (!l?.broken) return;
    l.broken.visible = false;
    l.fixed.visible = true;
    l.broken = null;
  }

  /** Show what has been built in the hideout. */
  setHideout(fire: boolean, beds: boolean, table: boolean, chest: boolean): void {
    const h = this.hideout;
    if (h.fire) {
      h.fire.base = fire ? 20 : 0;
      h.fire.flame.visible = fire;
    }
    if (h.beds) h.beds.visible = beds;
    if (h.table) h.table.visible = table;
    if (h.chest) h.chest.visible = chest;
  }

  private buildCastle(): void {
    const c = LOC.castle;
    this.place(createCastle(), c.x, c.z, 0, 17, 15, 0.5);
  }

  private buildRoadside(): void {
    // milestones & fence posts along the hradská
    for (let x = -160; x <= 400; x += 40) {
      const z = roadZ(x) - 4;
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.3), mat(0x9a958a));
      stone.position.set(x, this.groundHeight(x, z) + 0.4, z);
      stone.castShadow = true;
      this.root.add(stone);
    }
  }

  private blockedForTrees(x: number, z: number): boolean {
    const g = gorgeAt(x, z);
    if (g.dist < g.r + 4) return true;
    if (Math.abs(z - roadZ(x)) < 9) return true;
    if (Math.abs(z - riverZ(x)) < 15) return true;
    if (pathDistance(x, z) < 3) return true;
    const spots: [number, number, number][] = [
      [LOC.village.x, LOC.village.z, 60],
      [LOC.vatra.x, LOC.vatra.z, 26],
      [LOC.salas.x + 4, LOC.salas.z, 24],
      [LOC.terchova.x, LOC.terchova.z, 22],
      [LOC.castle.x, LOC.castle.z, 18],
      [LOC.ambushX, roadZ(LOC.ambushX) - 5.5, 4],
      [LOC.mikulas.x, LOC.mikulas.z, 62],
      [LOC.hana.x, LOC.hana.z, 12],
    ];
    return spots.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r);
  }

  private buildForest(): void {
    const { trunk, crown } = createSpruceGeometries();
    const transforms: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < 11000 && transforms.length < 2000; i++) {
      const x = randRange(this.rng, -240, 470);
      const z = randRange(this.rng, -240, 240);
      const out = outsideDistance(x, z);
      if (out > 78) continue;
      // denser forest north of the ambush spot (cover for the zbojníci)
      const nearAmbush = Math.hypot(x - LOC.ambushX, z - (roadZ(LOC.ambushX) - 25)) < 28;
      const density = fbm(x * 0.018 + 11, z * 0.018 - 4, 3) + (nearAmbush ? 0.25 : 0) + (out > 10 ? 0.15 : 0);
      if (density < 0.52) continue;
      if (this.blockedForTrees(x, z)) continue;
      const h = this.groundHeight(x, z);
      if (h > 34 || h < 0.3) continue;
      const scale = 0.8 + this.rng() * 0.8;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rng() * Math.PI * 2);
      s.set(scale, scale * (0.85 + this.rng() * 0.4), scale);
      p.set(x, h - 0.1, z);
      transforms.push(m.compose(p, q, s).clone());
      if (out < BOUNDS_MARGIN + 2) this.addCircle(x, z, 0.32 * scale);
    }
    const trunks = new THREE.InstancedMesh(trunk, mat(0x5a3c26), transforms.length);
    const crowns = new THREE.InstancedMesh(crown, mat(0x2f4f2a), transforms.length);
    const tint = new THREE.Color();
    transforms.forEach((t, i) => {
      trunks.setMatrixAt(i, t);
      crowns.setMatrixAt(i, t);
      tint.setHSL(0.3 + this.rng() * 0.05, 0.35 + this.rng() * 0.15, 0.55 + this.rng() * 0.3);
      crowns.setColorAt(i, tint);
    });
    for (const im of [trunks, crowns]) {
      im.castShadow = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.root.add(im);
    }
    this.occluders.push(crowns);
  }

  private buildRocks(): void {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const list: THREE.Matrix4[] = [];
    for (let i = 0; i < 900 && list.length < 290; i++) {
      const x = randRange(this.rng, -230, 460);
      const z = randRange(this.rng, -230, 230);
      const out = outsideDistance(x, z);
      if (out > 70 || this.blockedForTrees(x, z)) continue;
      const scale = 0.4 + this.rng() * 1.4 + (out > 15 ? 2 : 0);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, this.groundHeight(x, z), z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(this.rng() * 3, this.rng() * 3, 0)),
        new THREE.Vector3(scale, scale * 0.7, scale),
      );
      list.push(m);
      if (scale > 0.9 && out < BOUNDS_MARGIN) this.addCircle(x, z, scale * 0.8);
    }
    const rocks = new THREE.InstancedMesh(geo, mat(0x7f7b74), list.length);
    list.forEach((m, i) => rocks.setMatrixAt(i, m));
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    this.root.add(rocks);
  }

  // --- Per-frame -------------------------------------------------------------------

  update(dt: number, time: number): void {
    for (const f of this.fires) {
      const flicker = 0.75 + Math.sin(time * 13 + f.pos.x) * 0.1 + Math.sin(time * 23.7) * 0.08 + Math.random() * 0.07;
      f.light.intensity = f.base * flicker * (0.6 + this.night * 1.4);
      f.flame.scale.set(f.size * (0.9 + flicker * 0.15), f.size * (0.8 + flicker * 0.3), f.size * (0.9 + flicker * 0.15));
      f.flame.rotation.y += dt * 2;
    }
    for (const d of this.dummies) d.update(dt, time);
    for (const t of this.targets) t.update(dt);
    this.ambushTree.update(dt, time);
    for (const s of this.sheep) {
      s.wait -= dt;
      const pos = s.mesh.position;
      const dx = s.target.x - pos.x;
      const dz = s.target.y - pos.z;
      const d = Math.hypot(dx, dz);
      if (s.wait <= 0 && d > 0.2) {
        pos.x += (dx / d) * dt * 0.8;
        pos.z += (dz / d) * dt * 0.8;
        pos.y = this.groundHeight(pos.x, pos.z);
        s.mesh.rotation.y = Math.atan2(dx, dz);
      } else if (s.wait <= 0) {
        s.wait = 2 + Math.random() * 5;
        s.target.set(LOC.salas.x + 10 + (Math.random() - 0.5) * 12, LOC.salas.z - 4 + (Math.random() - 0.5) * 12);
      }
    }
    const pos = this.water.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, Math.sin(time * 1.3 + pos.getX(i) * 0.15 + pos.getY(i) * 0.3) * 0.06);
    }
    pos.needsUpdate = true;
    if (this.streamTexture) this.streamTexture.offset.y = time * 0.9;
  }
}
