// Strawberry Garden: towering strawberry plants, layered cake terraces with
// frosting drips, swaying frosting flowers, and a glossy jam stream spilling
// from a giant tipped jam jar.

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  cachedGeo,
  cuppedPetal,
  curveFrom,
  frostingDrips,
  lathe,
  merge,
  paint,
  pipedSwirl,
  strawberryGeometry,
  tube,
  flowRibbon,
  xform,
} from '../../three/geometry';
import { gloss, jelly, matte, vcolor, vcolorGloss } from '../../three/materials';
import { makeFlowMaterial } from '../../three/shaders';
import { InstancedSet, scatter, swaying, groundAt } from '../decor';
import { terrainHeight } from '../../game/route';
import { TAU, mulberry32 } from '../../three/util';
import { Wobbly } from '../../three/bits';

const LEAF = '#3faa4c';
const LEAF_DARK = '#2f8a3c';

/** A tall arching strawberry plant with leaves and hanging berries. */
export function strawberryPlantGeometry(variant: number) {
  return cachedGeo(`berry-plant-${variant}`, () => {
    const rng = mulberry32(50 + variant);
    const parts: THREE.BufferGeometry[] = [];
    // big leaves around the base
    const leaves = 5 + variant;
    for (let i = 0; i < leaves; i++) {
      const a = (i / leaves) * TAU + rng() * 0.4;
      const leaf = cuppedPetal(1.1 + rng() * 0.4, 0.45, -0.18, 0.03);
      leaf.rotateX(-0.9 - rng() * 0.3);
      leaf.rotateY(-a + Math.PI / 2);
      leaf.translate(Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15);
      paint(leaf, (p) => new THREE.Color(LEAF_DARK).lerp(new THREE.Color('#6fd45e'), Math.min(1, p.y * 0.8)));
      parts.push(leaf);
    }
    const stems = variant === 2 ? 3 : 2;
    for (let k = 0; k < stems; k++) {
      const a = (k / stems) * TAU + variant;
      const H = 2.2 + rng() * 1.2 + variant * 0.4;
      const reach = 1.0 + rng() * 0.5;
      const dir = new THREE.Vector2(Math.cos(a), Math.sin(a));
      const pts: [number, number, number][] = [
        [0, 0, 0],
        [dir.x * 0.15, H * 0.45, dir.y * 0.15],
        [dir.x * reach * 0.55, H * 0.92, dir.y * reach * 0.55],
        [dir.x * reach, H, dir.y * reach],
        [dir.x * reach * 1.2, H * 0.86, dir.y * reach * 1.2],
      ];
      const stem = tube(curveFrom(pts), { segments: 24, radial: 8, radius: (t) => 0.07 * (1 - t * 0.5) });
      paint(stem, '#3a9a45');
      parts.push(stem);
      const tip = new THREE.Vector3(...pts[4]);
      const berryScale = 1.15 + rng() * 0.45;
      const berry = strawberryGeometry(70 + variant * 3 + k, 50);
      berry.rotateX(Math.PI); // hang upside down: the calyx at the top
      berry.scale(berryScale, berryScale, berryScale);
      berry.translate(tip.x, tip.y - 0.62 * berryScale, tip.z);
      parts.push(berry);
    }
    if (variant !== 1) {
      // a white strawberry flower
      const fh = 1.4;
      const fstem = tube(curveFrom([[0, 0, 0], [-0.2, fh * 0.6, 0.1], [-0.35, fh, 0.15]]), { segments: 10, radial: 6, radius: () => 0.04 });
      paint(fstem, '#3a9a45');
      parts.push(fstem);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        const p = cuppedPetal(0.32, 0.2, 0.05, 0.02);
        p.rotateX(-Math.PI / 2 + 0.35);
        p.rotateY(-a);
        p.translate(-0.35, fh + 0.02, 0.15);
        paint(p, '#ffffff');
        parts.push(p);
      }
      const c = new THREE.SphereGeometry(0.1, 12, 8);
      c.scale(1, 0.6, 1);
      c.translate(-0.35, fh + 0.07, 0.15);
      paint(c, '#ffd43b');
      parts.push(c);
    }
    return merge(parts);
  });
}

/** Single giant strawberries sitting in the grass. */
function groundBerryGeometry() {
  return cachedGeo('ground-berry', () => {
    const g = strawberryGeometry(91, 60);
    g.translate(0, 0.62, 0);
    return g;
  });
}

export function cakeGeometry(tiers: number, r0: number, seed: number) {
  return cachedGeo(`cake-${tiers}-${r0}-${seed}`, () => {
    const parts: THREE.BufferGeometry[] = [];
    const rng = mulberry32(seed);
    const flavors = [
      ['#fff4e6', '#ff8fb3'],
      ['#ffe0ec', '#ffffff'],
      ['#c98a5a', '#ffd6e8'],
    ];
    let y = 0;
    for (let t = 0; t < tiers; t++) {
      const r = r0 * (1 - t * 0.28);
      const h = 0.9 - t * 0.08;
      const [sponge, cream] = flavors[(t + seed) % flavors.length];
      const body = lathe(
        [
          [0, 0],
          [r, 0],
          [r * 1.01, h * 0.5],
          [r, h],
          [r * 0.96, h + 0.04],
          [0, h + 0.04],
        ],
        40,
        16,
      );
      // jam layer stripes
      paint(body, (p) => {
        const ly = (p.y % h) / h;
        if (Math.abs(ly - 0.5) < 0.06) return new THREE.Color('#e3263f');
        return new THREE.Color(Math.hypot(p.x, p.z) > r * 0.97 && p.y > h * 0.9 ? cream : sponge);
      });
      body.translate(0, y, 0);
      parts.push(body);
      const drips = frostingDrips(r * 0.99, y + h + 0.02, Math.round(r * 9), 0.45, 0.07, seed + t);
      paint(drips, cream === '#ffffff' ? '#ffffff' : '#ffd1e3');
      parts.push(drips);
      // berries and rosettes around the rim
      const n = Math.round(r * 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rng() * 0.2;
        if (i % 2 === 0) {
          const b = strawberryGeometry(200 + i, 24);
          b.scale(0.32, 0.32, 0.32);
          b.translate(Math.cos(a) * r * 0.78, y + h + 0.2, Math.sin(a) * r * 0.78);
          parts.push(b);
        } else {
          const sw = pipedSwirl({ radius: 0.16, height: 0.2, thickness: 0.06, turns: 2 });
          sw.translate(Math.cos(a) * r * 0.8, y + h + 0.02, Math.sin(a) * r * 0.8);
          paint(sw, '#ffffff');
          parts.push(sw);
        }
      }
      y += h + 0.04;
    }
    const top = strawberryGeometry(seed + 300, 40);
    top.scale(0.9, 0.9, 0.9);
    top.translate(0, y + 0.55, 0);
    parts.push(top);
    return merge(parts);
  });
}

function flowerGeometry(color: string, key: number) {
  return cachedGeo(`garden-flower-${key}`, () => {
    const parts: THREE.BufferGeometry[] = [];
    const h = 0.55;
    const stem = tube(curveFrom([[0, 0, 0], [0.04, h * 0.5, 0], [0, h, 0.02]]), { segments: 8, radial: 5, radius: () => 0.025 });
    paint(stem, '#46b04f');
    parts.push(stem);
    const leaf = cuppedPetal(0.22, 0.1, -0.03, 0.012);
    leaf.rotateZ(-0.9);
    leaf.translate(0.02, 0.15, 0);
    paint(leaf, LEAF);
    parts.push(leaf);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const p = cuppedPetal(0.16, 0.1, 0.03, 0.015);
      p.rotateX(-Math.PI / 2 + 0.5);
      p.rotateY(-a);
      p.translate(0, h, 0.02);
      paint(p, color);
      parts.push(p);
    }
    const c = pipedSwirl({ radius: 0.06, height: 0.06, thickness: 0.03, turns: 1.6 });
    c.translate(0, h + 0.01, 0.02);
    paint(c, '#fff3b0');
    parts.push(c);
    return merge(parts);
  });
}

function jarGeometry() {
  return cachedGeo('jam-jar', () =>
    lathe(
      [
        [0, 0],
        [0.9, 0],
        [1.0, 0.15],
        [1.0, 1.6],
        [0.8, 1.85],
        [0.78, 2.05],
        [0, 2.05],
      ],
      36,
      20,
    ),
  );
}

function lidClothGeometry() {
  return cachedGeo('jam-lid', () => {
    const g = new THREE.CylinderGeometry(1.05, 1.15, 0.28, 32, 2, false);
    paint(g, (p) => {
      const cx = Math.floor((p.x + 4) / 0.25);
      const cz = Math.floor((p.z + 4) / 0.25);
      return new THREE.Color((cx + cz) % 2 === 0 ? '#e3263f' : '#ffffff');
    });
    return g;
  });
}

export const JAM_SOURCE = new THREE.Vector3(13.5, 0, -7.5);
export const JAM_POOL = new THREE.Vector3(5.3, 0, -26.8);

function JamStream() {
  const geo = useMemo(
    () =>
      cachedGeo('jam-stream', () => {
        const pts: [number, number, number][] = [
          [JAM_SOURCE.x - 1.2, 0, JAM_SOURCE.z - 0.6],
          [10.5, 0, -11.5],
          [7.4, 0, -14.5],
          [7.6, 0, -18.5],
          [6.2, 0, -22.5],
          [JAM_POOL.x + 0.2, 0, JAM_POOL.z + 1.6],
        ];
        const curve = curveFrom(pts, 0.5);
        return flowRibbon(curve, (t) => 0.5 + 0.12 * Math.sin(t * 12) + t * 0.15, (x, z) => terrainHeight(x, z) + 0.06, 140, 6);
      }),
    [],
  );
  const banks = useMemo(
    () =>
      cachedGeo('jam-banks', () => {
        const pos = geo.getAttribute('position') as THREE.BufferAttribute;
        const across = 7;
        const rows = pos.count / across;
        const parts: THREE.BufferGeometry[] = [];
        for (const col of [0, across - 1]) {
          const pts: [number, number, number][] = [];
          for (let r = 0; r < rows; r += 4) {
            const i = r * across + col;
            pts.push([pos.getX(i), pos.getY(i) + 0.03, pos.getZ(i)]);
          }
          const c = curveFrom(pts, 0.5);
          const len = c.getLength();
          parts.push(tube(c, { segments: Math.ceil(len * 4), radial: 6, radius: (t) => 0.09 * (0.8 + 0.3 * Math.abs(Math.sin(t * len * 4))) }));
        }
        return paint(merge(parts), '#fff4f8');
      }),
    [geo],
  );
  const mat = useMemo(
    () => makeFlowMaterial({ deep: '#8f0a22', shallow: '#e3263f', foam: '#ff9fb4', speed: 0.55, sparkle: 0.8, gloss: 1.6, scale: 0.9 }),
    [],
  );
  return (
    <group>
      <mesh geometry={geo} material={mat} receiveShadow />
      <mesh geometry={banks} material={vcolor(0.5, 'jambanks')} />
    </group>
  );
}

function JamJar() {
  const p = groundAt(JAM_SOURCE.x, JAM_SOURCE.z);
  return (
    <group position={p} rotation={[0, 0.9, 1.25]}>
      <Wobbly sound="bloop" particles="drop" particleColors={['#d7143a', '#ff4f6d']} hit={1.6} hitOffset={[0, 1, 0]}>
        <mesh geometry={jarGeometry()} material={jelly('#ffe9f0', 0.45)} castShadow />
        <mesh material={gloss('#c8102e', 0.08, 1)} position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.92, 0.88, 1.45, 28]} />
        </mesh>
        <mesh geometry={lidClothGeometry()} material={vcolor(0.8, 'gingham')} position={[0, 2.1, 0]} />
        <mesh material={gloss('#ffd43b', 0.3, 0.5)} position={[0, 2.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.82, 0.05, 6, 30]} />
        </mesh>
      </Wobbly>
    </group>
  );
}

export function Garden() {
  const plants = useMemo(
    () =>
      [0, 1, 2].map((v) =>
        scatter({ seed: 10 + v, count: 5, zMin: -29, zMax: -3, minLat: 5.5, maxLat: 16, scale: [0.9, 1.35], minSpacing: 4.5 }),
      ),
    [],
  );
  const berries = useMemo(
    () => scatter({ seed: 21, count: 12, zMin: -30, zMax: -2, minLat: 3.4, maxLat: 12, scale: [0.6, 1.1], minSpacing: 2 }),
    [],
  );
  const cakes = useMemo(
    () => [
      { geo: cakeGeometry(3, 2.6, 1), pos: groundAt(-11, -9.5), rot: 0.4 },
      { geo: cakeGeometry(2, 2.2, 2), pos: groundAt(12, -19.5), rot: 1.2 },
      { geo: cakeGeometry(3, 3.0, 3), pos: groundAt(-14, -22), rot: 2.2 },
      { geo: cakeGeometry(2, 1.8, 4), pos: groundAt(-7, -29), rot: 0.8 },
    ],
    [],
  );
  const flowerColors = ['#ff8fb8', '#ffffff', '#b9a4ff', '#ffd166'];
  const flowers = useMemo(
    () =>
      flowerColors.map((_, i) =>
        scatter({ seed: 40 + i, count: 22, zMin: -30, zMax: 2, minLat: 2.2, maxLat: 14, scale: [0.8, 1.5] }),
      ),
    [],
  );
  const swirls = useMemo(
    () => scatter({ seed: 33, count: 40, zMin: -30, zMax: 4, minLat: 1.9, maxLat: 10, scale: [0.6, 1.2], colors: ['#ffffff', '#ffd1e3', '#fff1b0', '#d7f5ff'] }),
    [],
  );
  const flowerMats = useMemo(() => flowerColors.map((_, i) => swaying(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 0.09, `flower${i}`)), []);
  const plantMat = useMemo(() => swaying(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.6 }), 0.012, 'plant'), []);
  return (
    <group>
      {plants.map((items, v) => (
        <InstancedSet key={v} geometry={strawberryPlantGeometry(v)} material={plantMat} items={items} castShadow />
      ))}
      <InstancedSet geometry={groundBerryGeometry()} material={vcolorGloss(0.25, 0.9)} items={berries} castShadow />
      {cakes.map((c, i) => (
        <Wobbly key={i} position={[c.pos.x, c.pos.y, c.pos.z]} rotation={[0, c.rot, 0]} sound="boing" soundArg={i} particles="sparkle" strength={0.4} hit={2.4} hitOffset={[0, 1.2, 0]}>
          <mesh geometry={c.geo} material={vcolor(0.6, 'cake')} castShadow receiveShadow />
        </Wobbly>
      ))}
      {flowers.map((items, i) => (
        <InstancedSet key={i} geometry={flowerGeometry(flowerColors[i], i)} material={flowerMats[i]} items={items} />
      ))}
      <InstancedSet
        geometry={cachedGeo('garden-swirl', () => xform(pipedSwirl({ radius: 0.22, height: 0.28, thickness: 0.09, turns: 2.2 }), { pos: [0, -0.02, 0] }))}
        material={matte('#ffffff', 0.55)}
        items={swirls}
      />
      <JamStream />
      <JamJar />
    </group>
  );
}

