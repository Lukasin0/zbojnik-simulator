import * as THREE from 'three';
import { ObjectPool } from '@/utils/object-pool';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  grow: number;
  gravity: number;
  drag: number;
  spin: number;
  color: THREE.Color;
}

export interface EmitOptions {
  x: number;
  y: number;
  z: number;
  count?: number;
  spread?: number;
  speed?: number;
  up?: number;
  dir?: { x: number; y: number; z: number };
  life?: [number, number];
  size?: [number, number];
  grow?: number;
  gravity?: number;
  drag?: number;
  color: number | readonly number[];
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

/** Pooled low-poly cube particles rendered through a single InstancedMesh. */
export class ParticleSystem {
  readonly mesh: THREE.InstancedMesh;
  private readonly pool: ObjectPool<Particle>;
  private readonly active: Particle[] = [];

  constructor(scene: THREE.Scene, private readonly max = 1200) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, white);
    scene.add(this.mesh);
    this.pool = new ObjectPool<Particle>(
      () => ({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 0.1,
        grow: 0,
        gravity: 0,
        drag: 0,
        spin: 0,
        color: new THREE.Color(),
      }),
      (p) => {
        p.life = 0;
      },
      256,
      max,
    );
  }

  emit(o: EmitOptions): void {
    const count = o.count ?? 8;
    const spread = o.spread ?? 0.2;
    const speed = o.speed ?? 2;
    const colors = typeof o.color === 'number' ? [o.color] : o.color;
    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      if (!p) return;
      p.x = o.x + (Math.random() - 0.5) * spread;
      p.y = o.y + (Math.random() - 0.5) * spread;
      p.z = o.z + (Math.random() - 0.5) * spread;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      p.vx = Math.cos(a) * s + (o.dir?.x ?? 0);
      p.vz = Math.sin(a) * s + (o.dir?.z ?? 0);
      p.vy = (o.up ?? 1) * (0.5 + Math.random()) + (o.dir?.y ?? 0);
      const [l0, l1] = o.life ?? [0.4, 0.9];
      p.maxLife = l0 + Math.random() * (l1 - l0);
      p.life = p.maxLife;
      const [s0, s1] = o.size ?? [0.06, 0.14];
      p.size = s0 + Math.random() * (s1 - s0);
      p.grow = o.grow ?? 0;
      p.gravity = o.gravity ?? -6;
      p.drag = o.drag ?? 1.5;
      p.spin = (Math.random() - 0.5) * 10;
      p.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
      this.active.push(p);
    }
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
        this.pool.release(p);
        continue;
      }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy = p.vy * drag + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.size = Math.max(0.005, p.size + p.grow * dt);
    }
    const n = Math.min(this.active.length, this.max);
    for (let i = 0; i < n; i++) {
      const p = this.active[i];
      const t = p.life / p.maxLife;
      const s = p.size * Math.min(1, t * 3);
      const rot = p.spin * (p.maxLife - p.life);
      tmpEuler.set(rot, rot * 0.7, 0);
      tmpQuat.setFromEuler(tmpEuler);
      tmpPos.set(p.x, p.y, p.z);
      tmpScale.set(s, s, s);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      this.mesh.setMatrixAt(i, tmpMatrix);
      this.mesh.setColorAt(i, p.color);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  get stats(): { active: number; pooled: number } {
    return { active: this.active.length, pooled: this.pool.stats.free };
  }
}
