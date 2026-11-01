import * as THREE from 'three';
import { LOC, WATER_LEVEL } from '@/config/constants';

/** Tileable value-noise texture (lattice wraps every `period` cells). */
function tileableNoiseTexture(size: number, period: number): THREE.DataTexture {
  const hash = (x: number, y: number, per: number): number => {
    const ix = ((x % per) + per) % per;
    const iy = ((y % per) + per) % per;
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x: number, y: number, per: number): number => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, per);
    const b = hash(ix + 1, iy, per);
    const c = hash(ix, iy + 1, per);
    const d = hash(ix + 1, iy + 1, per);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 0.5;
      let f = 1;
      let norm = 0;
      for (let o = 0; o < 4; o++) {
        // octave frequencies are integer multiples of the base period → still tileable
        const p = period * f;
        v += amp * noise((x / size) * p, (y / size) * p, p);
        norm += amp;
        amp *= 0.5;
        f *= 2;
      }
      const k = (y * size + x) * 4;
      const n = Math.round((v / norm) * 255);
      data[k] = data[k + 1] = data[k + 2] = n;
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

const WHITE = new THREE.Color(1, 1, 1);

interface Layer {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  strength: number;
}

/**
 * Low-lying mist: a few stacked, slowly scrolling noise sheets over the Váh valley and the
 * village meadows. Strongest at dawn, lighter at night, gone at noon.
 */
export class Mist {
  readonly root = new THREE.Group();
  private readonly layers: Layer[] = [];
  private enabled = true;

  constructor(groundAt: (x: number, z: number) => number) {
    const tex = tileableNoiseTexture(128, 4);
    const above = (x: number, z: number, offsets: number[]): number[] => offsets.map((o) => groundAt(x, z) + o);
    const areas: { x: number; z: number; w: number; d: number; heights: number[] }[] = [
      { x: 110, z: 122, w: 760, d: 100, heights: [WATER_LEVEL + 1.1, WATER_LEVEL + 2.4, WATER_LEVEL + 3.8] },
      { x: LOC.village.x, z: LOC.village.z, w: 190, d: 190, heights: above(LOC.village.x, LOC.village.z, [0.7, 2.0]) },
      { x: LOC.salas.x, z: LOC.salas.z, w: 90, d: 90, heights: above(LOC.salas.x, LOC.salas.z, [0.8, 2.2]) },
    ];
    let seed = 0;
    for (const a of areas) {
      a.heights.forEach((h, i) => {
        const material = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          fog: false,
          side: THREE.DoubleSide,
          uniforms: {
            uTex: { value: tex },
            uTime: { value: 0 },
            uOpacity: { value: 0 },
            uColor: { value: new THREE.Color(0xd8dee0) },
            uScale: { value: new THREE.Vector2(a.w / 40, a.d / 40) },
            uSeed: { value: seed++ * 0.37 },
          },
          vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            uniform sampler2D uTex;
            uniform float uTime;
            uniform float uOpacity;
            uniform vec3 uColor;
            uniform vec2 uScale;
            uniform float uSeed;
            varying vec2 vUv;
            void main() {
              vec2 p = vUv * uScale;
              float n1 = texture2D(uTex, p * 0.35 + vec2(uTime * 0.006 + uSeed, uTime * 0.002)).r;
              float n2 = texture2D(uTex, p * 0.8 - vec2(uTime * 0.004, uTime * 0.007 - uSeed)).r;
              float n = n1 * 0.65 + n2 * 0.35;
              // soft oval edge so the sheet never shows a border
              vec2 q = (vUv - 0.5) * 2.0;
              float edge = smoothstep(1.0, 0.55, length(q));
              float a = smoothstep(0.38, 0.75, n) * edge * uOpacity;
              gl_FragColor = vec4(uColor, a);
              #include <colorspace_fragment>
            }
          `,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(a.w, a.d), material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(a.x, h, a.z);
        mesh.renderOrder = 2;
        mesh.frustumCulled = true;
        this.root.add(mesh);
        // the higher sheets are thinner
        this.layers.push({ mesh, material, strength: 1 - i * 0.28 });
      });
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.root.visible = on;
  }

  /** amount 0..1 from the day/night cycle; color follows the fog. */
  update(time: number, amount: number, color: THREE.Color): void {
    if (!this.enabled) return;
    this.root.visible = amount > 0.01;
    if (!this.root.visible) return;
    for (const l of this.layers) {
      l.material.uniforms.uTime.value = time;
      l.material.uniforms.uOpacity.value = amount * 0.8 * l.strength;
      (l.material.uniforms.uColor.value as THREE.Color).copy(color).lerp(WHITE, 0.25);
    }
  }
}
