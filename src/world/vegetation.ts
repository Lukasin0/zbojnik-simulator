import * as THREE from 'three';
import type { QualityPreset } from '@/config/quality';
import { mulberry32 } from '@/utils/math-utils';
import { createFlowerGeometry, createGrassTuftGeometry } from './props';
import { colorAt, flowerNoise, grassCover, outsideDistance } from './terrain';

/** Uniforms shared by every wind-swayed material. */
export interface WindUniforms {
  uWindTime: { value: number };
  uWindStrength: { value: number };
  /** Grass/flowers shrink into the ground towards this camera distance. */
  uFadeDist: { value: number };
}

export interface WindOptions {
  /** Local geometry height at which the full bend applies. */
  height: number;
  /** Bend amplitude in metres at `height` (at wind strength 1). */
  amp: number;
  /** Oscillation speed. */
  speed: number;
  /** Shrink with camera distance (grass). */
  fade?: boolean;
}

/**
 * Patches an (instanced) material so its vertices sway with the wind – bend grows with the square of the
 * local height, phase varies per instance. Works on MeshStandardMaterial and MeshDepthMaterial (shadows).
 * Engine-specific – in Unity this becomes a vegetation shader.
 */
export function applyWind<T extends THREE.Material>(material: T, u: WindUniforms, o: WindOptions): T {
  const f = (n: number): string => n.toFixed(3);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;\nuniform float uWindStrength;\nuniform float uFadeDist;')
      .replace(
        '#include <project_vertex>',
        `vec4 wPos = vec4( transformed, 1.0 );
        vec3 wBase = vec3( 0.0 );
        #ifdef USE_INSTANCING
          wPos = instanceMatrix * wPos;
          wBase = instanceMatrix[3].xyz;
        #endif
        wPos = modelMatrix * wPos;
        wBase = ( modelMatrix * vec4( wBase, 1.0 ) ).xyz;
        float wPh = dot( wBase.xz, vec2( 0.13, 0.09 ) );
        float wGust = 0.55 + 0.45 * sin( uWindTime * 0.31 + wBase.x * 0.011 - wBase.z * 0.007 );
        float wSway = sin( uWindTime * ${f(o.speed)} + wPh ) * 0.7 + sin( uWindTime * ${f(o.speed * 2.3)} + wPh * 1.7 ) * 0.3;
        float wK = clamp( transformed.y / ${f(o.height)}, 0.0, 1.0 );
        wPos.xz += vec2( 0.85, 0.5 ) * ( wSway * wGust + 0.5 * wGust ) * wK * wK * ${f(o.amp)} * uWindStrength;
        ${
          o.fade
            ? `float wFade = 1.0 - smoothstep( uFadeDist * 0.7, uFadeDist, distance( wBase.xz, cameraPosition.xz ) );
        wPos.xyz = wBase + ( wPos.xyz - wBase ) * wFade;`
            : ''
        }
        vec4 mvPosition = viewMatrix * wPos;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  material.customProgramCacheKey = () => `wind|${o.height}|${o.amp}|${o.speed}|${o.fade ? 1 : 0}`;
  return material;
}

/** Shadow-pass twin of a wind material so swaying crowns cast swaying shadows. */
export function windDepthMaterial(u: WindUniforms, o: WindOptions): THREE.MeshDepthMaterial {
  return applyWind(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), u, o);
}

interface GrassChunk {
  cx: number;
  cz: number;
  grass: THREE.InstancedMesh;
  flowers: THREE.InstancedMesh | null;
}

const CHUNK = 32;
/** Sampling cell; each accepted cell spawns a small clump of tufts. */
const CELL = 2.1;
const MAX_TUFTS_PER_CELL = 5;

const FLOWER_COLORS = [0xf3f0e4, 0xf3f0e4, 0xe9c83c, 0xe9c83c, 0x9d7fd0, 0x7895dc, 0xc9452f];

export interface VegetationHost {
  groundHeight(x: number, z: number): number;
  /** Something solid (house, fence, rock…) stands here. */
  isBlocked(x: number, z: number, pad: number): boolean;
}

/**
 * Small vegetation: instanced grass tufts + wildflowers in 32 m chunks (culled by distance),
 * and the shared wind uniforms for trees and bushes.
 */
export class Vegetation {
  readonly root = new THREE.Group();
  readonly wind: WindUniforms = {
    uWindTime: { value: 0 },
    uWindStrength: { value: 0.5 },
    uFadeDist: { value: 80 },
  };
  private readonly chunks: GrassChunk[] = [];
  private density = 1;
  private windOn = true;
  private readonly grassMat: THREE.MeshStandardMaterial;
  private readonly flowerMat: THREE.MeshStandardMaterial;

  constructor() {
    this.root.name = 'vegetation';
    this.grassMat = applyWind(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
      this.wind,
      { height: 0.6, amp: 0.16, speed: 2.1, fade: true },
    );
    this.flowerMat = applyWind(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
      this.wind,
      { height: 0.4, amp: 0.1, speed: 2.4, fade: true },
    );
  }

  /** Scatter grass over the open valley. Call once after all colliders exist. */
  buildGrass(host: VegetationHost, minX: number, maxX: number, minZ: number, maxZ: number): void {
    const rng = mulberry32(4242);
    const tuft = createGrassTuftGeometry(6);
    const flower = createFlowerGeometry();
    const buckets = new Map<number, { cx: number; cz: number; g: number[]; gc: number[]; f: number[]; fc: number[] }>();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const fcol = new THREE.Color();

    for (let z = minZ; z < maxZ; z += CELL) {
      for (let x = minX; x < maxX; x += CELL) {
        if (outsideDistance(x, z) > 4) continue;
        const h = host.groundHeight(x, z);
        const slope = (Math.abs(host.groundHeight(x + 2, z) - h) + Math.abs(host.groundHeight(x, z + 2) - h)) / 2;
        const cover = grassCover(x, z, h, slope);
        if (cover < 0.12 || host.isBlocked(x, z, 0.5)) continue;
        const cx = Math.floor(x / CHUNK);
        const cz = Math.floor(z / CHUNK);
        const key = (cx + 500) * 1000 + (cz + 500);
        let b = buckets.get(key);
        if (!b) {
          b = { cx, cz, g: [], gc: [], f: [], fc: [] };
          buckets.set(key, b);
        }
        colorAt(x, z, h, slope, col);
        const n = Math.round(cover * MAX_TUFTS_PER_CELL * (0.6 + rng() * 0.6));
        for (let i = 0; i < n; i++) {
          const tx = x + rng() * CELL;
          const tz = z + rng() * CELL;
          const ty = host.groundHeight(tx, tz) - 0.03;
          const sc = 0.7 + rng() * 0.6 + cover * 0.35;
          q.setFromAxisAngle(up, rng() * Math.PI * 2);
          s.set(sc, sc * (0.75 + rng() * 0.5), sc);
          m.compose(p.set(tx, ty, tz), q, s);
          b.g.push(...m.elements);
          const v = 0.95 + rng() * 0.25;
          b.gc.push(col.r * v, col.g * v * 1.04, col.b * v);
        }
        const fl = flowerNoise(x, z);
        if (fl > 0.05 && rng() < fl * 0.9) {
          const nf = 1 + Math.floor(rng() * 3 * fl);
          const hue = FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)];
          for (let i = 0; i < nf; i++) {
            const tx = x + rng() * CELL;
            const tz = z + rng() * CELL;
            const sc = 0.8 + rng() * 0.5;
            q.setFromAxisAngle(up, rng() * Math.PI * 2);
            m.compose(p.set(tx, host.groundHeight(tx, tz) - 0.02, tz), q, s.set(sc, sc * (0.8 + rng() * 0.5), sc));
            b.f.push(...m.elements);
            fcol.setHex(rng() < 0.75 ? hue : FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)]);
            b.fc.push(fcol.r, fcol.g, fcol.b);
          }
        }
      }
    }

    for (const b of buckets.values()) {
      const grass = this.makeInstanced(tuft, this.grassMat, b.g, b.gc, rng);
      if (!grass) continue;
      const flowers = this.makeInstanced(flower, this.flowerMat, b.f, b.fc, rng);
      this.chunks.push({ cx: b.cx, cz: b.cz, grass, flowers });
      this.root.add(grass);
      if (flowers) this.root.add(flowers);
    }
    this.applyDensity();
  }

  /** Builds an InstancedMesh with instances shuffled, so any prefix (`count`) is an even thinning. */
  private makeInstanced(
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    mats: number[],
    cols: number[],
    rng: () => number,
  ): THREE.InstancedMesh | null {
    const count = mats.length / 16;
    if (count === 0) return null;
    const order = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const im = new THREE.InstancedMesh(geo, material, count);
    const arr = im.instanceMatrix.array as Float32Array;
    const colors = new Float32Array(count * 3);
    order.forEach((src, dst) => {
      for (let k = 0; k < 16; k++) arr[dst * 16 + k] = mats[src * 16 + k];
      for (let k = 0; k < 3; k++) colors[dst * 3 + k] = cols[src * 3 + k];
    });
    im.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = false;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    im.userData.total = count;
    return im;
  }

  setQuality(p: QualityPreset): void {
    this.density = p.grassDensity;
    this.wind.uFadeDist.value = p.grassDistance;
    this.windOn = p.wind;
    this.applyDensity();
  }

  private applyDensity(): void {
    for (const c of this.chunks) {
      for (const im of [c.grass, c.flowers]) {
        if (im) im.count = Math.floor((im.userData.total as number) * this.density);
      }
    }
  }

  /** Per frame: wind time/strength and distance culling of grass chunks. `wind` = weather wind 0..1. */
  update(time: number, camera: THREE.Vector3, wind: number): void {
    this.wind.uWindTime.value = time;
    const target = this.windOn ? 0.35 + wind * 1.1 : 0;
    this.wind.uWindStrength.value += (target - this.wind.uWindStrength.value) * 0.02;
    const reach = this.wind.uFadeDist.value + CHUNK * 0.75;
    const show = this.density > 0;
    for (const c of this.chunks) {
      const dx = (c.cx + 0.5) * CHUNK - camera.x;
      const dz = (c.cz + 0.5) * CHUNK - camera.z;
      const vis = show && dx * dx + dz * dz < reach * reach;
      c.grass.visible = vis;
      if (c.flowers) c.flowers.visible = vis;
    }
  }
}
