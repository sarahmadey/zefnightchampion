// Dinosaur skin: a soft, slightly glossy vinyl-toy finish over pebbly scales,
// a lighter belly with grooved bands, darker markings along the back, and
// soft shading in creases. Everything is computed in the bind pose, so the
// pattern stays stuck to the skin as it bends.

import * as THREE from 'three';

export interface SkinColors {
  body: string;
  belly: string;
  /** markings along the back */
  marks: string;
}

export interface SkinOpts {
  /** scales per unit of length */
  scale?: number;
  /** how often the belly bands repeat per unit along their axis */
  bands?: number;
  /** marking style: 0 stripes, 1 spots */
  marks?: number;
  seed?: number;
}

const cache = new Map<string, THREE.MeshPhysicalMaterial>();

export function skinMaterial(c: SkinColors, o: SkinOpts = {}): THREE.MeshPhysicalMaterial {
  const key = `${c.body}|${c.belly}|${c.marks}|${o.scale ?? 105}|${o.bands ?? 22}|${o.marks ?? 0}|${o.seed ?? 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.5,
    clearcoat: 0.35,
    clearcoatRoughness: 0.42,
    sheen: 0.35,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color('#fff4dd'),
  });
  const uniforms = {
    uBody: { value: new THREE.Color(c.body) },
    uBelly: { value: new THREE.Color(c.belly) },
    uMarks: { value: new THREE.Color(c.marks) },
    uScale: { value: o.scale ?? 105 },
    uBands: { value: o.bands ?? 22 },
    uMarkStyle: { value: o.marks ?? 0 },
    uSeed: { value: o.seed ?? 0 },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aMask;\nvarying vec4 vMask;\nvarying vec3 vBind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask = aMask;\nvBind = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec4 vMask;
varying vec3 vBind;
uniform vec3 uBody, uBelly, uMarks;
uniform float uScale, uBands, uMarkStyle, uSeed;
vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
// distance to the nearest and second nearest scale centre
vec2 worley(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + 0.15 + 0.7 * hash3(i + g) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(vec2(d1, d2));
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash3(i).x, n100 = hash3(i + vec3(1, 0, 0)).x, n010 = hash3(i + vec3(0, 1, 0)).x, n110 = hash3(i + vec3(1, 1, 0)).x;
  float n001 = hash3(i + vec3(0, 0, 1)).x, n101 = hash3(i + vec3(1, 0, 1)).x, n011 = hash3(i + vec3(0, 1, 1)).x, n111 = hash3(i + vec3(1, 1, 1)).x;
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
float skinBelly() { return smoothstep(0.3, 0.7, vMask.x); }
float skinBandLine() {
  float b = abs(fract(vMask.z * uBands) - 0.5);
  return smoothstep(0.36, 0.5, b) * skinBelly();
}
// height for the bump: pebbly scales on the back, smoother banded belly
float skinHeight(out float cellEdge) {
  vec2 w = worley(vBind * uScale + uSeed);
  cellEdge = smoothstep(0.0, 0.22, w.y - w.x);
  float pebble = cellEdge * (0.6 + 0.4 * vMask.y) * (1.0 - 0.75 * skinBelly());
  return pebble - skinBandLine() * 1.4;
}
vec3 perturbSkin(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 sx = normalize(dFdx(surf_pos)), sy = normalize(dFdy(surf_pos));
  vec3 r1 = cross(sy, surf_norm), r2 = cross(surf_norm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surf_norm - grad);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float cellEdge;
float skinH = skinHeight(cellEdge);
{
  float belly = skinBelly();
  vec3 col = mix(uBody, mix(uBelly, uBody, 0.22), belly);
  // markings on the back: tiger stripes or spots
  float n = uMarkStyle < 0.5
    ? vnoise(vBind * vec3(2.2, 9.0, 3.2) + uSeed) * 0.65 + vnoise(vBind * 11.0 + uSeed) * 0.35
    : vnoise(vBind * 9.0 + uSeed) * 0.8 + vnoise(vBind * 23.0 + uSeed) * 0.2;
  float marks = smoothstep(0.6, 0.66, n) * smoothstep(0.25, 0.75, vMask.y) * (1.0 - belly);
  col = mix(col, uMarks, marks * 0.85);
  // a little darker in the grooves between scales, lighter on their tops
  col *= mix(0.94, 1.02, cellEdge) * (1.0 - 0.14 * skinBandLine());
  // soft shadow in creases
  col *= mix(0.55, 1.0, vMask.w);
  diffuseColor.rgb = col;
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
normal = perturbSkin(-vViewPosition, normal, vec2(dFdx(skinH), dFdy(skinH)) * 0.002, faceDirection);`,
      );
  };
  m.customProgramCacheKey = () => 'dino-skin';
  m.name = `skin:${key}`;
  cache.set(key, m);
  return m;
}

/** Plain glossy materials for the bits that aren't skin. */
const plain = new Map<string, THREE.Material>();
export function part(key: string, make: () => THREE.Material): THREE.Material {
  let m = plain.get(key);
  if (!m) {
    m = make();
    m.name = key;
    plain.set(key, m);
  }
  return m;
}
