import * as THREE from 'three';
import {
  GORGE,
  GORGE_STEPS,
  LOC,
  REGIONS,
  ROAD_HALF_WIDTH,
  ROAD_HEIGHT,
  TERRAIN_CHUNKS,
  TERRAIN_SEGMENTS,
  WATER_LEVEL,
  WORLD_SIZE,
} from '@/config/constants';
import { clamp, fbm, lerp, smoothstep, valueNoise } from '@/utils/math-utils';

export function riverZ(x: number): number {
  return 128 + Math.sin(x * 0.018) * 12 + Math.sin(x * 0.047 + 1.3) * 4;
}

export function roadZ(x: number): number {
  return riverZ(x) - 16;
}

/** Polynomial smooth minimum – blends the region discs without creases in the slopes. */
function smin(a: number, b: number, k: number): number {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
}

/** Metres outside the open land (negative inside). Mountains rise where this is positive. */
export function outsideDistance(x: number, z: number): number {
  let d = Infinity;
  for (const r of REGIONS) {
    const di = Math.hypot(x - r.x, z - r.z) - r.r;
    d = d === Infinity ? di : smin(d, di, 30);
  }
  return d;
}

function baseHeight(x: number, z: number): number {
  let h = 1.2 + fbm(x * 0.011 + 3.1, z * 0.011 - 7.3, 4) * 9;
  const dv = Math.hypot(x - LOC.vatra.x, z - LOC.vatra.z);
  h += 15 * Math.exp(-(dv * dv) / (2 * 26 * 26));
  const dc = Math.hypot(x - LOC.castle.x, z - LOC.castle.z);
  h += 13 * Math.exp(-(dc * dc) / (2 * 16 * 16));
  // the ridge levels off into a plateau – endless walls would poke out past the far plane
  const t = Math.min(70, outsideDistance(x, z));
  if (t > 0) h += t * t * 0.03 + t * 0.9 * fbm(x * 0.04, z * 0.04, 3);
  return h;
}

interface Flat {
  x: number;
  z: number;
  r: number;
  h: number;
}

const FLATS: Flat[] = [
  { x: LOC.village.x, z: LOC.village.z, r: 50, h: 2.6 },
  { x: LOC.salas.x, z: LOC.salas.z, r: 16, h: baseHeight(LOC.salas.x, LOC.salas.z) },
  { x: LOC.terchova.x, z: LOC.terchova.z, r: 18, h: baseHeight(LOC.terchova.x, LOC.terchova.z) },
  { x: LOC.vatra.x, z: LOC.vatra.z, r: 9, h: baseHeight(LOC.vatra.x, LOC.vatra.z) },
  { x: LOC.castle.x, z: LOC.castle.z, r: 9, h: baseHeight(LOC.castle.x, LOC.castle.z) },
  { x: LOC.mikulas.x, z: LOC.mikulas.z, r: 44, h: 2.4 },
  { x: LOC.hana.x, z: LOC.hana.z, r: 8, h: 2.2 },
];

/** Cobbled market square of Liptovský Mikuláš. */
export function isSquare(x: number, z: number): boolean {
  return Math.abs(x - LOC.mikulas.x) < 32 && Math.abs(z - LOC.mikulas.z) < 24;
}

/** Dirt paths between places (drawn into vertex colors). */
const PATHS: [number, number, number, number][] = [
  [30, 40, 30, 95],
  [30, 95, 24, roadZ(24)],
  [10, 20, -40, 30],
  [-40, 30, -80, 46],
  [10, 10, -30, -30],
  [-30, -30, -62, -74],
  [60, 0, 95, -40],
  [95, -40, 116, -66],
  [122, -82, 130, -106],
  // Mikuláš: from the hradská up to the square, and to the widow's hut
  [330, 82, 330, roadZ(330)],
  [LOC.hana.x, LOC.hana.z + 3, LOC.hana.x + 4, roadZ(LOC.hana.x + 4)],
];

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export function pathDistance(x: number, z: number): number {
  let d = Infinity;
  for (const [ax, az, bx, bz] of PATHS) d = Math.min(d, distToSegment(x, z, ax, az, bx, bz));
  return d;
}

/** Valley terrain before the gorge is cut into the mountains. */
function valleyHeight(x: number, z: number): number {
  let h = baseHeight(x, z);
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r + 14) h = lerp(h, f.h, smoothstep(f.r + 14, f.r, d));
  }
  // the road and the Váh cut a gorge through the mountains, which closes further out –
  // otherwise the sky would show through the slot at the end of the world
  const open = smoothstep(95, 45, outsideDistance(x, z));
  const dRoad = Math.abs(z - roadZ(x));
  if (dRoad < 12) h = lerp(h, ROAD_HEIGHT, smoothstep(12, 3.5, dRoad) * open);
  const dRiver = Math.abs(z - riverZ(x));
  if (dRiver < 13) h = lerp(h, -2.6, smoothstep(13, 5, dRiver) * open);
  return h;
}

/** Floor height of the gorge entrance – every node's `dh` is relative to it. */
const GORGE_H0 = valleyHeight(GORGE[0].x, GORGE[0].z);

export interface GorgePoint {
  /** distance from the floor's centre line */
  dist: number;
  /** half-width of the walkable floor there */
  r: number;
  floor: number;
  /** nearest point on the centre line */
  x: number;
  z: number;
  /** metres along the gorge from its entrance */
  along: number;
}

const gorgeTmp: GorgePoint = { dist: 0, r: 0, floor: 0, x: 0, z: 0, along: 0 };

/** Floor height along segment i at fraction t – a sharp rock step where a waterfall falls. */
export function gorgeFloor(i: number, t: number): number {
  const a = GORGE[i];
  const b = GORGE[i + 1];
  const k = (GORGE_STEPS as readonly number[]).includes(i) ? smoothstep(0.42, 0.58, t) : t;
  return GORGE_H0 + lerp(a.dh, b.dh, k);
}

/** Nearest point of Jánošíkove diery (returns a shared object – copy what you keep). */
export function gorgeAt(x: number, z: number): GorgePoint {
  let best = Infinity;
  let along = 0;
  for (let i = 0; i < GORGE.length - 1; i++) {
    const a = GORGE[i];
    const b = GORGE[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (len * len), 0, 1);
    const px = a.x + dx * t;
    const pz = a.z + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) {
      best = d;
      gorgeTmp.dist = d;
      gorgeTmp.r = lerp(a.r, b.r, t);
      gorgeTmp.floor = gorgeFloor(i, t);
      gorgeTmp.x = px;
      gorgeTmp.z = pz;
      gorgeTmp.along = along + len * t;
    }
    along += len;
  }
  return gorgeTmp;
}

/** Analytic terrain height used to build the mesh: valley + the gorge cut into the rock. */
export function heightAt(x: number, z: number): number {
  const h = valleyHeight(x, z);
  const g = gorgeAt(x, z);
  if (g.dist > g.r + 7) return h;
  // sheer walls a few metres from the floor – but no wall across the entrance
  const wall = Math.max(h, g.floor + 14 * smoothstep(4, 30, g.along));
  return lerp(wall, g.floor, smoothstep(g.r + 7, g.r, g.dist));
}

/** `wet` 0..1 – after rain the mud patches grow. */
export function isMud(x: number, z: number, wet = 0): boolean {
  const dRoad = Math.abs(z - roadZ(x));
  if (dRoad < ROAD_HALF_WIDTH + 0.5 + wet && valueNoise(x * 0.09, z * 0.09) > 0.62 - wet * 0.14) return true;
  const dv = Math.hypot(x - LOC.village.x, z - LOC.village.z);
  return dv < 40 && valueNoise(x * 0.13 + 40, z * 0.13) > 0.74 - wet * 0.12;
}

export function isRoad(x: number, z: number): boolean {
  return Math.abs(z - roadZ(x)) < ROAD_HALF_WIDTH;
}

const C = {
  grassA: new THREE.Color(0x5d7d39),
  grassB: new THREE.Color(0x7f9443),
  forest: new THREE.Color(0x4a6630),
  road: new THREE.Color(0x8b6b47),
  path: new THREE.Color(0x917650),
  mud: new THREE.Color(0x4d3925),
  rock: new THREE.Color(0x7c7871),
  snow: new THREE.Color(0xe6eaee),
  bed: new THREE.Color(0x5b5a48),
  bank: new THREE.Color(0x8f8a6a),
  field: new THREE.Color(0x5e4630),
  cobble: new THREE.Color(0x8a8378),
  cobbleDark: new THREE.Color(0x837b70),
};

export function colorAt(x: number, z: number, h: number, slope: number, out: THREE.Color): THREE.Color {
  if (h < WATER_LEVEL + 0.1) return out.copy(C.bed);
  if (h < 0.2 && Math.abs(z - riverZ(x)) < 14) return out.copy(C.bank);
  if (isSquare(x, z)) return out.copy(valueNoise(x * 0.8, z * 0.8) > 0.5 ? C.cobble : C.cobbleDark);
  if (h < 8 && isMud(x, z)) return out.copy(C.mud);
  if (h < 8 && isRoad(x, z)) return out.copy(C.road);
  if (Math.abs(x - LOC.field.x) < 9 && Math.abs(z - LOC.field.z) < 6) {
    return out.copy(Math.floor((z - LOC.field.z + 6) / 1.5) % 2 === 0 ? C.field : C.grassA);
  }
  const g = gorgeAt(x, z);
  if (g.dist < g.r + 0.5 && g.along > 12) return out.copy(C.rock).lerp(C.path, 0.45);
  if (h > 46) return out.copy(C.snow);
  if (slope > 0.85 || h > 30) return out.copy(C.rock);
  if (pathDistance(x, z) < 1.7) return out.copy(C.path);
  const n = fbm(x * 0.03, z * 0.03, 3);
  out.copy(C.grassA).lerp(C.grassB, n);
  if (fbm(x * 0.02 + 50, z * 0.02 - 20, 3) > 0.55) out.lerp(C.forest, 0.6);
  return out;
}

/**
 * Low-poly terrain built from a height grid. The same triangulation is used for
 * mesh and collision so actors stand exactly on the visible surface.
 */
export class Terrain {
  /** Group of terrain chunks (each frustum-culled on its own). */
  readonly mesh = new THREE.Group();
  readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  private readonly heights: Float32Array;
  private readonly n = TERRAIN_SEGMENTS;
  private readonly cell = WORLD_SIZE / TERRAIN_SEGMENTS;
  private readonly half = WORLD_SIZE / 2;

  constructor() {
    const n = this.n;
    this.heights = new Float32Array((n + 1) * (n + 1));
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        this.heights[j * (n + 1) + i] = heightAt(i * this.cell - this.half, j * this.cell - this.half);
      }
    }
    const per = Math.ceil(n / TERRAIN_CHUNKS);
    for (let cj = 0; cj < n; cj += per) {
      for (let ci = 0; ci < n; ci += per) {
        this.buildChunk(ci, cj, Math.min(n, ci + per), Math.min(n, cj + per));
      }
    }
  }

  private buildChunk(i0: number, j0: number, i1: number, j1: number): void {
    const cells = (i1 - i0) * (j1 - j0);
    const positions = new Float32Array(cells * 6 * 3);
    const colors = new Float32Array(cells * 6 * 3);
    const col = new THREE.Color();
    let p = 0;
    const pushTri = (verts: number[][], cx: number, cz: number, slope: number, hAvg: number): void => {
      colorAt(cx, cz, hAvg, slope, col);
      const jitter = 0.95 + valueNoise(cx * 1.7, cz * 1.7) * 0.1;
      for (const v of verts) {
        positions[p] = v[0];
        positions[p + 1] = v[1];
        positions[p + 2] = v[2];
        colors[p] = col.r * jitter;
        colors[p + 1] = col.g * jitter;
        colors[p + 2] = col.b * jitter;
        p += 3;
      }
    };
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        const x0 = i * this.cell - this.half;
        const z0 = j * this.cell - this.half;
        const x1 = x0 + this.cell;
        const z1 = z0 + this.cell;
        const h00 = this.h(i, j);
        const h10 = this.h(i + 1, j);
        const h01 = this.h(i, j + 1);
        const h11 = this.h(i + 1, j + 1);
        const s1 = (Math.max(h00, h10, h01) - Math.min(h00, h10, h01)) / this.cell;
        const s2 = (Math.max(h10, h01, h11) - Math.min(h10, h01, h11)) / this.cell;
        pushTri(
          [
            [x0, h00, z0],
            [x0, h01, z1],
            [x1, h10, z0],
          ],
          x0 + this.cell / 3,
          z0 + this.cell / 3,
          s1,
          (h00 + h10 + h01) / 3,
        );
        pushTri(
          [
            [x1, h10, z0],
            [x0, h01, z1],
            [x1, h11, z1],
          ],
          x0 + (this.cell * 2) / 3,
          z0 + (this.cell * 2) / 3,
          s2,
          (h10 + h01 + h11) / 3,
        );
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const chunk = new THREE.Mesh(geo, this.material);
    chunk.receiveShadow = true;
    this.mesh.add(chunk);
  }

  private h(i: number, j: number): number {
    return this.heights[j * (this.n + 1) + i];
  }

  /** Exact height of the rendered triangle under (x, z). */
  height(x: number, z: number): number {
    const gx = clamp((x + this.half) / this.cell, 0, this.n - 0.0001);
    const gz = clamp((z + this.half) / this.cell, 0, this.n - 0.0001);
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    const fx = gx - i;
    const fz = gz - j;
    const h00 = this.h(i, j);
    const h10 = this.h(i + 1, j);
    const h01 = this.h(i, j + 1);
    const h11 = this.h(i + 1, j + 1);
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }

  /** Top-down color map for the HUD minimap. */
  renderMinimap(size: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const g = canvas.getContext('2d');
    if (!g) return canvas;
    const img = g.createImageData(size, size);
    const col = new THREE.Color();
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = (px / size) * WORLD_SIZE - this.half;
        const z = (py / size) * WORLD_SIZE - this.half;
        const h = this.height(x, z);
        if (h < WATER_LEVEL) col.set(0x4f6f86);
        else colorAt(x, z, h, (Math.abs(this.height(x + 2, z) - h) + Math.abs(this.height(x, z + 2) - h)) / 2, col);
        col.convertLinearToSRGB();
        const shade = 0.75 + clamp(h / 60, 0, 0.35);
        const k = (py * size + px) * 4;
        img.data[k] = Math.min(255, col.r * 255 * shade * 1.15);
        img.data[k + 1] = Math.min(255, col.g * 255 * shade * 1.15);
        img.data[k + 2] = Math.min(255, col.b * 255 * shade * 1.15);
        img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return canvas;
  }
}
