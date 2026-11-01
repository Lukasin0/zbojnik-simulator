import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { DEFAULT_GRAPHICS, GAME_CONFIG } from '@/config/game-config';
import { QUALITY_LEVELS, QUALITY_PRESETS, detectGpu, type GpuInfo, type QualityPreset } from '@/config/quality';
import type { GraphicsSettings } from '@/types/game-types';
import { SKY_RADIUS, SkyDome } from '@/world/sky';

const GRAPHICS_KEY = 'zbojnik.graphics.v2';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0.38 },
    uDamage: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uDamage;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      float vig = smoothstep(0.32, 0.86, d);
      c.rgb *= 1.0 - uVignette * vig;
      c.rgb = mix(c.rgb, c.rgb * vec3(1.05, 1.0, 0.9), 0.7);
      c.rgb = mix(c.rgb, vec3(0.55, 0.02, 0.0), uDamage * vig * 0.8);
      gl_FragColor = c;
    }
  `,
};

/** Renderer, scene, camera, lights, sky, post-processing and graphics quality management. */
export class App {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly sky = new SkyDome();
  readonly fog: THREE.FogExp2;
  readonly graphics: GraphicsSettings;
  readonly gpu: GpuInfo;
  /** Called whenever the active preset changes (particles etc. read it). */
  onQualityChange: ((preset: QualityPreset) => void) | null = null;
  private readonly composer: EffectComposer;
  private readonly gradePass: ShaderPass;
  private readonly fpsMeter: HTMLDivElement;
  private resizeTimer: number | null = null;
  private damageFlash = 0;
  /** Dynamic resolution multiplier on top of the preset's pixel ratio. */
  private renderScale = 1;
  private sampleTime = 0;
  private sampleFrames = 0;
  private goodSamples = 0;
  fps = 60;

  constructor(private readonly container: HTMLElement) {
    this.gpu = detectGpu();
    this.graphics = this.loadGraphics();
    if (!this.graphics.userChosen) this.graphics.quality = this.gpu.suggested;
    const preset = this.preset;

    this.renderer = new THREE.WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = GAME_CONFIG.renderer.toneMappingExposure;
    container.appendChild(this.renderer.domElement);

    const C = GAME_CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(C.fov, 1, C.near, C.far);
    this.fog = new THREE.FogExp2(GAME_CONFIG.fog.color, GAME_CONFIG.fog.density);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(GAME_CONFIG.fog.color);

    this.hemi = new THREE.HemisphereLight(0xd0dce6, 0x5a6038, 1.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 200;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);

    this.scene.add(this.sky.mesh);

    const target = new THREE.WebGLRenderTarget(1, 1, { samples: preset.msaa, type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.gradePass);
    this.composer.addPass(new OutputPass());

    this.fpsMeter = document.createElement('div');
    this.fpsMeter.className = 'fps-meter';
    document.body.appendChild(this.fpsMeter);

    this.applyQuality(false);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
  }

  get preset(): QualityPreset {
    return QUALITY_PRESETS[this.graphics.quality];
  }

  private loadGraphics(): GraphicsSettings {
    try {
      const raw = localStorage.getItem(GRAPHICS_KEY);
      if (!raw) return { ...DEFAULT_GRAPHICS };
      const parsed = { ...DEFAULT_GRAPHICS, ...(JSON.parse(raw) as Partial<GraphicsSettings>) };
      if (!QUALITY_LEVELS.includes(parsed.quality)) parsed.quality = DEFAULT_GRAPHICS.quality;
      return parsed;
    } catch {
      return { ...DEFAULT_GRAPHICS };
    }
  }

  private saveGraphics(): void {
    try {
      localStorage.setItem(GRAPHICS_KEY, JSON.stringify(this.graphics));
    } catch {
      /* ignore */
    }
  }

  /** Player picked a preset in the settings. */
  setQuality(level: GraphicsSettings['quality']): void {
    this.graphics.quality = level;
    this.graphics.userChosen = true;
    this.renderScale = 1;
    this.applyQuality(true);
    this.saveGraphics();
  }

  setDynamicResolution(on: boolean): void {
    this.graphics.dynamicResolution = on;
    if (!on && this.renderScale !== 1) {
      this.renderScale = 1;
      this.applyPixelRatio();
    }
    this.saveGraphics();
  }

  setShowFps(on: boolean): void {
    this.graphics.showFps = on;
    this.fpsMeter.style.display = on ? 'block' : 'none';
    this.saveGraphics();
  }

  private applyQuality(recompile: boolean): void {
    const p = this.preset;
    const shadowsChanged =
      this.renderer.shadowMap.enabled !== p.shadows ||
      this.sun.shadow.mapSize.x !== p.shadowMapSize ||
      (this.renderer.shadowMap.type === THREE.PCFSoftShadowMap) !== p.softShadows;
    this.renderer.shadowMap.enabled = p.shadows;
    this.renderer.shadowMap.type = p.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.sun.castShadow = p.shadows;
    this.sun.shadow.mapSize.set(p.shadowMapSize, p.shadowMapSize);
    const cam = this.sun.shadow.camera;
    cam.left = -p.shadowExtent;
    cam.right = p.shadowExtent;
    cam.top = p.shadowExtent;
    cam.bottom = -p.shadowExtent;
    cam.updateProjectionMatrix();
    if (shadowsChanged && this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    if (recompile && shadowsChanged) {
      this.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => (m.needsUpdate = true));
        }
      });
    }
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (rt.samples !== p.msaa) {
        rt.samples = p.msaa;
        rt.dispose();
      }
    }
    this.camera.far = p.drawDistance;
    this.camera.updateProjectionMatrix();
    // the sky dome must stay inside the far plane
    this.sky.mesh.scale.setScalar(Math.min(1, (p.drawDistance * 0.9) / SKY_RADIUS));
    this.sky.setClouds(p.clouds);
    this.fpsMeter.style.display = this.graphics.showFps ? 'block' : 'none';
    this.applyPixelRatio();
    this.onQualityChange?.(p);
  }

  private applyPixelRatio(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, this.preset.pixelRatio) * this.renderScale;
    this.renderer.setPixelRatio(ratio);
    this.resize();
  }

  /** Adapt the render scale to the measured frame rate instead of stuttering. */
  private updateDynamicResolution(frameDt: number): void {
    if (frameDt > 0.25 || document.hidden) return;
    this.sampleTime += frameDt;
    this.sampleFrames++;
    if (this.sampleTime < 1.5) return;
    this.fps = this.sampleFrames / this.sampleTime;
    this.sampleTime = 0;
    this.sampleFrames = 0;
    this.fpsMeter.textContent = `${Math.round(this.fps)} FPS · ${Math.round(this.renderScale * 100)} %`;
    if (!this.graphics.dynamicResolution) return;
    const min = this.preset.minRenderScale;
    if (this.fps < 48 && this.renderScale > min) {
      this.renderScale = Math.max(min, this.renderScale - 0.1);
      this.goodSamples = 0;
      this.applyPixelRatio();
    } else if (this.fps > 57 && this.renderScale < 1) {
      // only scale back up after the frame rate has been stable for a while
      if (++this.goodSamples >= 3) {
        this.renderScale = Math.min(1, this.renderScale + 0.1);
        this.goodSamples = 0;
        this.applyPixelRatio();
      }
    } else {
      this.goodSamples = 0;
    }
  }

  private onResize = (): void => {
    if (this.resizeTimer !== null) window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      this.resizeTimer = null;
      this.resize();
    }, 120);
  };

  resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }

  flashDamage(amount: number): void {
    this.damageFlash = Math.min(1, this.damageFlash + amount);
  }

  render(frameDt: number): void {
    this.updateDynamicResolution(frameDt);
    this.sky.mesh.position.copy(this.camera.position);
    this.damageFlash = Math.max(0, this.damageFlash - frameDt * 1.8);
    if (this.preset.postProcessing) {
      this.gradePass.uniforms.uDamage.value = this.damageFlash;
      this.composer.render(frameDt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
