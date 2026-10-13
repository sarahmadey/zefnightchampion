// The candy path: a frosting ribbon with piped edges, region-styled pavers
// (sugar cookies, marshmallow cushions, wafer planks, chocolate cobbles,
// crystal steps) and a round patio at every stop.

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  ROUTE_LENGTH,
  STOP_S,
  pointAt,
  regionAtZ,
  rightAt,
  type RegionId,
} from '../game/route';
import { cachedGeo, curveFrom, lumpy, merge, paint, puckGeometry, roundedBox, tube } from '../three/geometry';
import { gloss, jelly, marshmallow, matte, vcolor } from '../three/materials';
import { mulberry32, randRange } from '../three/util';
import { useDistanceCull } from './decor';

const PATH_HALF = 1.2;
export const BRIDGE_Z: [number, number] = [-72.6, -66.9];

const RIBBON: Record<RegionId, string> = {
  home: '#fff0d2',
  garden: '#ffe9d6',
  meadow: '#fff6fb',
  river: '#f6d58f',
  woods: '#a77650',
  mountain: '#f1dcff',
};
const PIPING: Record<RegionId, string> = {
  home: '#ff9fc4',
  garden: '#ff7fa8',
  meadow: '#ffffff',
  river: '#ffd84a',
  woods: '#f3c27a',
  mountain: '#c79bff',
};

function inBridge(z: number) {
  return z < BRIDGE_Z[1] && z > BRIDGE_Z[0];
}

function ribbonGeometry(): THREE.BufferGeometry {
  return cachedGeo('path-ribbon', () => {
    const step = 0.35;
    const across = [-1, -0.5, 0, 0.5, 1];
    const pos: number[] = [];
    const col: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const p = new THREE.Vector3();
    const r = new THREE.Vector3();
    const c = new THREE.Color();
    let rows = 0;
    let prevValid = false;
    for (let s = 0; s <= ROUTE_LENGTH; s += step) {
      pointAt(s, p);
      rightAt(s, r);
      const valid = !inBridge(p.z);
      if (!valid) {
        prevValid = false;
        continue;
      }
      c.set(RIBBON[regionAtZ(p.z)]);
      for (const a of across) {
        const crown = (1 - a * a) * 0.02;
        pos.push(p.x + r.x * a * PATH_HALF, p.y + 0.035 + crown, p.z + r.z * a * PATH_HALF);
        const shade = 1 - Math.abs(a) * 0.06;
        col.push(c.r * shade, c.g * shade, c.b * shade);
        uv.push(s, (a + 1) / 2);
      }
      if (prevValid) {
        const base = (rows - 1) * across.length;
        for (let k = 0; k < across.length - 1; k++) {
          const a0 = base + k;
          const b0 = base + across.length + k;
          idx.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1);
        }
      }
      rows++;
      prevValid = true;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}

function pipingGeometry(): THREE.BufferGeometry {
  return cachedGeo('path-piping', () => {
    const parts: THREE.BufferGeometry[] = [];
    const p = new THREE.Vector3();
    const r = new THREE.Vector3();
    for (const side of [-1, 1]) {
      let run: [number, number, number][] = [];
      const flush = () => {
        if (run.length > 3) {
          const curve = curveFrom(run, 0.5);
          const len = curve.getLength();
          const g = tube(curve, {
            segments: Math.ceil(len * 5),
            radial: 6,
            radius: (t) => 0.05 * (0.75 + 0.35 * Math.abs(Math.sin(t * len * 5.5))),
          });
          paint(g, (q) => new THREE.Color(PIPING[regionAtZ(q.z)]));
          parts.push(g);
        }
        run = [];
      };
      for (let s = 0; s <= ROUTE_LENGTH; s += 0.8) {
        pointAt(s, p);
        rightAt(s, r);
        if (inBridge(p.z)) {
          flush();
          continue;
        }
        run.push([p.x + r.x * side * (PATH_HALF + 0.03), p.y + 0.06, p.z + r.z * side * (PATH_HALF + 0.03)]);
      }
      flush();
    }
    return parts.length === 1 ? parts[0] : merge(parts);
  });
}

interface PaverStyle {
  geo: () => THREE.BufferGeometry;
  mat: () => THREE.Material;
  colors: string[];
  spacing: number;
  layout: 'stones' | 'planks' | 'cushions';
}

const STYLES: Record<RegionId, PaverStyle> = {
  home: {
    geo: () => cachedGeo('paver-cookie', () => puckGeometry(0.3, 0.07, 14, 0.3, 9)),
    mat: () => gloss('#ffffff', 0.45, 0.4),
    colors: ['#ffc4d8', '#fff0cf', '#c9f2dc', '#ffe08a'],
    spacing: 0.72,
    layout: 'stones',
  },
  garden: {
    geo: () => cachedGeo('paver-cookie', () => puckGeometry(0.3, 0.07, 14, 0.3, 9)),
    mat: () => gloss('#ffffff', 0.45, 0.4),
    colors: ['#ffb3c9', '#fff0cf', '#ffd2df', '#ffe6a8'],
    spacing: 0.72,
    layout: 'stones',
  },
  meadow: {
    geo: () => cachedGeo('paver-cushion', () => lumpy(roundedBox(0.62, 0.16, 0.62, 0.08, 2), 0.015, 3, 2)),
    mat: () => marshmallow('#ffffff'),
    colors: ['#ffffff', '#ffe3f0', '#fff3fa', '#f6e8ff'],
    spacing: 0.7,
    layout: 'cushions',
  },
  river: {
    geo: () => cachedGeo('paver-plank', () => roundedBox(2.25, 0.07, 0.3, 0.03, 2)),
    mat: () => matte('#ffffff', 0.6),
    colors: ['#f0c070', '#e9b25c', '#f5cd84'],
    spacing: 0.38,
    layout: 'planks',
  },
  woods: {
    geo: () => cachedGeo('paver-chip', () => lumpy(puckGeometry(0.28, 0.09, 12, 0.6, 9), 0.03, 4, 5)),
    mat: () => gloss('#ffffff', 0.35, 0.5),
    colors: ['#5b3520', '#6e4228', '#4a2a18'],
    spacing: 0.7,
    layout: 'stones',
  },
  mountain: {
    geo: () =>
      cachedGeo('paver-crystal', () => {
        const g = new THREE.CylinderGeometry(0.3, 0.33, 0.1, 6);
        return g;
      }),
    mat: () => jelly('#ffffff', 0.92),
    colors: ['#e0b8ff', '#ffc2e2', '#bfe6ff', '#fff1a8'],
    spacing: 0.72,
    layout: 'stones',
  },
};

function PaverSet({ region }: { region: RegionId }) {
  const style = STYLES[region];
  const ref = useRef<THREE.InstancedMesh>(null!);
  useDistanceCull(ref, 55);
  const items = useMemo(() => {
    const rng = mulberry32(region.length * 97 + 13);
    const out: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const p = new THREE.Vector3();
    const r = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();
    let row = 0;
    for (let s = 0.5; s <= ROUTE_LENGTH - 0.5; s += style.spacing) {
      pointAt(s, p);
      if (regionAtZ(p.z) !== region || inBridge(p.z)) continue;
      rightAt(s, r);
      const yaw = Math.atan2(r.x, r.z);
      const lanes = style.layout === 'planks' ? [0] : style.layout === 'cushions' ? [-0.4, 0.4] : [-0.42, 0.42];
      for (const lane of lanes) {
        const stagger = style.layout === 'planks' ? 0 : (row % 2) * 0.18 - 0.09;
        const off = lane + stagger + randRange(rng, -0.06, 0.06);
        const x = p.x + r.x * off;
        const z = p.z + r.z * off;
        e.set(0, yaw + (style.layout === 'planks' ? Math.PI / 2 : randRange(rng, 0, Math.PI)), 0);
        q.setFromEuler(e);
        const k = style.layout === 'planks' ? 1 : randRange(rng, 0.85, 1.1);
        sc.set(k, 1, k);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, p.y + 0.045, z), q, sc);
        out.push({ m, c: new THREE.Color(style.colors[Math.floor(rng() * style.colors.length)]) });
      }
      row++;
    }
    return out;
  }, [region, style]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      mesh.setColorAt(i, it.c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  return <instancedMesh ref={ref} args={[style.geo(), style.mat(), items.length]} receiveShadow />;
}

const PLAZA: Record<RegionId, [string, string]> = {
  home: ['#ffe3ec', '#ff9fc4'],
  garden: ['#ffe4ea', '#ff7fa8'],
  meadow: ['#fff8fc', '#ffc9e3'],
  river: ['#fbe3a2', '#ffcf3d'],
  woods: ['#b58560', '#f0be78'],
  mountain: ['#f2e2ff', '#c79bff'],
};

function plazaGeometry(): THREE.BufferGeometry {
  return cachedGeo('plaza', () => puckGeometry(2.3, 0.07, 48, 0.15));
}

function plazaRimGeometry(): THREE.BufferGeometry {
  return cachedGeo('plaza-rim', () => {
    const g = new THREE.TorusGeometry(2.3, 0.045, 8, 64);
    g.rotateX(Math.PI / 2);
    return g;
  });
}

function Plazas() {
  return (
    <group>
      {STOP_S.map((s, i) => {
        if (i === 0) return null;
        const p = pointAt(s);
        const region = regionAtZ(p.z);
        const [fill, rim] = PLAZA[region];
        return (
          <group key={i} position={[p.x, p.y + 0.03, p.z]}>
            <mesh geometry={plazaGeometry()} material={matte(fill, 0.7)} receiveShadow />
            <mesh geometry={plazaRimGeometry()} material={gloss(rim, 0.35, 0.4)} position={[0, 0.03, 0]} />
          </group>
        );
      })}
    </group>
  );
}

export function CandyPath() {
  const ribbon = useMemo(() => ribbonGeometry(), []);
  const piping = useMemo(() => pipingGeometry(), []);
  return (
    <group>
      <mesh geometry={ribbon} material={vcolor(0.75, 'path')} receiveShadow />
      <mesh geometry={piping} material={vcolor(0.35, 'piping')} />
      {(Object.keys(STYLES) as RegionId[]).map((r) => (
        <PaverSet key={r} region={r} />
      ))}
      <Plazas />
    </group>
  );
}
