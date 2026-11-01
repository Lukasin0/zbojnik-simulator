import type { GraphicsSettings } from '@/types/game-types';

export const GAME_CONFIG = {
  title: 'Zbojník Simulátor',
  version: '0.1.0',
  targetFps: 60,
  renderer: {
    toneMappingExposure: 1.05,
  },
  camera: {
    fov: 60,
    near: 0.1,
    far: 900,
    distance: 5.2,
    /** Over-the-shoulder offset to the right (m) – normal / while aiming. */
    shoulderOffset: 0.55,
    aimShoulderOffset: 0.8,
    aimDistance: 2.3,
    aimFov: 44,
    minDistance: 2.5,
    maxDistance: 13,
    pitch: 0.28,
    minPitch: -0.25,
    maxPitch: 1.2,
    mouseSensitivity: 0.0026,
    padSensitivity: 2.6,
  },
  fog: { color: 0xa8b4ae, density: 0.0085 },
  sky: { top: 0x5f7487, horizon: 0xa8b4ae },
} as const;

export const DEFAULT_GRAPHICS: GraphicsSettings = {
  quality: 'medium',
  userChosen: false,
  dynamicResolution: true,
  showFps: false,
};
