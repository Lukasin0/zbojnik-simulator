import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface MatOptions {
  emissive?: number;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  map?: THREE.Texture;
  flat?: boolean;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Cached flat-shaded low-poly material. */
export function mat(color: number, o: MatOptions = {}): THREE.MeshStandardMaterial {
  const key = [
    color,
    o.emissive ?? 0,
    o.emissiveIntensity ?? 1,
    o.roughness ?? 0.9,
    o.metalness ?? 0,
    o.opacity ?? 1,
    o.map?.uuid ?? '',
    o.flat ?? true,
  ].join('|');
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      flatShading: o.flat ?? true,
      roughness: o.roughness ?? 0.9,
      metalness: o.metalness ?? 0,
      emissive: o.emissive ?? 0,
      emissiveIntensity: o.emissiveIntensity ?? 1,
      transparent: o.transparent ?? false,
      opacity: o.opacity ?? 1,
      map: o.map ?? null,
    });
    cache.set(key, m);
  }
  return m;
}

export function part(geo: THREE.BufferGeometry, color: number, o?: MatOptions): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color, o));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T {
  obj.position.set(x, y, z);
  obj.rotation.set(rx, ry, rz);
  return obj;
}

const stripeCache = new Map<string, THREE.CanvasTexture>();

/** Horizontal stripes – the black & white onuce of the zbojník costume. */
export function stripeTexture(a: number, b: number, bands: number): THREE.CanvasTexture {
  const key = `${a}-${b}-${bands}`;
  const cached = stripeCache.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = bands * 8;
  const g = c.getContext('2d');
  if (g) {
    for (let i = 0; i < bands; i++) {
      g.fillStyle = `#${(i % 2 === 0 ? a : b).toString(16).padStart(6, '0')}`;
      g.fillRect(0, i * 8, 4, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  stripeCache.set(key, tex);
  return tex;
}

/** Wooden sign board with painted text. */
export function signTexture(text: string, bg = '#4a3220', fg = '#f0e2c0'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 96);
    g.strokeStyle = '#2a1a10';
    g.lineWidth = 8;
    g.strokeRect(4, 4, 248, 88);
    g.fillStyle = fg;
    g.font = 'bold 52px "Alegreya SC", Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 52);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Merge every mesh of a static prop into one mesh per material – a whole house
 * becomes 3–6 draw calls instead of 40. Meshes with textures stay untouched.
 */
export function bakeStatic(group: THREE.Group): THREE.Group {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const keep: THREE.Object3D[] = [];
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const material = obj.material as THREE.MeshStandardMaterial;
    if (Array.isArray(obj.material) || material.map) {
      keep.push(obj);
      return;
    }
    const src = obj.geometry as THREE.BufferGeometry;
    const g = src.index ? src.toNonIndexed() : src.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, obj.matrixWorld));
    const list = buckets.get(material) ?? [];
    list.push(g);
    buckets.set(material, list);
  });
  const out = new THREE.Group();
  out.position.copy(group.position);
  out.rotation.copy(group.rotation);
  out.scale.copy(group.scale);
  for (const [material, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, material);
    m.castShadow = true;
    m.receiveShadow = true;
    out.add(m);
  }
  for (const k of keep) {
    const clone = k.clone();
    clone.matrix.multiplyMatrices(inv, k.matrixWorld);
    clone.matrix.decompose(clone.position, clone.quaternion, clone.scale);
    out.add(clone);
  }
  return out;
}
