// Marshmallow Cloud Meadow: springy cloud platforms (some floating and
// bobbing), pink cotton-candy trees, drifting soap bubbles and peppermint
// windmills. Everything leans and drifts when the windmill makes a breeze.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cachedGeo, lathe, merge, paint, puckGeometry, puffGeometry, xform } from '../../three/geometry';
import { marshmallow, marshmallowVC, matte, pattern } from '../../three/materials';
import { makeBubbleMaterial } from '../../three/shaders';
import { InstancedSet, scatter, swaying, windUniforms, groundAt } from '../decor';
import { stopWorldPoints } from '../stopDefs';
import { TAU, mulberry32, randRange } from '../../three/util';
import { frameDt } from '../../game/actors';
import { motion } from '../../game/settings';
import { Wobbly } from '../../three/bits';

function cloudPlatformGeometry(v: number) {
  return cachedGeo(`meadow-cloud-${v}`, () => {
    const g = puffGeometry(300 + v * 11, 8, 1.3, 3);
    const top = new THREE.Color('#ffffff');
    const under = new THREE.Color(v % 2 ? '#ffd3ea' : '#e9d9ff');
    paint(g, (p) => new THREE.Color().copy(under).lerp(top, THREE.MathUtils.smoothstep(p.y, -0.35, 0.4)));
    return g;
  });
}

export function cottonTreeGeometry(v: number) {
  return cachedGeo(`cotton-tree-${v}`, () => {
    const colors = [
      ['#ff9fd0', '#ffd6ec'],
      ['#d9a8ff', '#f3e3ff'],
      ['#ffb3c7', '#fff0f5'],
    ][v % 3];
    const canopy = puffGeometry(400 + v * 5, 7, 1.0, 3);
    canopy.scale(1.4, 1.2, 1.4);
    canopy.translate(0, 3.0, 0);
    paint(canopy, (p) => new THREE.Color(colors[0]).lerp(new THREE.Color(colors[1]), THREE.MathUtils.smoothstep(p.y, 2.4, 3.9)));
    const trunk = lathe(
      [
        [0, 0],
        [0.18, 0],
        [0.13, 0.4],
        [0.1, 1.6],
        [0.12, 2.4],
        [0, 2.5],
      ],
      12,
      10,
    );
    paint(trunk, '#fff6fb');
    return merge([canopy, trunk]);
  });
}

function windmillGeometry() {
  return cachedGeo('meadow-windmill-tower', () => {
    const tower = lathe(
      [
        [0, 0],
        [0.9, 0],
        [0.75, 1.5],
        [0.55, 3.2],
        [0.62, 3.25],
        [0.62, 3.45],
        [0, 3.5],
      ],
      24,
      14,
    );
    return tower;
  });
}

export function peppermintSailGeometry() {
  return cachedGeo('peppermint-sail', () => {
    const g = puckGeometry(0.62, 0.12, 48, 0.4);
    g.rotateX(Math.PI / 2);
    return g;
  });
}

function DecorWindmill({ position, scale = 1, phase = 0 }: { position: THREE.Vector3; scale?: number; phase?: number }) {
  const rotor = useRef<THREE.Group>(null!);
  const st = useMemo(() => ({ a: phase }), [phase]);
  const sailMat = useMemo(() => pattern({ a: '#ffffff', b: '#e8253f', mode: 'spiral', freq: 6, twist: 0, duty: 0.5 }), []);
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    st.a += dt * (0.6 + windUniforms.breeze.value * 6) * motion.scale;
    rotor.current.rotation.z = st.a;
  });
  return (
    <group position={position} scale={scale}>
      <mesh geometry={windmillGeometry()} material={pattern({ a: '#ffffff', b: '#ff8fb3', mode: 'helix', freq: 0, twist: 3, roughness: 0.6, clearcoat: 0.2 })} castShadow />
      <mesh material={matte('#ff6f9a', 0.6)} position={[0, 3.75, 0]}>
        <coneGeometry args={[0.8, 0.9, 24]} />
      </mesh>
      <group ref={rotor} position={[0, 3.1, 0.75]}>
        {[0, 1, 2, 3].map((k) => (
          <group key={k} rotation={[0, 0, (k / 4) * TAU]}>
            <mesh material={matte('#fff6e8', 0.6)} position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 1.0, 6]} />
            </mesh>
            <mesh geometry={peppermintSailGeometry()} material={sailMat} position={[0, 1.1, 0]} />
          </group>
        ))}
        <mesh material={matte('#ff6f9a', 0.5)}>
          <sphereGeometry args={[0.14, 12, 8]} />
        </mesh>
      </group>
    </group>
  );
}

/** Cloud platforms that float and bob gently. */
function FloatingClouds() {
  const items = useMemo(() => {
    const rng = mulberry32(77);
    const out: { base: THREE.Vector3; s: number; v: number; ph: number }[] = [];
    const spots = scatter({ seed: 61, count: 14, zMin: -58, zMax: -31, minLat: 4.5, maxLat: 18, scale: [1.2, 2.4], minSpacing: 3.6 });
    spots.forEach((p, i) => {
      const lift = i % 3 === 0 ? 0.2 : randRange(rng, 1.4, 5.5);
      out.push({ base: p.pos.clone().setY(p.pos.y + lift), s: p.scale as number, v: i % 3, ph: rng() * TAU });
    });
    return out;
  }, []);
  const refs = [useRef<THREE.InstancedMesh>(null!), useRef<THREE.InstancedMesh>(null!), useRef<THREE.InstancedMesh>(null!)];
  const groups = useMemo(() => [0, 1, 2].map((v) => items.filter((it) => it.v === v)), [items]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime * motion.scale;
    groups.forEach((set, v) => {
      const mesh = refs[v].current;
      if (!mesh) return;
      set.forEach((c, i) => {
        tmp.p.copy(c.base);
        tmp.p.y += Math.sin(t * 0.7 + c.ph) * 0.25;
        tmp.p.x += windUniforms.breeze.value * 0.6 * Math.sin(t + c.ph);
        tmp.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.ph + Math.sin(t * 0.2 + c.ph) * 0.1);
        const squish = 1 + Math.sin(t * 1.4 + c.ph) * 0.03;
        tmp.s.set(c.s * squish, c.s / squish, c.s * squish);
        tmp.m.compose(tmp.p, tmp.q, tmp.s);
        mesh.setMatrixAt(i, tmp.m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  });
  useEffect(() => {
    refs.forEach((r) => r.current?.computeBoundingSphere());
  });
  return (
    <group>
      {groups.map((set, v) => (
        <instancedMesh key={v} ref={refs[v]} args={[cloudPlatformGeometry(v), marshmallowVC(), Math.max(1, set.length)]} frustumCulled={false} raycast={() => null} />
      ))}
    </group>
  );
}

/** Soap bubbles drifting upward and looping, pushed along by the breeze. */
function DriftingBubbles() {
  const count = 36;
  const ref = useRef<THREE.InstancedMesh>(null!);
  const mat = useMemo(() => makeBubbleMaterial('#ffffff', 1), []);
  const data = useMemo(() => {
    const rng = mulberry32(5);
    return Array.from({ length: count }, () => ({
      x: randRange(rng, -16, 16),
      z: randRange(rng, -58, -31),
      y: randRange(rng, 0, 8),
      r: randRange(rng, 0.15, 0.45),
      sp: randRange(rng, 0.25, 0.6),
      ph: rng() * TAU,
    }));
  }, []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const t = state.clock.elapsedTime;
    data.forEach((b, i) => {
      b.y += b.sp * dt * motion.scale;
      b.x += windUniforms.breeze.value * dt * 2.5;
      if (b.y > 9) {
        b.y = 0;
        b.x = randRange(Math.random, -16, 16);
      }
      if (b.x > 20) b.x = -20;
      tmp.p.set(b.x + Math.sin(t * 0.8 + b.ph) * 0.4, 0.8 + b.y, b.z);
      tmp.s.setScalar(b.r * (1 + Math.sin(t * 3 + b.ph) * 0.04));
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      ref.current.setMatrixAt(i, tmp.m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[cachedGeo('bubble-sphere', () => new THREE.SphereGeometry(1, 14, 10)), mat, count]} frustumCulled={false} raycast={() => null} renderOrder={2} />
  );
}

export function Meadow() {
  useEffect(() => {
    windUniforms.breezeCenter.value.copy(stopWorldPoints(6).object);
  }, []);
  const trees = useMemo(
    () => [0, 1, 2].map((v) => scatter({ seed: 80 + v, count: 6, zMin: -58, zMax: -31, minLat: 5, maxLat: 17, scale: [0.85, 1.3], minSpacing: 4.2 })),
    [],
  );
  const tufts = useMemo(
    () => scatter({ seed: 90, count: 50, zMin: -59, zMax: -30, minLat: 1.9, maxLat: 14, scale: [0.25, 0.55] }),
    [],
  );
  const treeMat = useMemo(() => {
    const m = swaying(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#fff0f8'), sheenRoughness: 0.5 }), 0.012, 'cotton');
    return m;
  }, []);
  const windmills = useMemo(
    () => [
      { p: groundAt(-13, -41), s: 0.9, ph: 0 },
      { p: groundAt(14, -50), s: 1.1, ph: 1.3 },
    ],
    [],
  );
  return (
    <group>
      {trees.map((items, v) => (
        <InstancedSet key={v} geometry={cottonTreeGeometry(v)} material={treeMat} items={items} maxDist={90} />
      ))}
      <InstancedSet geometry={cachedGeo('fluff-tuft', () => xform(puffGeometry(17, 4, 0.5, 1), { pos: [0, 0.15, 0] }))} material={marshmallow('#ffffff')} items={tufts} maxDist={45} />
      <FloatingClouds />
      <DriftingBubbles />
      {windmills.map((w, i) => (
        <Wobbly key={i} position={[w.p.x, w.p.y, w.p.z]} sound="whoosh" particles="puff" strength={0.3} hit={2.2} hitOffset={[0, 2.5, 0]}>
          <DecorWindmill position={new THREE.Vector3()} scale={w.s} phase={w.ph} />
        </Wobbly>
      ))}
    </group>
  );
}
