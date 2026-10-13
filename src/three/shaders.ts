// Hand-written shaders: warm sky, flowing liquids (lemonade, jam, caramel),
// iridescent soap bubbles and soft glowing points (fireflies, stars, fizz).

import * as THREE from 'three';

export const sharedTime = { value: 0 };

// ------------------------------------------------------------------ sky

export function makeSkyMaterial(opts: {
  zenith: string;
  mid: string;
  horizon: string;
  ground: string;
  sun: string;
  sunDir: THREE.Vector3;
  night?: boolean;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color(opts.zenith) },
      mid: { value: new THREE.Color(opts.mid) },
      horizon: { value: new THREE.Color(opts.horizon) },
      ground: { value: new THREE.Color(opts.ground) },
      sunColor: { value: new THREE.Color(opts.sun) },
      sunDir: { value: opts.sunDir.clone().normalize() },
      time: sharedTime,
      night: { value: opts.night ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith; uniform vec3 mid; uniform vec3 horizon; uniform vec3 ground;
      uniform vec3 sunColor; uniform vec3 sunDir; uniform float time; uniform float night;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        col = mix(col, zenith, smoothstep(0.22, 0.85, h));
        col = mix(col, ground, smoothstep(0.0, -0.18, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.6);
        col += sunColor * pow(s, 900.0) * 2.5;
        if (night > 0.5) {
          vec3 q = floor(d * 220.0);
          float st = hash(q);
          float tw = 0.6 + 0.4 * sin(time * 2.0 + st * 40.0);
          col += vec3(1.0, 0.95, 0.85) * step(0.9965, st) * tw * smoothstep(0.05, 0.3, h);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ---------------------------------------------------------- flowing liquid

export interface FlowOpts {
  deep: string;
  shallow: string;
  foam: string;
  speed: number;
  sparkle: number;
  gloss: number;
  opacity?: number;
  /** waves per unit along the flow */
  scale?: number;
  fizz?: number;
}

/**
 * Liquid surface for ribbons whose uv.x runs along the flow and uv.y runs
 * bank-to-bank. Used for the lemonade river, the jam stream and caramel.
 */
export function makeFlowMaterial(o: FlowOpts): THREE.ShaderMaterial {
  const uniforms: Record<string, THREE.IUniform> = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        deep: { value: new THREE.Color(o.deep) },
        shallow: { value: new THREE.Color(o.shallow) },
        foam: { value: new THREE.Color(o.foam) },
        speed: { value: o.speed },
        sparkle: { value: o.sparkle },
        gloss: { value: o.gloss },
        opacity: { value: o.opacity ?? 1 },
        scale: { value: o.scale ?? 1 },
        fizz: { value: o.fizz ?? 0 },
        lightDir: { value: new THREE.Vector3(0.4, 0.8, 0.45).normalize() },
      },
    ]);
  uniforms.time = sharedTime;
  return new THREE.ShaderMaterial({
    transparent: (o.opacity ?? 1) < 1,
    fog: true,
    uniforms,
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      uniform float time;
      uniform float speed;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vLen;
      attribute float flowLen;
      void main() {
        vUv = uv;
        vLen = flowLen;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 deep; uniform vec3 shallow; uniform vec3 foam;
      uniform float time; uniform float speed; uniform float sparkle; uniform float gloss;
      uniform float opacity; uniform float scale; uniform float fizz; uniform vec3 lightDir;
      varying vec2 vUv; varying vec3 vWorld; varying float vLen;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        float along = vLen * scale;
        float across = vUv.y;
        vec2 p = vec2(along - time * speed, across * 3.0);
        float n1 = vnoise(p * vec2(1.3, 1.6));
        float n2 = vnoise(p * vec2(2.7, 3.1) + vec2(time * 0.31, 0.0));
        float waves = n1 * 0.65 + n2 * 0.35;
        // fake normal from the noise gradient
        float e = 0.08;
        float nx = vnoise((p + vec2(e, 0.0)) * vec2(1.3, 1.6)) - n1;
        float nz = vnoise((p + vec2(0.0, e)) * vec2(1.3, 1.6)) - n1;
        vec3 n = normalize(vec3(-nx * 3.5, 1.0, -nz * 3.5));
        vec3 v = normalize(cameraPosition - vWorld);
        vec3 hv = normalize(lightDir + v);
        float spec = pow(max(dot(n, hv), 0.0), 60.0) * gloss;
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        float edge = 1.0 - smoothstep(0.0, 0.22, min(across, 1.0 - across));
        vec3 col = mix(deep, shallow, clamp(waves * 0.8 + edge * 0.6, 0.0, 1.0));
        col += fres * 0.25 * shallow;
        col += spec * vec3(1.0, 0.98, 0.9);
        // fizz sparkles that drift downstream
        vec2 sp = vec2(along * 4.0 - time * speed * 3.0, across * 18.0);
        vec2 cell = floor(sp);
        float r = h21(cell);
        float tw = smoothstep(0.92, 1.0, sin(time * 3.0 + r * 30.0) * 0.5 + 0.5);
        float dotMask = smoothstep(0.32, 0.0, length(fract(sp) - 0.5));
        col += vec3(1.0, 1.0, 0.95) * dotMask * tw * step(0.55, r) * sparkle;
        // fizzy bubble rings
        if (fizz > 0.0) {
          vec2 bp = vec2(along * 2.0 - time * speed * 1.5, across * 8.0 + time * 0.2);
          vec2 bc = floor(bp);
          float br = h21(bc + 7.0);
          float ring = abs(length(fract(bp) - 0.5) - 0.18 - 0.06 * sin(time * 2.0 + br * 9.0));
          col += vec3(1.0) * smoothstep(0.03, 0.0, ring) * step(0.6, br) * fizz;
        }
        // frothy foam at the banks
        float froth = smoothstep(0.5, 0.95, vnoise(vec2(along * 3.0 - time * speed * 1.4, across * 10.0)));
        col = mix(col, foam, edge * (0.45 + 0.55 * froth));
        gl_FragColor = vec4(col, opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// ------------------------------------------------------------------ bubble

export function makeBubbleMaterial(tint = '#ffffff', strength = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      time: sharedTime,
      tint: { value: new THREE.Color(tint) },
      strength: { value: strength },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying float vSeed;
      void main() {
        vec4 lp = vec4(position, 1.0);
        vec3 nn = normal;
        #ifdef USE_INSTANCING
          lp = instanceMatrix * lp;
          nn = mat3(instanceMatrix) * nn;
          vSeed = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
        #else
          vSeed = 0.0;
        #endif
        vec4 mv = modelViewMatrix * lp;
        vN = normalize(normalMatrix * nn);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float time; uniform vec3 tint; uniform float strength;
      varying vec3 vN; varying vec3 vV; varying float vSeed;
      void main() {
        vec3 n = normalize(vN);
        float ndv = clamp(dot(n, normalize(vV)), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 2.2);
        vec3 film = 0.55 + 0.45 * cos(6.28318 * (fres * 1.4 + time * 0.08 + vSeed * 0.1 + vec3(0.0, 0.33, 0.67)));
        vec3 l = normalize(vec3(-0.4, 0.7, 0.6));
        float spec = pow(max(dot(reflect(-l, n), normalize(vV)), 0.0), 40.0);
        vec3 col = mix(tint, film, 0.75) ;
        float a = (0.07 + fres * 0.75) * strength + spec * 0.9;
        gl_FragColor = vec4(col + spec, clamp(a, 0.0, 1.0));
        #include <colorspace_fragment>
      }`,
  });
}

// ------------------------------------------------------------- glow points

export function makeGlowPointsMaterial(color = '#ffd36b', size = 40, opacity = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      color: { value: new THREE.Color(color) },
      size: { value: size },
      opacity: { value: opacity },
      time: sharedTime,
      pixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: /* glsl */ `
      uniform float size; uniform float time; uniform float pixelRatio;
      attribute float seed;
      attribute float scale;
      varying float vTw;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vTw = 0.65 + 0.35 * sin(time * 3.0 + seed * 17.0);
        gl_PointSize = size * scale * pixelRatio * vTw / max(0.5, -mv.z) * 10.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color; uniform float opacity;
      varying float vTw;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        float core = smoothstep(0.35, 0.0, d);
        float halo = smoothstep(1.0, 0.0, d) * 0.45;
        float a = (core + halo) * opacity * vTw;
        if (a < 0.01) discard;
        gl_FragColor = vec4(color * (0.6 + core * 0.8), a);
      }`,
  });
}
