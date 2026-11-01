import * as THREE from 'three';
import type { App } from '@/core/app';
import { clamp, smoothstep } from '@/utils/math-utils';
import type { WeatherState } from './weather';

/** Hex values of one atmosphere keyframe. */
interface KeyHex {
  top: number;
  horizon: number;
  light: number;
  lightIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  fogDensity: number;
  exposure: number;
  cloudLit: number;
  cloudShade: number;
  mist: number;
}

interface Key {
  top: THREE.Color;
  horizon: THREE.Color;
  light: THREE.Color;
  lightIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  fogDensity: number;
  exposure: number;
  cloudLit: THREE.Color;
  cloudShade: THREE.Color;
  mist: number;
}

/** Hour → look of the Liptov sky. The light colour at night is moonlight. */
const KEYFRAMES: [number, KeyHex][] = [
  [0, { top: 0x0a1222, horizon: 0x1c2638, light: 0x7f98c8, lightIntensity: 0.55, hemiSky: 0x34466a, hemiGround: 0x141a14, hemiIntensity: 0.75, fogDensity: 0.0105, exposure: 1.35, cloudLit: 0x3a4458, cloudShade: 0x161c28, mist: 0.45 }],
  [4.5, { top: 0x141c34, horizon: 0x3a3a52, light: 0x8094c0, lightIntensity: 0.45, hemiSky: 0x3c4868, hemiGround: 0x181c16, hemiIntensity: 0.75, fogDensity: 0.011, exposure: 1.3, cloudLit: 0x4a4a62, cloudShade: 0x1e2232, mist: 0.75 }],
  [6, { top: 0x46607e, horizon: 0xcfb0a0, light: 0xffb47c, lightIntensity: 1.1, hemiSky: 0xa4acc0, hemiGround: 0x3e3a2a, hemiIntensity: 1.1, fogDensity: 0.0115, exposure: 1.15, cloudLit: 0xffc8a0, cloudShade: 0x6a6070, mist: 1 }],
  [8, { top: 0x587090, horizon: 0xc8c4b4, light: 0xffdcb0, lightIntensity: 2.1, hemiSky: 0xc4d0dc, hemiGround: 0x545a36, hemiIntensity: 1.45, fogDensity: 0.0098, exposure: 1.06, cloudLit: 0xf6ece0, cloudShade: 0x8c94a0, mist: 0.85 }],
  [10.5, { top: 0x5a7ca2, horizon: 0xaebcc0, light: 0xffecd2, lightIntensity: 2.6, hemiSky: 0xd0dce6, hemiGround: 0x5a6038, hemiIntensity: 1.6, fogDensity: 0.0082, exposure: 1.04, cloudLit: 0xf6f2ec, cloudShade: 0x9098a4, mist: 0.15 }],
  [13.5, { top: 0x5480ac, horizon: 0xb4c4c8, light: 0xfff2dc, lightIntensity: 2.8, hemiSky: 0xd4e0ea, hemiGround: 0x5e6438, hemiIntensity: 1.7, fogDensity: 0.0075, exposure: 1.02, cloudLit: 0xffffff, cloudShade: 0x98a0ac, mist: 0 }],
  [17, { top: 0x5a7496, horizon: 0xbcb6a2, light: 0xffd8a0, lightIntensity: 2.3, hemiSky: 0xcccad0, hemiGround: 0x5a5634, hemiIntensity: 1.5, fogDensity: 0.0082, exposure: 1.05, cloudLit: 0xfce6c8, cloudShade: 0x948e94, mist: 0 }],
  [19.3, { top: 0x405078, horizon: 0xd49a78, light: 0xff9a5a, lightIntensity: 1.35, hemiSky: 0xa898a4, hemiGround: 0x403022, hemiIntensity: 1.1, fogDensity: 0.0086, exposure: 1.12, cloudLit: 0xff9c6a, cloudShade: 0x5a4a5c, mist: 0.1 }],
  [20.6, { top: 0x1c2444, horizon: 0x4a3a52, light: 0x8a8cc0, lightIntensity: 0.5, hemiSky: 0x40486a, hemiGround: 0x1c1a16, hemiIntensity: 0.8, fogDensity: 0.0098, exposure: 1.28, cloudLit: 0x5a4a62, cloudShade: 0x1e1e2e, mist: 0.3 }],
  [24, { top: 0x0a1222, horizon: 0x1c2638, light: 0x7f98c8, lightIntensity: 0.55, hemiSky: 0x34466a, hemiGround: 0x141a14, hemiIntensity: 0.75, fogDensity: 0.0105, exposure: 1.35, cloudLit: 0x3a4458, cloudShade: 0x161c28, mist: 0.45 }],
];

function toKey(h: KeyHex): Key {
  return {
    top: new THREE.Color(h.top),
    horizon: new THREE.Color(h.horizon),
    light: new THREE.Color(h.light),
    lightIntensity: h.lightIntensity,
    hemiSky: new THREE.Color(h.hemiSky),
    hemiGround: new THREE.Color(h.hemiGround),
    hemiIntensity: h.hemiIntensity,
    fogDensity: h.fogDensity,
    exposure: h.exposure,
    cloudLit: new THREE.Color(h.cloudLit),
    cloudShade: new THREE.Color(h.cloudShade),
    mist: h.mist,
  };
}

const KEYS: [number, Key][] = KEYFRAMES.map(([t, k]) => [t, toKey(k)]);

const tmpGrey = new THREE.Color();
const STORM_SHADE = new THREE.Color(0x3a4048);
const FLASH = new THREE.Color(0xeef2ff);

/** World-side reaction to darkness (lit windows, brighter fires, mist). */
export interface NightReceiver {
  setNight(night: number): void;
  updateMist(time: number, amount: number, color: THREE.Color): void;
}

const SUNRISE = 5.5;
const DAY_LENGTH = 15;

/**
 * Time of day for the whole valley: sun and moon paths, sky / fog / light colours,
 * exposure, mist and night lighting. One in-game hour lasts one real minute.
 */
export class DayNight {
  /** Hours 0..24 */
  time = 8.5;
  /** In-game hours per real second. */
  speed = 1 / 60;
  readonly sunDir = new THREE.Vector3();
  readonly moonDir = new THREE.Vector3();
  /** 0 = full day, 1 = deep night */
  night = 0;
  private elapsed = 0;
  private readonly cur = toKey(KEYFRAMES[0][1]);
  private readonly lightDir = new THREE.Vector3();

  update(dt: number): void {
    this.time = (this.time + dt * this.speed) % 24;
  }

  setTime(hours: number): void {
    this.time = ((hours % 24) + 24) % 24;
  }

  private sample(t: number): void {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= t) i++;
    const [t0, a] = KEYS[i];
    const [t1, b] = KEYS[i + 1];
    const f = smoothstep(0, 1, clamp((t - t0) / (t1 - t0), 0, 1));
    const c = this.cur;
    c.top.lerpColors(a.top, b.top, f);
    c.horizon.lerpColors(a.horizon, b.horizon, f);
    c.light.lerpColors(a.light, b.light, f);
    c.hemiSky.lerpColors(a.hemiSky, b.hemiSky, f);
    c.hemiGround.lerpColors(a.hemiGround, b.hemiGround, f);
    c.cloudLit.lerpColors(a.cloudLit, b.cloudLit, f);
    c.cloudShade.lerpColors(a.cloudShade, b.cloudShade, f);
    c.lightIntensity = a.lightIntensity + (b.lightIntensity - a.lightIntensity) * f;
    c.hemiIntensity = a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * f;
    c.fogDensity = a.fogDensity + (b.fogDensity - a.fogDensity) * f;
    c.exposure = a.exposure + (b.exposure - a.exposure) * f;
    c.mist = a.mist + (b.mist - a.mist) * f;
  }

  private computeCelestial(): void {
    const t = this.time;
    // sun rises in the east (+x), culminates in the south (+z), sets in the west
    const a = (Math.PI * (t - SUNRISE)) / DAY_LENGTH;
    this.sunDir.set(Math.cos(a), Math.sin(a) * 0.85, 0.35 + Math.max(0, Math.sin(a)) * 0.45).normalize();
    // the moon rises in the evening and sets in the morning
    const m = (Math.PI * (((t - 19 + 24) % 24) / 12));
    this.moonDir.set(Math.cos(m), Math.sin(m) * 0.75, 0.25).normalize();
    this.night = 1 - smoothstep(-0.14, 0.1, this.sunDir.y);
  }

  /** Grey-out and darken the palette under clouds; lightning brightens everything. */
  private applyWeather(w: WeatherState): void {
    const c = this.cur;
    const o = w.overcast;
    if (o > 0.001) {
      for (const col of [c.top, c.horizon, c.light, c.hemiSky, c.cloudLit]) {
        const lum = col.r * 0.3 + col.g * 0.59 + col.b * 0.11;
        tmpGrey.setRGB(lum, lum, lum);
        col.lerp(tmpGrey, o * 0.6);
      }
      c.top.multiplyScalar(1 - o * 0.3);
      c.cloudShade.lerp(STORM_SHADE, o * 0.8);
      c.lightIntensity *= 1 - o * 0.65;
      c.hemiIntensity *= 1 - o * 0.22;
    }
    c.fogDensity *= w.fogMul;
    if (w.flash > 0) {
      c.top.lerp(FLASH, w.flash * 0.7);
      c.horizon.lerp(FLASH, w.flash * 0.4);
      c.hemiIntensity += w.flash * 3;
      c.exposure += w.flash * 0.8;
    }
  }

  /** Push the current time of day (and weather) into the renderer, sky and world. */
  apply(app: App, world: NightReceiver, focus: THREE.Vector3, frameDt: number, weather: WeatherState | null): void {
    this.elapsed += frameDt;
    this.computeCelestial();
    this.sample(this.time);
    if (weather) this.applyWeather(weather);
    const c = this.cur;

    // sun by day, moon by night – fade the light out around the hand-over to hide the jump
    const useSun = this.sunDir.y > -0.02;
    this.lightDir.copy(useSun ? this.sunDir : this.moonDir);
    const handover = smoothstep(0.02, 0.14, Math.abs(this.lightDir.y));
    app.sun.position.copy(focus).addScaledVector(this.lightDir, 90);
    app.sun.target.position.copy(focus);
    app.sun.color.copy(c.light);
    app.sun.intensity = c.lightIntensity * handover;

    app.hemi.color.copy(c.hemiSky);
    app.hemi.groundColor.copy(c.hemiGround);
    app.hemi.intensity = c.hemiIntensity;
    app.fog.color.copy(c.horizon);
    app.fog.density = c.fogDensity;
    (app.scene.background as THREE.Color).copy(c.horizon);
    app.renderer.toneMappingExposure = c.exposure;

    const u = app.sky.uniforms;
    u.uTop.value.copy(c.top);
    u.uHorizon.value.copy(c.horizon);
    u.uSunDir.value.copy(this.sunDir);
    u.uMoonDir.value.copy(this.moonDir);
    u.uSunColor.value.copy(c.light);
    u.uNight.value = this.night;
    u.uTime.value = this.elapsed;
    u.uCloudLit.value.copy(c.cloudLit);
    u.uCloudShade.value.copy(c.cloudShade);
    u.uCloudCover.value = 0.42 + (weather?.overcast ?? 0) * 0.55;

    world.setNight(this.night);
    world.updateMist(this.elapsed, c.mist, c.horizon);
  }

  /** "08:30" */
  clock(): string {
    const h = Math.floor(this.time);
    const m = Math.floor((this.time - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  periodName(): string {
    const t = this.time;
    if (t < 4.5) return 'Noc';
    if (t < 7) return 'Svitanie';
    if (t < 11) return 'Ráno';
    if (t < 14) return 'Poludnie';
    if (t < 18) return 'Popoludnie';
    if (t < 21) return 'Večer';
    return 'Noc';
  }
}
