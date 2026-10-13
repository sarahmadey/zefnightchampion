// The ground: one big heightfield coloured per region (frosting grass,
// marshmallow fluff, sugar sand, cocoa soil, gumdrop slopes).

import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { REGION_Z, WATER_Y, pathLateralApprox, riverInfo, terrainHeight, WORLD_BOUNDS } from '../game/route';
import { cachedGeo } from '../three/geometry';
import { vcolor } from '../three/materials';
import { clamp, noise2, smoothstep } from '../three/util';

const C = (h: string) => new THREE.Color(h);

const PAL = {
  home: [C('#8fd87a'), C('#bff0a0')],
  garden: [C('#97dc7c'), C('#cdf3a6')],
  meadow: [C('#fff2f8'), C('#ffd3e8')],
  river: [C('#a9e584'), C('#d9f5a0')],
  woods: [C('#7d5a3a'), C('#9c7a46')],
  mountain: [C('#d9b8f3'), C('#ffc6e3')],
};
const SAND = C('#fde7a8');
const BED = C('#e8b44c');
const PATH_EDGE = C('#fff1c9');
const MOSS = C('#6f9a4c');

function regionWeights(z: number) {
  const b = (edge: number) => smoothstep(edge + 3, edge - 3, z);
  const g = b(REGION_Z.gardenStart);
  const m = b(REGION_Z.meadowStart);
  const r = b(REGION_Z.riverStart);
  const w = b(REGION_Z.woodsStart);
  const mt = b(REGION_Z.mountainStart);
  return { home: 1 - g, garden: g - m, meadow: m - r, river: r - w, woods: w - mt, mountain: mt };
}

const tmp = new THREE.Color();
const tmp2 = new THREE.Color();

function groundColor(x: number, z: number, h: number, out: THREE.Color): THREE.Color {
  const w = regionWeights(z);
  const n = noise2(x * 0.18, z * 0.18);
  const n2 = noise2(x * 0.6 + 11, z * 0.6 - 3);
  out.setRGB(0, 0, 0);
  for (const key of Object.keys(w) as (keyof typeof w)[]) {
    const k = w[key];
    if (k <= 0.0001) continue;
    const [a, b] = PAL[key];
    tmp.copy(a).lerp(b, clamp(n * 0.9 + n2 * 0.25, 0, 1));
    if (key === 'woods') tmp.lerp(MOSS, smoothstep(0.55, 0.8, n2) * 0.6);
    out.r += tmp.r * k;
    out.g += tmp.g * k;
    out.b += tmp.b * k;
  }
  // river banks: sugar sand, golden bed under the water
  const r = riverInfo(x, z);
  if (r.dist < r.half + 3) {
    const sand = 1 - smoothstep(r.half + 0.5, r.half + 3, r.dist);
    out.lerp(SAND, sand * 0.85);
    if (h < WATER_Y) out.lerp(BED, smoothstep(WATER_Y, WATER_Y - 0.8, h));
  }
  // a soft lighter band hugging the path
  const nearPath = 1 - smoothstep(1.4, 3.2, Math.abs(pathLateralApprox(x, z)));
  out.lerp(PATH_EDGE, nearPath * 0.35);
  // distant rims get a dreamy lilac haze
  const rim = smoothstep(30, 70, Math.abs(x));
  tmp2.set('#e9c8f0');
  out.lerp(tmp2, rim * 0.35);
  return out;
}

/** Non-uniform x spacing: dense near the path, coarse at the far edges. */
function xAt(u: number): number {
  return 90 * (0.33 * u + 0.67 * u * u * u);
}

export function terrainGeometry(): THREE.BufferGeometry {
  return cachedGeo('terrain', () => {
    const segX = 150;
    const zMax = WORLD_BOUNDS.maxZ;
    const zMin = WORLD_BOUNDS.minZ;
    const segZ = 330;
    const positions = new Float32Array((segX + 1) * (segZ + 1) * 3);
    const colors = new Float32Array((segX + 1) * (segZ + 1) * 3);
    const col = new THREE.Color();
    let i = 0;
    for (let iz = 0; iz <= segZ; iz++) {
      const z = zMax + ((zMin - zMax) * iz) / segZ;
      for (let ix = 0; ix <= segX; ix++) {
        const u = (ix / segX) * 2 - 1;
        const x = xAt(u);
        const h = terrainHeight(x, z);
        positions[i * 3] = x;
        positions[i * 3 + 1] = h;
        positions[i * 3 + 2] = z;
        groundColor(x, z, h, col);
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
        i++;
      }
    }
    const indices: number[] = [];
    for (let iz = 0; iz < segZ; iz++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = iz * (segX + 1) + ix;
        const b = a + segX + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  });
}

/** A much coarser copy used only for tap raycasts (cheap to hit-test). */
export function terrainProxyGeometry(): THREE.BufferGeometry {
  return cachedGeo('terrain-proxy', () => {
    const segX = 60;
    const segZ = 130;
    const g = new THREE.BufferGeometry();
    const pos: number[] = [];
    for (let iz = 0; iz <= segZ; iz++) {
      const z = WORLD_BOUNDS.maxZ + ((WORLD_BOUNDS.minZ - WORLD_BOUNDS.maxZ) * iz) / segZ;
      for (let ix = 0; ix <= segX; ix++) {
        const x = xAt((ix / segX) * 2 - 1);
        pos.push(x, Math.max(terrainHeight(x, z), WATER_Y), z);
      }
    }
    const idx: number[] = [];
    for (let iz = 0; iz < segZ; iz++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = iz * (segX + 1) + ix;
        const b = a + segX + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  });
}

export function Terrain({ onGroundTap }: { onGroundTap: (p: THREE.Vector3, e: ThreeEvent<PointerEvent>) => void }) {
  const geo = useMemo(() => terrainGeometry(), []);
  const proxy = useMemo(() => terrainProxyGeometry(), []);
  return (
    <group>
      <mesh geometry={geo} material={vcolor(0.92, 'terrain')} receiveShadow />
      <mesh
        geometry={proxy}
        visible={false}
        onPointerDown={(e) => {
          onGroundTap(e.point.clone(), e);
        }}
      />
    </group>
  );
}
