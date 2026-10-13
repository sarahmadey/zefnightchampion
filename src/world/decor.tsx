// Shared tools for decorating regions: instanced sets (one draw call for
// many props), a wind-sway material, and terrain-aware scatter placement that
// keeps the path, stops and lights clear.

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STOPS, nearestOnRoute, pathXAtZ, terrainHeight, WATER_Y, riverInfo } from '../game/route';
import { STOP_DEFS, stopWorldPoints } from './stopDefs';
import { sharedTime } from '../three/shaders';
import { mulberry32, randRange } from '../three/util';

export interface Placement {
  pos: THREE.Vector3;
  rotY: number;
  scale: number | [number, number, number];
  color?: THREE.ColorRepresentation;
  tilt?: [number, number];
}

const cullSphere = new THREE.Sphere();

/**
 * Hide an object when the camera is far from it (beyond `maxDist` from the
 * edge of its bounding sphere). Small repeated decorations fade into the fog
 * anyway, so skipping them keeps phones fast.
 */
export function useDistanceCull(ref: RefObject<THREE.Object3D | null>, maxDist: number | undefined, center?: THREE.Vector3, radius = 0) {
  useFrame(({ camera }) => {
    const o = ref.current;
    if (!o || !maxDist) return;
    if (center) {
      o.visible = camera.position.distanceTo(center) - radius < maxDist;
      return;
    }
    const mesh = o as THREE.Mesh;
    if (!mesh.geometry && !(o as THREE.InstancedMesh).isInstancedMesh) return;
    const im = o as THREE.InstancedMesh;
    const bs = im.isInstancedMesh ? im.boundingSphere : mesh.geometry.boundingSphere;
    if (!bs) return;
    cullSphere.copy(bs).applyMatrix4(o.matrixWorld);
    o.visible = camera.position.distanceTo(cullSphere.center) - cullSphere.radius < maxDist;
  });
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const sc = new THREE.Vector3();

export function InstancedSet({
  geometry,
  material,
  items,
  castShadow = false,
  receiveShadow = false,
  maxDist,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Placement[];
  castShadow?: boolean;
  receiveShadow?: boolean;
  maxDist?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useDistanceCull(ref, maxDist);
  useLayoutEffect(() => {
    const mesh = ref.current;
    const col = new THREE.Color();
    items.forEach((it, i) => {
      e.set(it.tilt?.[0] ?? 0, it.rotY, it.tilt?.[1] ?? 0);
      q.setFromEuler(e);
      if (typeof it.scale === 'number') sc.setScalar(it.scale);
      else sc.set(...it.scale);
      m4.compose(it.pos, q, sc);
      mesh.setMatrixAt(i, m4);
      if (it.color !== undefined) mesh.setColorAt(i, col.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      raycast={() => null}
    />
  );
}

/** Shared uniforms that make plants lean in the windmill's breeze. */
export const windUniforms = {
  breeze: { value: 0 },
  breezeCenter: { value: new THREE.Vector3(0, 0, -50) },
};

/**
 * Wrap a standard material so geometry above y=0 sways in the wind. Each
 * instance (or object) gets its own phase from its position.
 */
export function swaying<T extends THREE.MeshStandardMaterial>(mat: T, amount = 0.04, key = ''): T {
  const m = mat;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.time = sharedTime;
    shader.uniforms.swayAmt = { value: amount };
    shader.uniforms.breeze = windUniforms.breeze;
    shader.uniforms.breezeCenter = windUniforms.breezeCenter;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float time;\nuniform float swayAmt;\nuniform float breeze;\nuniform vec3 breezeCenter;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #else
            vec3 ip = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
          #endif
          float h = max(position.y, 0.0);
          float ph = ip.x * 0.37 + ip.z * 0.23;
          float near = 1.0 - smoothstep(4.0, 18.0, distance(ip.xz, breezeCenter.xz));
          float gust = breeze * near;
          float amt = swayAmt * (1.0 + gust * 6.0);
          transformed.x += (sin(time * (1.4 + gust * 3.0) + ph) * amt + gust * swayAmt * 3.0) * h * h;
          transformed.z += cos(time * 1.15 + ph * 1.3) * amt * 0.6 * h * h;
        }`,
      );
  };
  m.customProgramCacheKey = () => `sway-${key}-${amount}`;
  return m;
}

/** Circles (x, z, r) that decorations must stay out of. */
let keepOuts: [number, number, number][] | null = null;
export function stopKeepOuts(): [number, number, number][] {
  if (keepOuts) return keepOuts;
  const out: [number, number, number][] = [];
  for (let i = 0; i <= STOPS; i++) {
    const w = stopWorldPoints(i);
    const r = i === 0 ? 0 : i === 14 ? 3 : 4.6;
    if (r > 0) out.push([w.object.x, w.object.z, r]);
    out.push([w.zef.x, w.zef.z, 2.2]);
    out.push([w.light.x, w.light.z, 1.2]);
    void STOP_DEFS;
  }
  keepOuts = out;
  return out;
}

export interface ScatterOpts {
  seed: number;
  count: number;
  zMin: number;
  zMax: number;
  /** lateral distance from the path */
  minLat: number;
  maxLat: number;
  scale: [number, number];
  avoidWater?: boolean;
  /** extra spacing from stop objects */
  keepOutPad?: number;
  colors?: THREE.ColorRepresentation[];
  /** keep only one side of the path (1 right, -1 left) */
  side?: number;
  tilt?: number;
  minSpacing?: number;
  yOffset?: number;
}

export function scatter(o: ScatterOpts): Placement[] {
  const rng = mulberry32(o.seed);
  const out: Placement[] = [];
  const ko = stopKeepOuts();
  let tries = 0;
  while (out.length < o.count && tries < o.count * 40) {
    tries++;
    const z = randRange(rng, o.zMin, o.zMax);
    const side = o.side ?? (rng() < 0.5 ? -1 : 1);
    const lat = randRange(rng, o.minLat, o.maxLat) * side;
    const x = pathXAtZ(z) + lat;
    const n = nearestOnRoute(x, z);
    if (Math.abs(n.lateral) < o.minLat * 0.9) continue;
    if (o.avoidWater !== false) {
      const r = riverInfo(x, z);
      if (r.dist < r.half + 1.4) continue;
    }
    let blocked = false;
    for (const [kx, kz, kr] of ko) {
      if (Math.hypot(x - kx, z - kz) < kr + (o.keepOutPad ?? 0)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    if (o.minSpacing) {
      if (out.some((p) => Math.hypot(p.pos.x - x, p.pos.z - z) < o.minSpacing!)) continue;
    }
    const h = terrainHeight(x, z);
    if (o.avoidWater !== false && h < WATER_Y + 0.05) continue;
    const s = randRange(rng, o.scale[0], o.scale[1]);
    out.push({
      pos: new THREE.Vector3(x, h + (o.yOffset ?? 0), z),
      rotY: rng() * Math.PI * 2,
      scale: s,
      color: o.colors ? o.colors[Math.floor(rng() * o.colors.length)] : undefined,
      tilt: o.tilt ? [randRange(rng, -o.tilt, o.tilt), randRange(rng, -o.tilt, o.tilt)] : undefined,
    });
  }
  return out;
}

/** Ground height helper for hand-placed props. */
export function groundAt(x: number, z: number, lift = 0): THREE.Vector3 {
  return new THREE.Vector3(x, terrainHeight(x, z) + lift, z);
}
