import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { DEFAULT_GRAPHICS, GAME_CONFIG } from '@/config/game-config';
import type { GraphicsSettings } from '@/types/game-types';

const GRAPHICS_KEY = 'zbojnik.graphics';

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

/** Renderer, scene, camera, lights, sky and the post-processing pipeline. */
export class App {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun: THREE.DirectionalLight;
  readonly graphics: GraphicsSettings;
  private readonly composer: EffectComposer;
  private readonly gradePass: ShaderPass;
  private readonly sky: THREE.Mesh;
  private resizeTimer: number | null = null;
  private damageFlash = 0;

  constructor(private readonly container: HTMLElement) {
    this.graphics = this.loadGraphics();
    this.renderer = new THREE.WebGLRenderer({ antialias: GAME_CONFIG.renderer.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.graphics.maxPixelRatio));
    this.renderer.shadowMap.enabled = this.graphics.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = GAME_CONFIG.renderer.toneMappingExposure;
    container.appendChild(this.renderer.domElement);

    const C = GAME_CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(C.fov, 1, C.near, C.far);
    this.scene.fog = new THREE.FogExp2(GAME_CONFIG.fog.color, GAME_CONFIG.fog.density);
    this.scene.background = new THREE.Color(GAME_CONFIG.fog.color);

    const hemi = new THREE.HemisphereLight(0xd0dce6, 0x5a6038, 1.6);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
    this.sun.castShadow = true;
    const ext = GAME_CONFIG.renderer.shadowExtent;
    this.sun.shadow.mapSize.set(GAME_CONFIG.renderer.shadowMapSize, GAME_CONFIG.renderer.shadowMapSize);
    this.sun.shadow.camera.left = -ext;
    this.sun.shadow.camera.right = ext;
    this.sun.shadow.camera.top = ext;
    this.sun.shadow.camera.bottom = -ext;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 200;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);

    this.sky = this.createSky();
    this.scene.add(this.sky);

    const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.gradePass);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
  }

  private createSky(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(700, 24, 12);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(GAME_CONFIG.sky.top) },
        horizon: { value: new THREE.Color(GAME_CONFIG.sky.horizon) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 horizon;
        varying vec3 vPos;
        void main() {
          float h = clamp(normalize(vPos).y * 2.2, 0.0, 1.0);
          gl_FragColor = vec4(mix(horizon, top, h), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    return sky;
  }

  private loadGraphics(): GraphicsSettings {
    try {
      const raw = localStorage.getItem(GRAPHICS_KEY);
      return raw ? { ...DEFAULT_GRAPHICS, ...(JSON.parse(raw) as Partial<GraphicsSettings>) } : { ...DEFAULT_GRAPHICS };
    } catch {
      return { ...DEFAULT_GRAPHICS };
    }
  }

  saveGraphics(): void {
    try {
      localStorage.setItem(GRAPHICS_KEY, JSON.stringify(this.graphics));
    } catch {
      /* ignore */
    }
  }

  setShadows(on: boolean): void {
    this.graphics.shadows = on;
    this.renderer.shadowMap.enabled = on;
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.material as THREE.Material).needsUpdate = true;
    });
    this.saveGraphics();
  }

  setPostProcessing(on: boolean): void {
    this.graphics.postProcessing = on;
    this.saveGraphics();
  }

  setMaxPixelRatio(r: number): void {
    this.graphics.maxPixelRatio = r;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, r));
    this.resize();
    this.saveGraphics();
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

  /** Keep the shadow frustum centred on the action. */
  followSun(target: THREE.Vector3): void {
    this.sun.position.set(target.x + 35, target.y + 70, target.z + 45);
    this.sun.target.position.copy(target);
  }

  render(frameDt: number): void {
    this.sky.position.copy(this.camera.position);
    this.damageFlash = Math.max(0, this.damageFlash - frameDt * 1.8);
    if (this.graphics.postProcessing) {
      this.gradePass.uniforms.uDamage.value = this.damageFlash;
      this.composer.render(frameDt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
