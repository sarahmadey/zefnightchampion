// Gumdrop Mountain: big translucent gumdrops, sparkling sugar-crystal
// clusters, glowing lanterns along the climbing path, rock-candy spires and
// the castle waiting above.

import { useMemo } from 'react';
import * as THREE from 'three';
import { cachedGeo, gumdropGeometry, merge, paint } from '../../three/geometry';
import { jelly, pattern, emissive } from '../../three/materials';
import { InstancedSet, scatter, type Placement } from '../decor';
import { ROUTE_LENGTH, STOP_S, pointAt, rightAt } from '../../game/route';
import { TAU, mulberry32, randRange } from '../../three/util';
import { Fireflies } from './Woods';
import { Glow, Wobbly } from '../../three/bits';

const GUM_COLORS = ['#ff5d8f', '#ffd43b', '#51cf66', '#4dabf7', '#b197fc', '#ff922b'];

function crystalClusterGeometry(v: number) {
  return cachedGeo(`crystal-${v}`, () => {
    const rng = mulberry32(700 + v);
    const parts: THREE.BufferGeometry[] = [];
    const n = 5 + v * 2;
    for (let i = 0; i < n; i++) {
      const h = randRange(rng, 0.6, 1.8);
      const r = randRange(rng, 0.12, 0.26);
      const g = new THREE.CylinderGeometry(r * 0.15, r, h, 6, 1);
      g.translate(0, h / 2, 0);
      const tip = new THREE.ConeGeometry(r * 0.15, 0.001, 6);
      tip.translate(0, h, 0);
      const crystal = merge([g, tip]);
      crystal.rotateZ(randRange(rng, -0.45, 0.45));
      crystal.rotateX(randRange(rng, -0.45, 0.45));
      crystal.rotateY(rng() * TAU);
      crystal.translate(randRange(rng, -0.3, 0.3), 0, randRange(rng, -0.3, 0.3));
      parts.push(crystal);
    }
    const g = merge(parts);
    paint(g, (p) => new THREE.Color('#e7f5ff').lerp(new THREE.Color('#ffffff'), Math.min(1, p.y)));
    return g;
  });
}

function rockCandyGeometry() {
  return cachedGeo('rock-candy', () => {
    const rng = mulberry32(42);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 26; i++) {
      const y = i * 0.18;
      const r = 0.45 * (1 - i / 30);
      const b = new THREE.IcosahedronGeometry(r * randRange(rng, 0.7, 1.1), 0);
      b.translate(randRange(rng, -0.15, 0.15), y, randRange(rng, -0.15, 0.15));
      parts.push(b);
    }
    const stick = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6);
    stick.translate(0, 5.1, 0);
    parts.push(stick);
    return merge(parts);
  });
}

function lanternPostGeometry() {
  return cachedGeo('mtn-lantern-post', () => {
    const post = new THREE.CylinderGeometry(0.05, 0.06, 1.6, 10);
    post.translate(0, 0.8, 0);
    return post;
  });
}

/** Lantern positions along the climbing path (decorative, not the stop-13 ones). */
function pathLanterns(): { pos: THREE.Vector3; color: string }[] {
  const out: { pos: THREE.Vector3; color: string }[] = [];
  const p = new THREE.Vector3();
  const r = new THREE.Vector3();
  let k = 0;
  for (let s = STOP_S[12] + 5; s < ROUTE_LENGTH - 1; s += 3.2) {
    if (Math.abs(s - STOP_S[13]) < 3.5 || Math.abs(s - STOP_S[14]) < 3 || Math.abs(s - STOP_S[15]) < 3) continue;
    pointAt(s, p);
    rightAt(s, r);
    const side = k % 2 ? 1 : -1;
    out.push({ pos: new THREE.Vector3(p.x + r.x * side * 1.75, p.y, p.z + r.z * side * 1.75), color: GUM_COLORS[k % GUM_COLORS.length] });
    k++;
  }
  return out;
}

export function Mountain() {
  const gums = useMemo(() => {
    const all = scatter({ seed: 160, count: 36, zMin: -160, zMax: -117, minLat: 3.2, maxLat: 22, scale: [0.9, 2.6], minSpacing: 2.2 });
    return GUM_COLORS.map((_, i) => all.filter((_, k) => k % GUM_COLORS.length === i));
  }, []);
  const crystals = useMemo(
    () => [0, 1].map((v) => scatter({ seed: 170 + v, count: 14, zMin: -165, zMax: -117, minLat: 2.6, maxLat: 20, scale: [0.7, 1.6], tilt: 0.15 })),
    [],
  );
  const spires = useMemo(
    () => scatter({ seed: 175, count: 8, zMin: -170, zMax: -125, minLat: 9, maxLat: 26, scale: [1.2, 2.2], minSpacing: 6 }),
    [],
  );
  const lanterns = useMemo(() => pathLanterns(), []);
  const crystalMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.05,
        clearcoat: 1,
        transparent: true,
        opacity: 0.82,
        emissive: new THREE.Color('#b8d8ff'),
        emissiveIntensity: 0.35,
        sheen: 1,
        sheenColor: new THREE.Color('#ffffff'),
      }),
    [],
  );
  const posts: Placement[] = lanterns.map((l) => ({ pos: l.pos, rotY: 0, scale: 1 }));
  return (
    <group>
      {gums.map((items, i) => (
        <InstancedSet key={i} geometry={gumdropGeometry(32)} material={jelly(GUM_COLORS[i], 0.8)} items={items} castShadow />
      ))}
      {crystals.map((items, v) => (
        <InstancedSet key={v} geometry={crystalClusterGeometry(v)} material={crystalMat} items={items} />
      ))}
      <InstancedSet geometry={rockCandyGeometry()} material={jelly('#d7c4ff', 0.88)} items={spires} castShadow />
      <InstancedSet geometry={lanternPostGeometry()} material={pattern({ a: '#ffffff', b: '#b197fc', mode: 'helix', freq: 1, twist: 6 })} items={posts} />
      {lanterns.map((l, i) => (
        <Wobbly key={i} position={[l.pos.x, l.pos.y + 1.75, l.pos.z]} sound="chime" soundArg={i % 8} particles="sparkle" particleColors={[l.color, '#ffffff']} hit={0.5}>
          <mesh geometry={gumdropGeometry(20)} material={jelly(l.color, 0.75)} scale={0.42} position={[0, -0.12, 0]} />
          <mesh material={emissive(l.color, 1.6)}>
            <sphereGeometry args={[0.1, 10, 8]} />
          </mesh>
          <Glow color={l.color} size={1.3} opacity={0.6} />
        </Wobbly>
      ))}
      <Fireflies count={36} zMin={-165} zMax={-120} spread={18} color="#fff1c2" />
    </group>
  );
}
