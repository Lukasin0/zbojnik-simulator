export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export const QUALITY_LEVELS: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];

export interface QualityPreset {
  label: string;
  /** Upper bound for the device pixel ratio. */
  pixelRatio: number;
  /** Lowest render scale dynamic resolution may drop to. */
  minRenderScale: number;
  /** MSAA on the default framebuffer (only applied at startup). */
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  softShadows: boolean;
  shadowExtent: number;
  postProcessing: boolean;
  /** MSAA samples of the post-processing render target. */
  msaa: number;
  /** Multiplier for particle counts. */
  particleDensity: number;
  drawDistance: number;
  /** Procedural clouds in the sky shader. */
  clouds: boolean;
  /** Valley mist layers (morning / night). */
  mist: boolean;
  /** Rain streaks rendered around the camera at full downpour. */
  rainDrops: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: {
    label: 'Nízka',
    pixelRatio: 0.75,
    minRenderScale: 0.55,
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    softShadows: false,
    shadowExtent: 30,
    postProcessing: false,
    msaa: 0,
    particleDensity: 0.4,
    drawDistance: 420,
    clouds: false,
    mist: false,
    rainDrops: 700,
  },
  medium: {
    label: 'Stredná',
    pixelRatio: 1,
    minRenderScale: 0.6,
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    softShadows: false,
    shadowExtent: 32,
    postProcessing: true,
    msaa: 0,
    particleDensity: 0.7,
    drawDistance: 650,
    clouds: true,
    mist: true,
    rainDrops: 1700,
  },
  high: {
    label: 'Vysoká',
    pixelRatio: 1.5,
    minRenderScale: 0.7,
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    softShadows: true,
    shadowExtent: 42,
    postProcessing: true,
    msaa: 4,
    particleDensity: 1,
    drawDistance: 900,
    clouds: true,
    mist: true,
    rainDrops: 3500,
  },
  ultra: {
    label: 'Ultra',
    pixelRatio: 2,
    minRenderScale: 0.75,
    antialias: true,
    shadows: true,
    shadowMapSize: 4096,
    softShadows: true,
    shadowExtent: 55,
    postProcessing: true,
    msaa: 4,
    particleDensity: 1.25,
    drawDistance: 900,
    clouds: true,
    mist: true,
    rainDrops: 5000,
  },
};

export interface GpuInfo {
  name: string;
  suggested: QualityLevel;
}

/** Read the GPU name from a throw-away WebGL context and suggest a preset. */
export function detectGpu(): GpuInfo {
  let name = 'neznáma';
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    /* keep defaults */
  }
  const n = name.toLowerCase();
  const mobile = /android|iphone|ipad|mobile/i.test(navigator.userAgent);
  let suggested: QualityLevel = 'medium';
  if (/swiftshader|llvmpipe|software|basic render/.test(n) || mobile) suggested = 'low';
  else if (/apple m\d/.test(n)) suggested = 'high';
  else if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|arc a\d/.test(n)) suggested = 'high';
  else if (/intel|uhd|iris|hd graphics|mali|adreno|powervr|vega/.test(n)) suggested = 'medium';
  return { name: name.replace(/^ANGLE \((.*)\)$/, '$1'), suggested };
}
