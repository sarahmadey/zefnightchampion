// Lemonade River: moving fizzy golden water, rising fizz, lemon-slice boats
// bobbing downstream, a woven red licorice bridge where the path crosses,
// candy reeds and lemon-drop bushes along the sugar-sand banks.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  cachedGeo,
  curveFrom,
  flowRibbon,
  gumdropGeometry,
  lathe,
  lemonSliceGeometry,
  merge,
  paint,
  twistRope,
} from '../../three/geometry';
import { jelly, vcolor, vcolorGloss } from '../../three/materials';
import { makeBubbleMaterial, makeFlowMaterial } from '../../three/shaders';
import { InstancedSet, scatter } from '../decor';
import { RIVER_LENGTH, ROUTE_LENGTH, WATER_Y, pointAt, rightAt, riverCurve, riverHalfWidth } from '../../game/route';
import { BRIDGE_Z } from '../Path';
import { TAU, mulberry32, randRange } from '../../three/util';
import { frameDt } from '../../game/actors';
import { motion } from '../../game/settings';
import { Wobbly } from '../../three/bits';

export function waterMaterial() {
  return makeFlowMaterial({
    deep: '#f2a900',
    shallow: '#ffe066',
    foam: '#fffbe0',
    speed: 0.6,
    sparkle: 1.0,
    gloss: 1.4,
    scale: 0.35,
    fizz: 0.55,
  });
}

function Water() {
  const geo = useMemo(
    () =>
      cachedGeo('river-water', () =>
        flowRibbon(riverCurve, (t) => riverHalfWidth(t * RIVER_LENGTH) + 1.0, () => WATER_Y, 260, 10),
      ),
    [],
  );
  const mat = useMemo(() => waterMaterial(), []);
  return <mesh geometry={geo} material={mat} receiveShadow />;
}

/** Fizz bubbles rising from the lemonade and popping at the surface. */
function Fizz() {
  const count = 70;
  const ref = useRef<THREE.InstancedMesh>(null!);
  const mat = useMemo(() => makeBubbleMaterial('#fff7cc', 1.3), []);
  const data = useMemo(() => {
    const rng = mulberry32(14);
    return Array.from({ length: count }, () => {
      const s = rng() * RIVER_LENGTH;
      const p = riverCurve.getPointAt(s / RIVER_LENGTH);
      const t = riverCurve.getTangentAt(s / RIVER_LENGTH);
      const off = (rng() * 2 - 1) * riverHalfWidth(s) * 0.8;
      return { x: p.x - t.z * off, z: p.z + t.x * off, y: rng() * 0.6, sp: randRange(rng, 0.2, 0.5), r: randRange(rng, 0.05, 0.13), ph: rng() * TAU };
    });
  }, []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const t = state.clock.elapsedTime;
    data.forEach((b, i) => {
      b.y += b.sp * dt * motion.scale;
      if (b.y > 0.7) b.y = 0;
      const k = b.y / 0.7;
      tmp.p.set(b.x + Math.sin(t * 2 + b.ph) * 0.05, WATER_Y + b.y * 0.6, b.z);
      tmp.s.setScalar(b.r * (k < 0.85 ? 1 : 1 - (k - 0.85) / 0.15));
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      ref.current.setMatrixAt(i, tmp.m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[cachedGeo('bubble-sphere', () => new THREE.SphereGeometry(1, 14, 10)), mat, count]} frustumCulled={false} raycast={() => null} />;
}

export function lemonBoatGeometry() {
  return cachedGeo('lemon-boat', () => {
    const parts: THREE.BufferGeometry[] = [];
    // hull: half a lemon rind, like a little canoe
    const hull = lathe(
      [
        [0, -0.32],
        [0.35, -0.28],
        [0.55, -0.12],
        [0.62, 0.05],
        [0.6, 0.1],
        [0.0, 0.1],
      ],
      28,
      16,
    );
    hull.scale(1.5, 1, 0.95);
    paint(hull, (p) => (p.y > 0.08 ? new THREE.Color('#fff6c9') : new THREE.Color('#ffd21f')));
    parts.push(hull);
    // mast and lemon-slice sail
    const mast = new THREE.CylinderGeometry(0.03, 0.035, 1.1, 8);
    mast.translate(0, 0.62, 0);
    paint(mast, '#fff2d6');
    parts.push(mast);
    const sail = lemonSliceGeometry(0.42, 0.06, 9);
    sail.rotateX(Math.PI / 2);
    sail.translate(0, 0.82, 0.04);
    parts.push(sail);
    return merge(parts);
  });
}

/** Little lemon boats that drift down the river and loop around. */
function DriftingBoats() {
  const boats = useMemo(() => [0.08, 0.36, 0.7, 0.9].map((u, i) => ({ u, ph: i * 1.7, lane: (i % 2 ? 1 : -1) * 0.35 })), []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const t = state.clock.elapsedTime;
    boats.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      b.u = (b.u + (dt * 0.6 * motion.scale) / RIVER_LENGTH) % 1;
      const p = riverCurve.getPointAt(b.u);
      const tan = riverCurve.getTangentAt(b.u);
      const half = riverHalfWidth(b.u * RIVER_LENGTH);
      g.position.set(p.x - tan.z * b.lane * half, WATER_Y + 0.06 + Math.sin(t * 1.8 + b.ph) * 0.04, p.z + tan.x * b.lane * half);
      g.rotation.set(Math.sin(t * 1.3 + b.ph) * 0.06, Math.atan2(tan.x, tan.z), Math.sin(t * 1.1 + b.ph) * 0.08);
      // hide boats where the river runs under the bridge
      g.visible = !(p.z < BRIDGE_Z[1] + 1 && p.z > BRIDGE_Z[0] - 1 && Math.abs(p.x) < 4);
    });
  });
  return (
    <group>
      {boats.map((_, i) => (
        <group key={i} ref={(g) => (refs.current[i] = g)} scale={0.8}>
          <mesh geometry={lemonBoatGeometry()} material={vcolorGloss(0.3, 0.6)} castShadow />
        </group>
      ))}
    </group>
  );
}

/** The woven red licorice bridge carrying the path over the river. */
function LicoriceBridge() {
  const geos = useMemo(
    () =>
      cachedGeo('licorice-bridge', () => {
        const parts: THREE.BufferGeometry[] = [];
        // find the route span over the water
        const span: number[] = [];
        const p = new THREE.Vector3();
        for (let s = 0; s <= ROUTE_LENGTH; s += 0.1) {
          pointAt(s, p);
          if (p.z < BRIDGE_Z[1] + 0.4 && p.z > BRIDGE_Z[0] - 0.4) span.push(s);
        }
        const s0 = span[0];
        const s1 = span[span.length - 1];
        const r = new THREE.Vector3();
        // deck: licorice planks
        for (let s = s0; s <= s1; s += 0.32) {
          pointAt(s, p);
          rightAt(s, r);
          const plank = new THREE.CapsuleGeometry(0.11, 2.3, 4, 10);
          plank.rotateZ(Math.PI / 2);
          plank.rotateY(-Math.atan2(r.z, r.x));
          plank.translate(p.x, p.y + 0.02, p.z);
          paint(plank, (Math.round(s / 0.32) % 2 === 0 ? '#d4142a' : '#a50e22'));
          parts.push(plank);
        }
        // rails: twisted ropes on posts, plus woven arches underneath
        for (const side of [-1, 1]) {
          const railPts: [number, number, number][] = [];
          const archPts: [number, number, number][] = [];
          for (let s = s0 - 0.6; s <= s1 + 0.61; s += 0.6) {
            pointAt(s, p);
            rightAt(s, r);
            railPts.push([p.x + r.x * side * 1.25, p.y + 0.9, p.z + r.z * side * 1.25]);
            archPts.push([p.x + r.x * side * 1.2, p.y - 0.25, p.z + r.z * side * 1.2]);
          }
          const rail = twistRope(curveFrom(railPts), 0.08, 18, 60);
          paint(rail, '#e3182f');
          parts.push(rail);
          const rail2 = twistRope(curveFrom(railPts.map(([x, y, z]) => [x, y - 0.35, z] as [number, number, number])), 0.06, 14, 50);
          paint(rail2, '#c3112a');
          parts.push(rail2);
          const arch = twistRope(curveFrom(archPts), 0.13, 12, 50);
          paint(arch, '#b50f26');
          parts.push(arch);
          for (let s = s0 - 0.6; s <= s1 + 0.61; s += 1.2) {
            pointAt(s, p);
            rightAt(s, r);
            const post = new THREE.CylinderGeometry(0.07, 0.08, 1.2, 10);
            post.translate(p.x + r.x * side * 1.25, p.y + 0.35, p.z + r.z * side * 1.25);
            paint(post, '#2b1a1f');
            parts.push(post);
            const cap = gumdropGeometry(14);
            cap.scale(0.22, 0.22, 0.22);
            cap.translate(p.x + r.x * side * 1.25, p.y + 0.95, p.z + r.z * side * 1.25);
            paint(cap, side > 0 ? '#ffd43b' : '#ff6b8b');
            parts.push(cap);
          }
        }
        return merge(parts);
      }),
    [],
  );
  return <mesh geometry={geos} material={vcolorGloss(0.3, 0.5)} castShadow receiveShadow />;
}

function reedGeometry() {
  return cachedGeo('candy-reed', () => {
    const stick = new THREE.CylinderGeometry(0.04, 0.05, 1.4, 8);
    stick.translate(0, 0.7, 0);
    const top = gumdropGeometry(10, 8);
    top.scale(0.18, 0.28, 0.18);
    top.translate(0, 1.38, 0);
    paint(stick, (p) => (Math.floor(p.y * 6) % 2 === 0 ? new THREE.Color('#ffffff') : new THREE.Color('#ffd21f')));
    paint(top, '#ff9f1c');
    return merge([stick, top]);
  });
}

export function River() {
  const reeds = useMemo(
    () => scatter({ seed: 120, count: 46, zMin: -100, zMax: -58, minLat: 2.4, maxLat: 22, scale: [0.7, 1.25], avoidWater: true, tilt: 0.12 }),
    [],
  );
  const bushes = useMemo(
    () => scatter({ seed: 121, count: 20, zMin: -92, zMax: -60, minLat: 3.5, maxLat: 18, scale: [0.6, 1.3], colors: ['#ffe14d', '#ffd21f', '#fff3a0'] }),
    [],
  );
  const pads = useMemo(() => {
    const rng = mulberry32(31);
    return Array.from({ length: 9 }, (_, i) => {
      const u = 0.42 + i * 0.045 + rng() * 0.02;
      const p = riverCurve.getPointAt(Math.min(0.99, u));
      const tan = riverCurve.getTangentAt(Math.min(0.99, u));
      const off = (rng() * 2 - 1) * riverHalfWidth(u * RIVER_LENGTH) * 0.75;
      return { pos: new THREE.Vector3(p.x - tan.z * off, WATER_Y + 0.03, p.z + tan.x * off), rotY: rng() * TAU, scale: randRange(rng, 0.5, 0.85) };
    });
  }, []);
  return (
    <group>
      <Water />
      <Fizz />
      <DriftingBoats />
      <LicoriceBridge />
      <InstancedSet geometry={reedGeometry()} material={vcolor(0.4, 'reed')} items={reeds} maxDist={50} />
      {['#ffe14d', '#ffd21f', '#fff3a0'].map((c) => (
        <InstancedSet
          key={c}
          geometry={gumdropGeometry()}
          material={jelly(c, 0.9)}
          items={bushes.filter((b) => b.color === c).map((b) => ({ ...b, color: undefined }))}
          maxDist={70}
        />
      ))}
      <InstancedSet geometry={cachedGeo('lemon-pad', () => lemonSliceGeometry(0.6, 0.08, 10, 40, 12))} material={vcolorGloss(0.35, 0.6)} items={pads} maxDist={60} />
      {pads.slice(0, 3).map((p, i) => (
        <Wobbly key={i} position={[p.pos.x, p.pos.y, p.pos.z]} sound="bloop" particles="bubble" hit={0.7} hitOffset={[0, 0.1, 0]}>
          <group />
        </Wobbly>
      ))}
    </group>
  );
}
