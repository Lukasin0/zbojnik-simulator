import * as THREE from 'three';

const SAMPLES = 14;
const LIFE = 0.16;

interface Sample {
  base: THREE.Vector3;
  tip: THREE.Vector3;
  age: number;
}

/** Fading ribbon swept by the valaška blade during a swing. */
export class WeaponTrail {
  readonly mesh: THREE.Mesh;
  private readonly samples: Sample[] = [];
  private readonly positions: Float32Array;
  private readonly alphas: Float32Array;
  private readonly geometry = new THREE.BufferGeometry();

  constructor(scene: THREE.Scene, color = 0xfff2d8) {
    this.positions = new Float32Array(SAMPLES * 2 * 3);
    this.alphas = new Float32Array(SAMPLES * 2);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    const index: number[] = [];
    for (let i = 0; i < SAMPLES - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry.setIndex(index);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(color) } },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, vAlpha * 0.55);
        }
      `,
    });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** Call every rendered frame; `active` = the blade is in its striking phase. */
  update(dt: number, active: boolean, base: THREE.Vector3, tip: THREE.Vector3): void {
    for (const s of this.samples) s.age += dt;
    while (this.samples.length > 0 && this.samples[this.samples.length - 1].age > LIFE) this.samples.pop();
    if (active) {
      this.samples.unshift({ base: base.clone(), tip: tip.clone(), age: 0 });
      if (this.samples.length > SAMPLES) this.samples.length = SAMPLES;
    }
    this.mesh.visible = this.samples.length > 1;
    if (!this.mesh.visible) return;
    for (let i = 0; i < SAMPLES; i++) {
      const s = this.samples[Math.min(i, this.samples.length - 1)];
      const fade = i < this.samples.length ? Math.max(0, 1 - s.age / LIFE) * (1 - i / SAMPLES) : 0;
      // the ribbon is widest at the blade, thin toward the grip
      this.positions.set([s.base.x, s.base.y, s.base.z, s.tip.x, s.tip.y, s.tip.z], i * 6);
      this.alphas[i * 2] = fade * 0.15;
      this.alphas[i * 2 + 1] = fade;
    }
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }
}
