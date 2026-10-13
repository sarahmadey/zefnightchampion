// Waffle Woodland: waffle-canopy trees on rolled-wafer trunks, syrup dripping
// from the canopy edges, tiny lit doors in the trunks, chocolate mushrooms
// and warm syrup-coloured fireflies drifting between the trees.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cachedGeo, curveFrom, extrude, lathe, merge, paint, tube, waffleGrid } from '../../three/geometry';
import { emissive, gloss, vcolor } from '../../three/materials';
import { makeGlowPointsMaterial } from '../../three/shaders';
import { InstancedSet, scatter, type Placement } from '../decor';
import { pathXAtZ, terrainHeight } from '../../game/route';
import { TAU, mulberry32, randRange } from '../../three/util';
import { frameDt } from '../../game/actors';
import { motion } from '../../game/settings';
import { burst } from '../../three/Particles';
import { Wobbly } from '../../three/bits';
import { sfx } from '../../audio/sfx';

export const SYRUP = '#e08a1e';

/** Wafer trunk + domed waffle canopy with syrup drips, all in one mesh. */
export function waffleTreeGeometry(v: number) {
  return cachedGeo(`waffle-tree-${v}`, () => {
    const rng = mulberry32(600 + v);
    const H = 3.2 + v * 0.7;
    const R = 2.0 + v * 0.35;
    const trunk = lathe(
      [
        [0, 0],
        [0.55, 0],
        [0.42, 0.25],
        [0.36, H * 0.5],
        [0.4, H],
        [0, H + 0.05],
      ],
      20,
      16,
    );
    // rolled wafer: golden with darker spiral seams
    paint(trunk, (p) => {
      const a = Math.atan2(p.z, p.x);
      const s = (a / TAU) * 3 + p.y * 1.4;
      const f = s - Math.floor(s);
      return new THREE.Color(f < 0.12 ? '#9a5a1f' : '#e7b066');
    });
    const canopy = lathe(
      [
        [0, -0.25],
        [R * 0.6, -0.3],
        [R, -0.05],
        [R * 1.02, 0.12],
        [R * 0.85, 0.65],
        [R * 0.5, 1.05],
        [0, 1.2],
      ],
      64,
      40,
    );
    waffleGrid(canopy, 0.42, 0.07, '#f2b45a', '#c4802e');
    canopy.translate(0, H, 0);
    // butter pat on top
    const butter = new THREE.BoxGeometry(0.7, 0.18, 0.7);
    butter.translate(0, H + 1.25, 0);
    paint(butter, '#fff1a6');
    const parts: THREE.BufferGeometry[] = [trunk, canopy, butter];
    // syrup pooling on top and dripping off the rim
    const pool = lathe(
      [
        [0, 0],
        [R * 0.5, 0],
        [R * 0.55, 0.04],
        [0, 0.08],
      ],
      32,
      6,
    );
    pool.translate(0, H + 1.08, 0);
    paint(pool, SYRUP);
    parts.push(pool);
    const drips = 9 + v * 2;
    for (let i = 0; i < drips; i++) {
      const a = (i / drips) * TAU + rng() * 0.3;
      const len = 0.3 + rng() * 0.6;
      const x = Math.cos(a) * R * 1.0;
      const z = Math.sin(a) * R * 1.0;
      const y = H + 0.05;
      parts.push(
        paint(
          tube(curveFrom([[x * 0.92, y + 0.2, z * 0.92], [x, y, z], [x, y - len * 0.6, z], [x, y - len, z]]), {
            segments: 10,
            radial: 6,
            radius: (t) => 0.07 * (t > 0.78 ? 1 + Math.sin(((t - 0.78) / 0.22) * Math.PI) * 0.45 : 1) * (t > 0.95 ? 0.4 : 1),
          }),
          SYRUP,
        ),
      );
    }
    return merge(parts);
  });
}

function doorGeometry() {
  return cachedGeo('tiny-door', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.22, 0);
    s.lineTo(0.22, 0);
    s.lineTo(0.22, 0.32);
    s.absarc(0, 0.32, 0.22, 0, Math.PI, false);
    s.lineTo(-0.22, 0);
    const d = extrude(s, 0.05, 0.015, 12);
    paint(d, '#8a3f1f');
    const knob = new THREE.SphereGeometry(0.03, 8, 6);
    knob.translate(0.13, 0.25, 0.04);
    paint(knob, '#ffd43b');
    return merge([d, knob]);
  });
}

function windowGeometry() {
  return cachedGeo('tiny-window', () => {
    const g = new THREE.CircleGeometry(0.09, 16);
    return g;
  });
}

function mushroomGeometry() {
  return cachedGeo('choc-mushroom', () => {
    const stem = lathe(
      [
        [0, 0],
        [0.12, 0],
        [0.09, 0.3],
        [0.1, 0.42],
        [0, 0.42],
      ],
      14,
      8,
    );
    paint(stem, '#fff4e0');
    const cap = lathe(
      [
        [0, 0.36],
        [0.36, 0.34],
        [0.38, 0.4],
        [0.3, 0.55],
        [0.12, 0.64],
        [0, 0.66],
      ],
      20,
      10,
    );
    paint(cap, '#5b2f18');
    const dots: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const d = new THREE.SphereGeometry(0.035, 8, 6);
      d.translate(Math.cos(a) * 0.22, 0.56, Math.sin(a) * 0.22);
      paint(d, ['#ff6b8b', '#ffd43b', '#69db7c', '#4dabf7'][i % 4]);
      dots.push(d);
    }
    return merge([stem, cap, ...dots]);
  });
}

/** Syrup droplets that fall from canopy rims and splash softly. */
function SyrupDrops({ trees }: { trees: { p: THREE.Vector3; r: number; h: number }[] }) {
  const count = 26;
  const ref = useRef<THREE.InstancedMesh>(null!);
  const data = useMemo(() => {
    const rng = mulberry32(3);
    return Array.from({ length: count }, () => {
      const t = trees[Math.floor(rng() * trees.length)];
      const a = rng() * TAU;
      return { t, a, y: rng(), sp: randRange(rng, 0.5, 0.9), wait: rng() * 3 };
    });
  }, [trees]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt) * motion.scale;
    data.forEach((d, i) => {
      if (d.wait > 0) {
        d.wait -= dt;
        tmp.s.setScalar(0.0001);
      } else {
        d.y += dt * d.sp;
        if (d.y >= 1) {
          d.y = 0;
          d.wait = 1 + Math.random() * 3;
          d.a = Math.random() * TAU;
        }
        tmp.s.set(0.07, 0.1 + d.y * 0.06, 0.07);
      }
      const x = d.t.p.x + Math.cos(d.a) * d.t.r;
      const z = d.t.p.z + Math.sin(d.a) * d.t.r;
      const top = d.t.p.y + d.t.h - 0.6;
      const ground = terrainHeight(x, z);
      tmp.p.set(x, top - (top - ground) * d.y * d.y, z);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      ref.current.setMatrixAt(i, tmp.m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[cachedGeo('drop-sphere', () => new THREE.SphereGeometry(1, 10, 8)), gloss(SYRUP, 0.08, 1), count]} frustumCulled={false} raycast={() => null} />
  );
}

/** Warm fireflies drifting through the woodland. */
export function Fireflies({ count = 70, zMin = -118, zMax = -90, spread = 16, color = '#ffc94d' }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const rng = mulberry32(8);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const scale = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const z = randRange(rng, zMin, zMax);
      const x = pathXAtZ(z) + randRange(rng, -spread, spread);
      pos[i * 3] = x;
      pos[i * 3 + 1] = terrainHeight(x, z) + randRange(rng, 0.4, 3.5);
      pos[i * 3 + 2] = z;
      seed[i] = rng() * 10;
      scale[i] = randRange(rng, 0.5, 1);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('scale', new THREE.BufferAttribute(scale, 1));
    return g;
  }, [count, zMin, zMax, spread]);
  const base = useMemo(() => Float32Array.from(geo.getAttribute('position').array as Float32Array), [geo]);
  const mat = useMemo(() => makeGlowPointsMaterial(color, 26, 0.95), [color]);
  useFrame((state) => {
    const t = state.clock.elapsedTime * (0.4 + motion.scale * 0.6);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const s = i * 1.37;
      pos.setXYZ(
        i,
        base[i * 3] + Math.sin(t * 0.35 + s) * 1.2,
        base[i * 3 + 1] + Math.sin(t * 0.6 + s * 2) * 0.4,
        base[i * 3 + 2] + Math.cos(t * 0.3 + s) * 1.2,
      );
    }
    pos.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

export function Woods() {
  const trees = useMemo(
    () => [0, 1, 2].map((v) => scatter({ seed: 140 + v, count: 6, zMin: -118, zMax: -89, minLat: 4.8, maxLat: 18, scale: [0.85, 1.15], minSpacing: 5.2 })),
    [],
  );
  const flatTrees = useMemo(
    () =>
      trees.flatMap((set, v) =>
        set.map((p) => ({ p: p.pos, r: (2.0 + v * 0.35) * (p.scale as number), h: (3.2 + v * 0.7) * (p.scale as number) + 1.2 })),
      ),
    [trees],
  );
  // little lit doors at the foot of trees facing the path
  const doors = useMemo(() => {
    const out: Placement[] = [];
    const wins: Placement[] = [];
    flatTrees.forEach((t, i) => {
      if (i % 2 === 1) return;
      const px = pathXAtZ(t.p.z);
      const face = Math.atan2(px - t.p.x, 0.0001);
      const dx = Math.sin(face);
      const dz = Math.cos(face);
      const r = 0.48 * (t.r / 2.2);
      out.push({ pos: new THREE.Vector3(t.p.x + dx * r, t.p.y, t.p.z + dz * r), rotY: face, scale: 1 });
      wins.push({ pos: new THREE.Vector3(t.p.x + dx * (r + 0.06), t.p.y + 0.7, t.p.z + dz * (r + 0.06)), rotY: face, scale: 1 });
    });
    return { out, wins };
  }, [flatTrees]);
  const mushrooms = useMemo(
    () => scatter({ seed: 150, count: 40, zMin: -118, zMax: -90, minLat: 2.0, maxLat: 16, scale: [0.6, 1.4] }),
    [],
  );
  return (
    <group>
      {trees.map((items, v) => (
        <InstancedSet key={v} geometry={waffleTreeGeometry(v)} material={vcolor(0.5, 'waffle-tree')} items={items} castShadow receiveShadow />
      ))}
      <InstancedSet geometry={doorGeometry()} material={vcolor(0.5, 'tinydoor')} items={doors.out} />
      <InstancedSet geometry={windowGeometry()} material={emissive('#ffd36b', 1.6)} items={doors.wins} />
      <InstancedSet geometry={mushroomGeometry()} material={vcolor(0.45, 'mushroom')} items={mushrooms} />
      {mushrooms.slice(0, 8).map((m, i) => (
        <Wobbly
          key={i}
          position={[m.pos.x, m.pos.y, m.pos.z]}
          sound="pop"
          particles="sparkle"
          hit={0.45}
          hitOffset={[0, 0.3, 0]}
          onTap={() => {
            sfx.play('boing', 2);
            burst('sparkle', m.pos.clone().setY(m.pos.y + 0.6), { count: 8, colors: ['#ffc94d', '#fff3bf'] });
          }}
        >
          <group />
        </Wobbly>
      ))}
      <SyrupDrops trees={flatTrees} />
      <Fireflies />
    </group>
  );
}
