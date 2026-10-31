import * as THREE from 'three';
import { GAME_CONFIG } from '@/config/game-config';
import { clamp, damp } from '@/utils/math-utils';

const CFG = GAME_CONFIG.camera;

/** Third-person orbit camera with terrain avoidance and screen shake. */
export class CameraController {
  yaw = 0;
  pitch: number = CFG.pitch;
  private distance: number = CFG.distance;
  private targetDistance: number = CFG.distance;
  private readonly focus = new THREE.Vector3();
  private shakeAmount = 0;
  private readonly desired = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly rayDir = new THREE.Vector3();
  private occludedDistance: number = CFG.distance;
  /** Meshes the camera must not end up inside (tree crowns, houses). */
  occluders: THREE.Object3D[] = [];

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly groundAt: (x: number, z: number) => number,
  ) {}

  handleInput(dx: number, dy: number, wheel: number, padX: number, padY: number, dt: number): void {
    this.yaw -= dx * CFG.mouseSensitivity + padX * CFG.padSensitivity * dt;
    this.pitch = clamp(this.pitch + dy * CFG.mouseSensitivity + padY * CFG.padSensitivity * 0.6 * dt, CFG.minPitch, CFG.maxPitch);
    if (wheel !== 0) this.targetDistance = clamp(this.targetDistance + wheel * 0.8, CFG.minDistance, CFG.maxDistance);
  }

  snap(target: THREE.Vector3, yaw: number): void {
    this.yaw = yaw;
    this.focus.set(target.x, target.y + 1.6, target.z);
    this.update(target, 1, true);
  }

  shake(amount: number): void {
    this.shakeAmount = Math.min(0.6, this.shakeAmount + amount);
  }

  /** Horizontal forward direction of the camera. */
  get forwardX(): number {
    return Math.sin(this.yaw);
  }

  get forwardZ(): number {
    return Math.cos(this.yaw);
  }

  update(target: THREE.Vector3, dt: number, instant = false): void {
    const k = instant ? 1 : 1 - Math.exp(-10 * dt);
    this.focus.x += (target.x - this.focus.x) * k;
    this.focus.y += (target.y + 1.6 - this.focus.y) * k;
    this.focus.z += (target.z - this.focus.z) * k;
    this.distance = instant ? this.targetDistance : damp(this.distance, this.targetDistance, 8, dt);

    const cp = Math.cos(this.pitch);
    this.rayDir.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    // pull the camera in front of trees / walls between it and the captain
    let dist = this.distance;
    if (this.occluders.length > 0) {
      this.raycaster.set(this.focus, this.rayDir);
      this.raycaster.far = this.distance + 0.5;
      const hit = this.raycaster.intersectObjects(this.occluders, false)[0];
      const target = hit ? Math.max(1.4, hit.distance - 0.4) : this.distance;
      // snap in instantly, ease back out slowly
      this.occludedDistance =
        target < this.occludedDistance || instant ? target : damp(this.occludedDistance, target, 3, dt);
      dist = Math.min(dist, this.occludedDistance);
    }
    this.desired.copy(this.focus).addScaledVector(this.rayDir, dist);
    // keep the camera above the terrain (check camera point and midpoint)
    const minY = this.groundAt(this.desired.x, this.desired.z) + 0.5;
    if (this.desired.y < minY) this.desired.y = minY;
    const mx = (this.desired.x + this.focus.x) / 2;
    const mz = (this.desired.z + this.focus.z) / 2;
    const midMin = this.groundAt(mx, mz) + 0.4;
    const midY = (this.desired.y + this.focus.y) / 2;
    if (midY < midMin) this.desired.y += (midMin - midY) * 2;

    this.camera.position.copy(this.desired);
    if (this.shakeAmount > 0.001) {
      const s = this.shakeAmount;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
      this.shakeAmount = damp(this.shakeAmount, 0, 9, dt);
    }
    this.camera.lookAt(this.focus);
  }

  /** Slow cinematic orbit used behind the main menu. */
  orbit(center: THREE.Vector3, radius: number, height: number, time: number): void {
    const a = time * 0.04;
    this.camera.position.set(center.x + Math.sin(a) * radius, center.y + height, center.z + Math.cos(a) * radius);
    this.camera.lookAt(center);
  }
}
