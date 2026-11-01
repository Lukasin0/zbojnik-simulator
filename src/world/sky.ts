import * as THREE from 'three';

export const SKY_RADIUS = 700;

/**
 * Procedural sky dome: zenith/horizon gradient, sun disc + glow, moon, twinkling stars
 * and drifting fbm clouds. Everything is driven by uniforms from the day/night cycle.
 */
export class SkyDome {
  readonly mesh: THREE.Mesh;
  readonly uniforms = {
    uTop: { value: new THREE.Color(0x5f7487) },
    uHorizon: { value: new THREE.Color(0xa8b4ae) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(0xffe2b8) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uNight: { value: 0 },
    uTime: { value: 0 },
    uClouds: { value: 1 },
    uCloudCover: { value: 0.45 },
    uCloudLit: { value: new THREE.Color(0xf2ece4) },
    uCloudShade: { value: new THREE.Color(0x8a94a0) },
  };

  constructor() {
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uMoonDir;
        uniform float uNight;
        uniform float uTime;
        uniform float uClouds;
        uniform float uCloudCover;
        uniform vec3 uCloudLit;
        uniform vec3 uCloudShade;
        varying vec3 vDir;

        float hash3(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash2(i);
          float b = hash2(i + vec2(1.0, 0.0));
          float c = hash2(i + vec2(0.0, 1.0));
          float d = hash2(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
          float s = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            s += a * noise(p);
            p *= 2.03;
            a *= 0.5;
          }
          return s;
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(clamp(h * 1.6, 0.0, 1.0), 0.7));

          // sun: wide glow + disc (the glow also warms the horizon at dawn and dusk)
          float sd = max(dot(d, uSunDir), 0.0);
          float sunUp = smoothstep(-0.12, 0.02, uSunDir.y);
          col += uSunColor * (pow(sd, 6.0) * 0.28 + pow(sd, 48.0) * 0.5) * sunUp;
          col += uSunColor * smoothstep(0.9990, 0.9995, sd) * 4.0 * sunUp;

          // stars
          if (uNight > 0.01 && d.y > 0.0) {
            vec3 q = d * 320.0;
            vec3 cell = floor(q);
            float s = hash3(cell);
            float r = length(fract(q) - 0.5);
            float star = step(0.9965, s) * smoothstep(0.4, 0.05, r);
            star *= 0.55 + 0.45 * sin(uTime * 2.5 + s * 90.0);
            col += vec3(0.9, 0.93, 1.0) * star * uNight * smoothstep(0.0, 0.25, d.y);
          }

          // moon
          float md = max(dot(d, uMoonDir), 0.0);
          float moonUp = smoothstep(-0.05, 0.05, uMoonDir.y);
          col += vec3(0.86, 0.9, 1.0) * smoothstep(0.9993, 0.9996, md) * 1.6 * moonUp * max(uNight, 0.25);
          col += vec3(0.35, 0.45, 0.65) * pow(md, 40.0) * 0.35 * uNight * moonUp;

          // clouds projected on a flat ceiling
          if (uClouds > 0.5 && d.y > 0.0) {
            vec2 uv = d.xz / (d.y + 0.12) * 1.4 + vec2(uTime * 0.004, uTime * 0.0015);
            float n = fbm(uv);
            float cover = smoothstep(1.0 - uCloudCover, 1.0 - uCloudCover + 0.32, n);
            cover *= smoothstep(0.0, 0.2, d.y);
            float shade = fbm(uv * 1.9 + 7.3);
            vec3 cloud = mix(uCloudShade, uCloudLit, shade);
            // silver lining toward the sun
            cloud += uSunColor * pow(sd, 10.0) * 0.4 * sunUp;
            col = mix(col, cloud, cover * 0.9);
          }

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 16), material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  setClouds(on: boolean): void {
    this.uniforms.uClouds.value = on ? 1 : 0;
  }
}
