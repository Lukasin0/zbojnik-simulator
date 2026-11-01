import * as THREE from 'three';
import type { AudioManager } from '@/systems/audio-manager';
import { damp } from '@/utils/math-utils';

export type WeatherKind = 'jasno' | 'oblacno' | 'dazd' | 'burka';

interface WeatherTarget {
  overcast: number;
  rain: number;
  wind: number;
  fogMul: number;
}

const TARGETS: Record<WeatherKind, WeatherTarget> = {
  jasno: { overcast: 0, rain: 0, wind: 0.15, fogMul: 1 },
  oblacno: { overcast: 0.55, rain: 0, wind: 0.35, fogMul: 1.12 },
  dazd: { overcast: 0.85, rain: 0.75, wind: 0.5, fogMul: 1.45 },
  burka: { overcast: 1, rain: 1, wind: 0.95, fogMul: 1.6 },
};

const LABELS: Record<WeatherKind, string> = {
  jasno: '',
  oblacno: 'Zamračené',
  dazd: 'Dážď',
  burka: 'Búrka',
};

/** Chance of each weather when the sky changes its mind. */
const ODDS: [WeatherKind, number][] = [
  ['jasno', 0.42],
  ['oblacno', 0.3],
  ['dazd', 0.2],
  ['burka', 0.08],
];

const MAX_DROPS = 5000;
const BOX = new THREE.Vector3(36, 22, 36);

/** What the day/night cycle needs to know about the weather. */
export interface WeatherState {
  overcast: number;
  rain: number;
  fogMul: number;
  flash: number;
}

/**
 * Liptov weather: clear, overcast, rain and thunderstorms with smooth transitions.
 * Owns the GPU rain streaks, lightning bolts and the rain / wind / thunder ambience.
 */
export class Weather implements WeatherState {
  kind: WeatherKind = 'jasno';
  overcast = 0;
  rain = 0;
  wind = 0.15;
  fogMul = 1;
  /** 0..1 – ground gets wet in rain and dries slowly afterwards */
  wetness = 0;
  /** lightning flash 0..1 */
  flash = 0;
  private nextChange = 240;
  private lightningIn = 10;
  private pendingThunder: { at: number; volume: number } | null = null;
  private clock = 0;
  private readonly rainMesh: THREE.LineSegments;
  private readonly rainMat: THREE.ShaderMaterial;
  private readonly bolt: THREE.Line;
  private boltLife = 0;
  private boltRequest = false;
  private windAngle = 0.6;

  constructor(scene: THREE.Scene) {
    const offsets = new Float32Array(MAX_DROPS * 2 * 3);
    const ends = new Float32Array(MAX_DROPS * 2);
    const rands = new Float32Array(MAX_DROPS * 2);
    for (let i = 0; i < MAX_DROPS; i++) {
      const x = Math.random() * BOX.x;
      const y = Math.random() * BOX.y;
      const z = Math.random() * BOX.z;
      const r = Math.random();
      for (let k = 0; k < 2; k++) {
        const v = i * 2 + k;
        offsets.set([x, y, z], v * 3);
        ends[v] = k;
        rands[v] = r;
      }
    }
    const geo = new THREE.BufferGeometry();
    // `position` is required by three.js – the shader uses aOffset instead
    geo.setAttribute('position', new THREE.BufferAttribute(offsets, 3));
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rands, 1));
    this.rainMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uIntensity: { value: 0 },
        uWind: { value: new THREE.Vector2() },
        uColor: { value: new THREE.Color(0xc8d4dc) },
        uBox: { value: BOX.clone() },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aOffset;
        attribute float aEnd;
        attribute float aRand;
        uniform float uTime;
        uniform vec3 uCenter;
        uniform float uIntensity;
        uniform vec2 uWind;
        uniform vec3 uBox;
        varying float vAlpha;
        void main() {
          vec3 fall = vec3(uWind.x, -1.0, uWind.y) * (15.0 + aRand * 7.0);
          vec3 p = aOffset + fall * uTime;
          // wrap the drop into a box that travels with the camera
          p = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5 + uCenter;
          p -= normalize(fall) * aEnd * (0.6 + aRand * 0.5);
          vAlpha = aRand < uIntensity ? (0.38 + 0.35 * aRand) * (1.0 - aEnd * 0.8) : 0.0;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          if (vAlpha <= 0.0) discard;
          gl_FragColor = vec4(uColor, vAlpha);
        }
      `,
    });
    this.rainMesh = new THREE.LineSegments(geo, this.rainMat);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.renderOrder = 3;
    this.rainMesh.visible = false;
    scene.add(this.rainMesh);

    const boltGeo = new THREE.BufferGeometry();
    boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
    this.bolt = new THREE.Line(boltGeo, new THREE.LineBasicMaterial({ color: 0xeef4ff, fog: false, transparent: true }));
    this.bolt.frustumCulled = false;
    this.bolt.visible = false;
    scene.add(this.bolt);
  }

  setDropCount(count: number): void {
    this.rainMesh.geometry.setDrawRange(0, Math.min(MAX_DROPS, count) * 2);
  }

  /** Clear sky immediately (new game / back to menu). */
  reset(): void {
    this.set('jasno');
    this.overcast = 0;
    this.rain = 0;
    this.wind = 0.15;
    this.fogMul = 1;
    this.wetness = 0;
    this.flash = 0;
    this.pendingThunder = null;
  }

  set(kind: WeatherKind): void {
    this.kind = kind;
    this.nextChange = 180 + Math.random() * 300;
  }

  label(): string {
    return LABELS[this.kind];
  }

  icon(night: boolean): string {
    if (this.kind === 'burka') return '⛈';
    if (this.kind === 'dazd') return '🌧';
    if (this.kind === 'oblacno') return '☁';
    return night ? '☾' : '☀';
  }

  /** Simulation tick: transitions, wetness, lightning timing. */
  update(dt: number, rng: () => number): void {
    this.clock += dt;
    this.nextChange -= dt;
    if (this.nextChange <= 0) {
      let r = rng();
      let pick: WeatherKind = 'jasno';
      for (const [k, p] of ODDS) {
        if ((r -= p) <= 0) {
          pick = k;
          break;
        }
      }
      // storms do not appear out of a clear sky
      if (pick === 'burka' && this.kind === 'jasno') pick = 'oblacno';
      this.set(pick);
    }
    const t = TARGETS[this.kind];
    const rate = 0.05;
    this.overcast = damp(this.overcast, t.overcast, rate, dt);
    this.rain = damp(this.rain, t.rain, rate * 1.4, dt);
    this.wind = damp(this.wind, t.wind, rate, dt);
    this.fogMul = damp(this.fogMul, t.fogMul, rate, dt);
    this.windAngle += dt * 0.02;
    if (this.rain > 0.1) this.wetness = Math.min(1, this.wetness + dt * this.rain * 0.03);
    else this.wetness = Math.max(0, this.wetness - dt * 0.008);

    if (this.kind === 'burka' && this.overcast > 0.8) {
      this.lightningIn -= dt;
      if (this.lightningIn <= 0) {
        this.lightningIn = 7 + rng() * 14;
        this.flash = 1;
        this.boltRequest = true;
        const distance = 0.4 + rng() * 0.6;
        this.pendingThunder = { at: this.clock + distance * 3, volume: 1.2 - distance * 0.6 };
      }
    }
  }

  /** Per-frame visuals and sound. */
  render(
    frameDt: number,
    camera: THREE.Vector3,
    player: THREE.Vector3,
    audio: AudioManager,
    groundAt: (x: number, z: number) => number,
  ): void {
    const u = this.rainMat.uniforms;
    u.uTime.value = this.clock;
    u.uCenter.value.copy(camera);
    u.uIntensity.value = this.rain;
    (u.uWind.value as THREE.Vector2).set(Math.cos(this.windAngle), Math.sin(this.windAngle)).multiplyScalar(this.wind * 0.45);
    this.rainMesh.visible = this.rain > 0.02;

    // flash: a quick double flicker
    this.flash = Math.max(0, this.flash - frameDt * 4.5);
    if (this.boltRequest) {
      this.boltRequest = false;
      this.placeBolt(player, groundAt);
    }
    if (this.boltLife > 0) {
      this.boltLife -= frameDt;
      this.bolt.visible = this.boltLife > 0 && Math.sin(this.boltLife * 60) > -0.3;
    }
    if (this.pendingThunder && this.clock >= this.pendingThunder.at) {
      audio.play('thunder', { volume: this.pendingThunder.volume });
      this.pendingThunder = null;
    }
    audio.setAmbience(this.rain, this.wind);
  }

  private placeBolt(player: THREE.Vector3, groundAt: (x: number, z: number) => number): void {
    const a = Math.random() * Math.PI * 2;
    const d = 140 + Math.random() * 120;
    const x = player.x + Math.cos(a) * d;
    const z = player.z + Math.sin(a) * d;
    const ground = groundAt(x, z);
    const pos = this.bolt.geometry.attributes.position as THREE.BufferAttribute;
    const n = pos.count;
    let px = x;
    let pz = z;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      px += (Math.random() - 0.5) * 9;
      pz += (Math.random() - 0.5) * 9;
      pos.setXYZ(i, px, ground + 170 * (1 - t), pz);
    }
    pos.setXYZ(n - 1, px, ground, pz);
    pos.needsUpdate = true;
    this.boltLife = 0.28;
    this.bolt.visible = true;
  }
}
