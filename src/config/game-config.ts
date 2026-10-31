import type { GraphicsSettings } from '@/types/game-types';

export const GAME_CONFIG = {
  title: 'Zbojník Simulátor',
  version: '0.1.0',
  targetFps: 60,
  renderer: {
    antialias: true,
    shadowMapSize: 2048,
    shadowExtent: 42,
    toneMappingExposure: 1.05,
  },
  camera: {
    fov: 60,
    near: 0.1,
    far: 900,
    distance: 5.2,
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
  postProcessing: true,
  shadows: true,
  maxPixelRatio: 2,
};
