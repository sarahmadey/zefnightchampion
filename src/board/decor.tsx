// Instanced decorations for a land (one draw call per prop type), a gentle
// sway for plants, and placement that keeps the stepping-stone path clear.

import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { sharedTime } from '../three/shaders';
import { mulberry32, randRange } from '../three/util';
import { DEFAULT_RULES, landRange, type QuestRules } from '../state/progress';
import { chestPos, groundHeight, landCurve, landDepth, landZ, spacePos as spaceAt } from './layout';

export interface Placement {
  pos: THREE.Vector3;
  rotY: number;
  scale: number;
  tilt?: [number, number];
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
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Placement[];
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      e.set(it.tilt?.[0] ?? 0, it.rotY, it.tilt?.[1] ?? 0);
      q.setFromEuler(e);
      sc.setScalar(it.scale);
      m4.compose(it.pos, q, sc);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} raycast={() => null} />;
}

/** Wrap a standard material so geometry above y=0 sways in a breeze. */
export function swaying<T extends THREE.MeshStandardMaterial>(mat: T, amount = 0.04, key = ''): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.time = sharedTime;
    shader.uniforms.swayAmt = { value: amount };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float time;\nuniform float swayAmt;')
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
          transformed.x += sin(time * 1.4 + ph) * swayAmt * h * h;
          transformed.z += cos(time * 1.15 + ph * 1.3) * swayAmt * 0.6 * h * h;
        }`,
      );
  };
  mat.customProgramCacheKey = () => `sway-${key}-${amount}`;
  return mat;
}

const pathSamples = new Map<string, THREE.Vector3[]>();

function samplesFor(land: number, rules: QuestRules): THREE.Vector3[] {
  const key = `${land}:${rules.firstPrize}:${rules.prizeEvery}`;
  let s = pathSamples.get(key);
  if (!s) {
    const c = landCurve(land, rules);
    s = c.getSpacedPoints(80);
    pathSamples.set(key, s);
  }
  return s;
}

/** Distance from (x, z) to the nearest point of a land's path. */
export function distToPath(land: number, x: number, z: number, rules: QuestRules = DEFAULT_RULES): number {
  let best = Infinity;
  for (const p of samplesFor(land, rules)) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < best) best = d;
  }
  return best;
}

/** Would a prop at (x, z) stand between the board camera and a stone? */
function blocksView(land: number, x: number, z: number, rules: QuestRules): boolean {
  const { start, end } = landRange(land, rules);
  for (let k = start; k <= end; k++) {
    const p = k === start ? landCurve(land, rules).getPointAt(0) : spaceAt(k, rules);
    const dz = z - p.z;
    if (dz > -1 && dz < 9 && Math.abs(x - p.x) < 2.3 + dz * 0.3) return true;
  }
  return false;
}

export interface LandScatterOpts {
  seed: number;
  count: number;
  scale: [number, number];
  clear: number;
  maxX: number;
  edge?: boolean;
  tilt?: number;
  minSpacing?: number;
}

/** Scatter props over a land, away from the path, the chest and the bridges. */
export function landScatter(land: number, o: LandScatterOpts, rules: QuestRules = DEFAULT_RULES): Placement[] {
  const rng = mulberry32(o.seed + land * 1013);
  const out: Placement[] = [];
  const d = landDepth(land, rules);
  const z0 = landZ(land, rules);
  const chest = chestPos(land, rules);
  const entry = landCurve(land, rules).getPointAt(0);
  const isFirst = landRange(land, rules).start === 0;
  let tries = 0;
  while (out.length < o.count && tries < o.count * 60) {
    tries++;
    const z = randRange(rng, z0 - d / 2 - 2, z0 + d / 2 + 2);
    let x = randRange(rng, -o.maxX, o.maxX);
    if (o.edge) x = (rng() < 0.5 ? -1 : 1) * randRange(rng, Math.max(6, o.maxX * 0.55), o.maxX);
    if (distToPath(land, x, z, rules) < o.clear) continue;
    if (Math.hypot(x - chest.x, z - chest.z) < 3.4) continue;
    if (Math.hypot(x - entry.x, z - entry.z) < (isFirst ? 3.2 : 2.4)) continue;
    // keep the bridge corridors open
    if (Math.abs(x) < 2.2 && (z > z0 + d / 2 - 0.5 || z < z0 - d / 2 + 0.5)) continue;
    // and keep the camera's view of every stone clear (it looks from behind, +z)
    if (blocksView(land, x, z, rules)) continue;
    if (o.minSpacing && out.some((p) => Math.hypot(p.pos.x - x, p.pos.z - z) < o.minSpacing!)) continue;
    out.push({
      pos: new THREE.Vector3(x, groundHeight(x, z) - 0.02, z),
      rotY: rng() * Math.PI * 2,
      scale: randRange(rng, o.scale[0], o.scale[1]),
      tilt: o.tilt ? [randRange(rng, -o.tilt, o.tilt), randRange(rng, -o.tilt, o.tilt)] : undefined,
    });
  }
  return out;
}
