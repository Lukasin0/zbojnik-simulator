import * as THREE from 'three';
import { LOC, PLAY_RADIUS, WATER_LEVEL, WORLD_SIZE } from '@/config/constants';
import type { GroundProvider } from '@/components/physics-body';
import { fbm, mulberry32, randRange } from '@/utils/math-utils';
import { bakeStatic, mat } from './materials';
import { Terrain, isMud, pathDistance, riverZ, roadZ } from './terrain';
import {
  createBarrel,
  createBench,
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
  createSpruceGeometries,
  createTable,
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

const CELL = 12;

/** Builds and owns the static Liptov valley: terrain, river, forest, village, salaš, castle. */
export class World implements GroundProvider {
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
      new THREE.PlaneGeometry(WORLD_SIZE, 70, 60, 6),
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
    this.buildRoadside();
    const ax = LOC.ambushX;
    const az = roadZ(ax) - 5.5;
    this.ambushTree = new AmbushTree(ax, this.groundHeight(ax, az), az);
    this.root.add(this.ambushTree.group);
    this.addCircle(ax, az, 0.6);
    this.buildForest();
    this.buildRocks();
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

  clampToBounds(p: THREE.Vector3): void {
    const r = Math.hypot(p.x, p.z);
    if (r > PLAY_RADIUS) {
      p.x *= PLAY_RADIUS / r;
      p.z *= PLAY_RADIUS / r;
    }
  }

  isMud(x: number, z: number): boolean {
    return isMud(x, z);
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
    const lantern = new THREE.PointLight(0xffa860, 14, 14, 1.8);
    lantern.position.set(LOC.krcma.x - 6.8, this.groundHeight(LOC.krcma.x - 7, LOC.krcma.z) + 3, LOC.krcma.z);
    this.root.add(lantern);

    this.place(createChurch(), v.x, v.z - 30, 0, 7, 20);
    this.place(createWell(), v.x, v.z, 0, 2.2, 2.2);
    this.place(createForge(), LOC.shop.x, LOC.shop.z, Math.PI, 0, 0, 0.1);
    this.addBox(LOC.shop.x, LOC.shop.z + 2.1, 5.4, 0.5);
    const forgeLight = new THREE.PointLight(0xff6a20, 10, 9, 1.8);
    forgeLight.position.set(LOC.shop.x + 1.2, this.groundHeight(LOC.shop.x, LOC.shop.z) + 1.4, LOC.shop.z + 1.2);
    this.root.add(forgeLight);
    this.addBox(LOC.shop.x + 1.2, LOC.shop.z + 1.2, 1.6, 1.4);
    this.place(createHut(), LOC.poor.x, LOC.poor.z + 3, Math.PI, 5, 4.2);

    const houses: [number, number, number][] = [
      [8, 6, Math.PI / 2],
      [14, -8, 0],
      [46, -8, 0],
      [18, 50, Math.PI],
      [58, 32, -Math.PI / 2],
      [0, 22, Math.PI / 2],
      [58, -16, -Math.PI / 2],
    ];
    for (const [x, z, r] of houses) {
      const w = 6 + this.rng() * 2;
      const d = 5 + this.rng() * 2;
      this.place(createHouse({ w, d, h: 2.6 + this.rng() * 0.6, chimney: this.rng() > 0.4 }), x, z, r, w, d);
    }
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
    this.place(createHouse({ w: 6, d: 5, h: 2.6 }), t.x + 12, t.z + 10, -Math.PI / 2, 6, 5);
    this.place(createHouse({ w: 6, d: 5, h: 2.6 }), t.x - 11, t.z - 12, Math.PI / 2, 6, 5);
    this.place(createChest(), this.chestPos.x, this.chestPos.z, 0, 1.1, 0.7, 0);
  }

  private buildCastle(): void {
    const c = LOC.castle;
    this.place(createCastle(), c.x, c.z, 0, 17, 15, 0.5);
  }

  private buildRoadside(): void {
    // milestones & fence posts along the hradská
    for (let x = -160; x <= 160; x += 40) {
      const z = roadZ(x) - 4;
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.3), mat(0x9a958a));
      stone.position.set(x, this.groundHeight(x, z) + 0.4, z);
      stone.castShadow = true;
      this.root.add(stone);
    }
  }

  private blockedForTrees(x: number, z: number): boolean {
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
    for (let i = 0; i < 5200 && transforms.length < 1100; i++) {
      const x = randRange(this.rng, -235, 235);
      const z = randRange(this.rng, -235, 235);
      const r = Math.hypot(x, z);
      if (r > 238) continue;
      // denser forest north of the ambush spot (cover for the zbojníci)
      const nearAmbush = Math.hypot(x - LOC.ambushX, z - (roadZ(LOC.ambushX) - 25)) < 28;
      const density = fbm(x * 0.018 + 11, z * 0.018 - 4, 3) + (nearAmbush ? 0.25 : 0) + (r > 170 ? 0.15 : 0);
      if (density < 0.52) continue;
      if (this.blockedForTrees(x, z)) continue;
      const h = this.groundHeight(x, z);
      if (h > 34 || h < 0.3) continue;
      const scale = 0.8 + this.rng() * 0.8;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rng() * Math.PI * 2);
      s.set(scale, scale * (0.85 + this.rng() * 0.4), scale);
      p.set(x, h - 0.1, z);
      transforms.push(m.compose(p, q, s).clone());
      if (r < PLAY_RADIUS + 2) this.addCircle(x, z, 0.32 * scale);
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
    for (let i = 0; i < 400 && list.length < 160; i++) {
      const x = randRange(this.rng, -230, 230);
      const z = randRange(this.rng, -230, 230);
      if (this.blockedForTrees(x, z)) continue;
      const scale = 0.4 + this.rng() * 1.4 + (Math.hypot(x, z) > 175 ? 2 : 0);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, this.groundHeight(x, z), z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(this.rng() * 3, this.rng() * 3, 0)),
        new THREE.Vector3(scale, scale * 0.7, scale),
      );
      list.push(m);
      if (scale > 0.9 && Math.hypot(x, z) < PLAY_RADIUS) this.addCircle(x, z, scale * 0.8);
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
      f.light.intensity = f.base * flicker;
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
  }
}
