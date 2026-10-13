// Candy material library. Materials are cached so identical looks share one
// shader program and one GPU material.

import * as THREE from 'three';

const cache = new Map<string, THREE.Material>();

function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    m.name = key;
    cache.set(key, m);
  }
  return m;
}

type C = THREE.ColorRepresentation;

/** Matte frosting / cookie / soft candy. */
export function matte(color: C, roughness = 0.8): THREE.MeshStandardMaterial {
  return cached(`matte:${String(color)}:${roughness}`, () => new THREE.MeshStandardMaterial({ color, roughness }));
}

/** Glossy hard candy with a lacquer coat. */
export function gloss(color: C, roughness = 0.22, clearcoat = 0.9): THREE.MeshPhysicalMaterial {
  return cached(
    `gloss:${String(color)}:${roughness}:${clearcoat}`,
    () => new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat, clearcoatRoughness: 0.12 }),
  );
}

/** Vertex-coloured material for merged multi-colour models. */
export function vcolor(roughness = 0.7, key = ''): THREE.MeshStandardMaterial {
  return cached(`vc:${roughness}:${key}`, () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness }));
}

export function vcolorGloss(roughness = 0.3, clearcoat = 0.7): THREE.MeshPhysicalMaterial {
  return cached(
    `vcg:${roughness}:${clearcoat}`,
    () =>
      new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness, clearcoat, clearcoatRoughness: 0.15 }),
  );
}

/** Soft marshmallow / plush with a velvety sheen. */
export function marshmallow(color: C, sheen: C = '#ffe3f1'): THREE.MeshPhysicalMaterial {
  return cached(
    `mallow:${String(color)}:${String(sheen)}`,
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.92,
        sheen: 1,
        sheenColor: new THREE.Color(sheen),
        sheenRoughness: 0.45,
      }),
  );
}

export function marshmallowVC(): THREE.MeshPhysicalMaterial {
  return cached(
    'mallowvc',
    () =>
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.9,
        sheen: 1,
        sheenColor: new THREE.Color('#fff0f8'),
        sheenRoughness: 0.5,
      }),
  );
}

/** Glossy wet jam. */
export function jam(color: C = '#c8102e'): THREE.MeshPhysicalMaterial {
  return cached(
    `jam:${String(color)}`,
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.06,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        emissive: new THREE.Color(color).multiplyScalar(0.12),
      }),
  );
}

/** Translucent-looking gumdrop / jelly without an extra transmission pass. */
export function jelly(color: C, opacity = 0.84): THREE.MeshPhysicalMaterial {
  return cached(
    `jelly:${String(color)}:${opacity}`,
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity,
        emissive: new THREE.Color(color).multiplyScalar(0.35),
        sheen: 0.6,
        sheenColor: new THREE.Color('#ffffff'),
        sheenRoughness: 0.3,
        depthWrite: true,
      }),
  );
}

export function emissive(color: C, intensity = 1.5): THREE.MeshStandardMaterial {
  return cached(
    `emis:${String(color)}:${intensity}`,
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(color),
        emissiveIntensity: intensity,
        roughness: 0.4,
        toneMapped: false,
      }),
  );
}

export function basic(color: C, opts: THREE.MeshBasicMaterialParameters = {}, key = ''): THREE.MeshBasicMaterial {
  return cached(`basic:${String(color)}:${key}`, () => new THREE.MeshBasicMaterial({ color, ...opts }));
}

export type PatternMode = 'swirl' | 'helix' | 'uv' | 'spiral';
const MODE_ID: Record<PatternMode, number> = { swirl: 0, helix: 1, uv: 2, spiral: 3 };

export interface PatternOpts {
  a: C;
  b: C;
  mode: PatternMode;
  freq: number;
  twist: number;
  roughness?: number;
  clearcoat?: number;
  /** Fraction of each period painted with colour b. */
  duty?: number;
}

/**
 * Crisp procedural candy stripes computed per pixel in object space:
 * peppermint swirls, candy-cane helices and lollipop spirals.
 */
export function pattern(o: PatternOpts): THREE.MeshPhysicalMaterial {
  const key = `pat:${String(o.a)}:${String(o.b)}:${o.mode}:${o.freq}:${o.twist}:${o.roughness}:${o.clearcoat}:${o.duty}`;
  return cached(key, () => {
    const m = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: o.roughness ?? 0.25,
      clearcoat: o.clearcoat ?? 0.8,
      clearcoatRoughness: 0.15,
    });
    const uniforms = {
      patA: { value: new THREE.Color(o.a) },
      patB: { value: new THREE.Color(o.b) },
      patFreq: { value: o.freq },
      patTwist: { value: o.twist },
      patDuty: { value: o.duty ?? 0.5 },
    };
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPatPos;\nvarying vec2 vPatUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPatPos = position;\nvPatUv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vPatPos;
varying vec2 vPatUv;
uniform vec3 patA;
uniform vec3 patB;
uniform float patFreq;
uniform float patTwist;
uniform float patDuty;
float patValue(vec3 p, vec2 uv, float flip) {
  #if PAT_MODE == 0
    float ang = atan(p.z * flip, p.x * flip);
    return ang / 6.2831853 * patFreq + length(p.xz) * patTwist;
  #elif PAT_MODE == 1
    float ang = atan(p.z * flip, p.x * flip);
    return ang / 6.2831853 * patFreq + p.y * patTwist;
  #elif PAT_MODE == 2
    return uv.x * patFreq + uv.y * patTwist;
  #else
    float ang = atan(p.y * flip, p.x * flip);
    return ang / 6.2831853 * patFreq + length(p.xy) * patTwist;
  #endif
}`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  float s = patValue(vPatPos, vPatUv, 1.0);
  float s2 = patValue(vPatPos, vPatUv, -1.0);
  float w = min(fwidth(s), fwidth(s2)) * 0.75 + 0.002;
  float f = fract(s);
  float m = smoothstep(patDuty - w, patDuty + w, f) * (1.0 - smoothstep(1.0 - w, 1.0, f));
  m = 1.0 - m;
  diffuseColor.rgb *= mix(patA, patB, m);
}`,
        );
    };
    m.defines = { PAT_MODE: MODE_ID[o.mode] };
    m.customProgramCacheKey = () => `pattern-${MODE_ID[o.mode]}`;
    return m;
  });
}

/** Soft dark disc used as a cheap contact shadow under props. */
export function blobShadowMaterial(tex: THREE.Texture): THREE.MeshBasicMaterial {
  return cached(
    'blobshadow',
    () =>
      new THREE.MeshBasicMaterial({
        map: tex,
        color: '#5a2a4a',
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
  );
}

export function glowSpriteMaterial(tex: THREE.Texture, color: C, opacity = 0.9): THREE.SpriteMaterial {
  return cached(
    `glow:${String(color)}:${opacity}`,
    () =>
      new THREE.SpriteMaterial({
        map: tex,
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
  );
}

/** A fresh (uncached) clone for objects that animate their own material. */
export function unique<T extends THREE.Material>(m: T): T {
  const c = m.clone() as T;
  if ((m as THREE.Material).onBeforeCompile) c.onBeforeCompile = m.onBeforeCompile;
  return c;
}
