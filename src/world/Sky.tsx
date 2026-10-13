// Warm cinematic sky: gradient dome with a low golden sun, drifting
// marshmallow clouds, layered distant hills and a soft rainbow.

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeSkyMaterial } from '../three/shaders';
import { cachedGeo, lathe, lumpy, puffGeometry } from '../three/geometry';
import { marshmallowVC, matte } from '../three/materials';
import { TAU, mulberry32, randRange } from '../three/util';
import { motion } from '../game/settings';

export const SKY = {
  zenith: '#7db5f5',
  mid: '#b9d6ff',
  horizon: '#ffd8c2',
  ground: '#f3c1d6',
  sun: '#ffe2a8',
  fog: '#ffd9c8',
};

export const SUN_DIR = new THREE.Vector3(0.55, 0.32, -0.75).normalize();

export function SkyDome() {
  const mat = useMemo(
    () =>
      makeSkyMaterial({
        zenith: SKY.zenith,
        mid: SKY.mid,
        horizon: SKY.horizon,
        ground: SKY.ground,
        sun: SKY.sun,
        sunDir: SUN_DIR,
      }),
    [],
  );
  const ref = useRef<THREE.Mesh>(null!);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    ref.current.position.copy(camera.position);
  });
  return (
    <mesh ref={ref} material={mat} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[480, 32, 20]} />
    </mesh>
  );
}

function cloudGeo(i: number) {
  return cachedGeo(`cloud-${i}`, () => {
    const g = puffGeometry(100 + i * 7, 9, 1.6, 2);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const top = new THREE.Color('#ffffff');
    const under = new THREE.Color('#ffd1e3');
    const c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k);
      c.copy(under).lerp(top, THREE.MathUtils.smoothstep(y, -0.3, 0.45));
      col[k * 3] = c.r;
      col[k * 3 + 1] = c.g;
      col[k * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
}

/** Big soft clouds drifting slowly across the sky (instanced, three shapes). */
export function Clouds() {
  const refs = [useRef<THREE.InstancedMesh>(null!), useRef<THREE.InstancedMesh>(null!), useRef<THREE.InstancedMesh>(null!)];
  const data = useMemo(() => {
    const rng = mulberry32(42);
    return [0, 1, 2].map(() =>
      Array.from({ length: 7 }, () => ({
        x: randRange(rng, -160, 160),
        y: randRange(rng, 26, 62),
        z: randRange(rng, -260, 60),
        s: randRange(rng, 6, 13),
        speed: randRange(rng, 0.4, 1.1),
        rot: randRange(rng, 0, TAU),
      })),
    );
  }, []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  useLayoutEffect(() => {
    refs.forEach((r) => r.current.computeBoundingSphere());
  });
  useFrame((state) => {
    const t = state.clock.elapsedTime * motion.scale;
    data.forEach((set, k) => {
      const mesh = refs[k].current;
      set.forEach((c, i) => {
        let x = c.x + t * c.speed;
        x = ((x + 200) % 400) - 200;
        p.set(x, c.y + Math.sin(t * 0.1 + i) * 0.8, c.z);
        q.setFromAxisAngle(up, c.rot);
        sc.set(c.s * 1.6, c.s, c.s);
        m.compose(p, q, sc);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  });
  return (
    <group>
      {[0, 1, 2].map((k) => (
        <instancedMesh
          key={k}
          ref={refs[k]}
          args={[cloudGeo(k), marshmallowVC(), 7]}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

function hillGeo(i: number) {
  return cachedGeo(`farhill-${i}`, () => {
    const g = lathe(
      [
        [0, 0],
        [1, 0],
        [0.92, 0.22],
        [0.7, 0.55],
        [0.42, 0.85],
        [0.15, 1],
        [0, 1.02],
      ],
      20,
      14,
    );
    return lumpy(g, 0.05, 1.3, i);
  });
}

/** Rings of soft candy hills far away for depth and parallax. */
export function FarHills() {
  const hills = useMemo(() => {
    const rng = mulberry32(9);
    const out: { pos: [number, number, number]; scale: [number, number, number]; color: string; g: number }[] = [];
    const colors = ['#e7c3f2', '#f6c6dc', '#c9c7f5', '#f9d3c3', '#d8bff0'];
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * TAU + randRange(rng, -0.05, 0.05);
      const r = randRange(rng, 175, 235);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 1.1 - 80;
      const w = randRange(rng, 28, 55);
      const h = randRange(rng, 16, 44);
      out.push({ pos: [x, -4, z], scale: [w, h, w], color: colors[i % colors.length], g: i % 4 });
    }
    // a tall gumdrop summit range behind the castle
    for (let i = 0; i < 5; i++) {
      out.push({
        pos: [-60 + i * 30 + randRange(rng, -6, 6), 0, -240 - randRange(rng, 0, 20)],
        scale: [30, 46 + randRange(rng, 0, 24), 30],
        color: ['#d6b0f5', '#f7b8d6', '#c4c0ff'][i % 3],
        g: (i + 1) % 4,
      });
    }
    return out;
  }, []);
  return (
    <group>
      {hills.map((h, i) => (
        <mesh key={i} geometry={hillGeo(h.g)} material={matte(h.color, 0.95)} position={h.pos} scale={h.scale} />
      ))}
    </group>
  );
}

export function Rainbow() {
  const geo = useMemo(
    () =>
      cachedGeo('rainbow', () => {
        const g = new THREE.TorusGeometry(70, 4.2, 12, 80, Math.PI);
        const pos = g.getAttribute('position') as THREE.BufferAttribute;
        const col = new Float32Array(pos.count * 3);
        const bands = ['#ff6b81', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc'].map((h) => new THREE.Color(h));
        const c = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          const r = Math.hypot(x, y);
          const t = THREE.MathUtils.clamp((r - 65.8) / 8.4, 0, 0.999);
          const f = t * (bands.length - 1);
          const k = Math.floor(f);
          c.copy(bands[k]).lerp(bands[Math.min(bands.length - 1, k + 1)], f - k);
          col[i * 3] = c.r;
          col[i * 3 + 1] = c.g;
          col[i * 3 + 2] = c.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.scale(1, 1, 0.15);
        return g;
      }),
    [],
  );
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  return <mesh geometry={geo} material={mat} position={[30, -6, -290]} rotation={[0, 0.25, 0]} />;
}
