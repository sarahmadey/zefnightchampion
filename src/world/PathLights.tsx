// Path lights: one candy lamp per stop. A sleeping light keeps its petals
// closed over a dim bulb; when a dry night wakes it, the petals bloom open
// and the bulb glows. All 16 lamps are drawn with a handful of instanced meshes.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { STOPS, regionAtZ, type RegionId } from '../game/route';
import { STOP_DEFS, localToWorld } from './stopDefs';
import { cachedGeo, cuppedPetal, pipedSwirl } from '../three/geometry';
import { matte, pattern } from '../three/materials';
import { makeGlowPointsMaterial } from '../three/shaders';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { bus } from '../game/bus';
import { frameDt } from '../game/actors';
import { clamp, ease } from '../three/util';

const PETALS = 5;
const POST_H = 2.05;

const PETAL_COLOR: Record<RegionId, string> = {
  home: '#ff9fc4',
  garden: '#ffffff',
  meadow: '#ffc9e6',
  river: '#ffe14d',
  woods: '#f0a35a',
  mountain: '#c6a2ff',
};

export function lightWorldPos(i: number, out = new THREE.Vector3()) {
  const d = STOP_DEFS[i];
  return localToWorld(i, [d.light[0], 0, d.light[1]], out);
}

export function PathLights({ lit, onTap }: { lit: number; onTap: (i: number, awake: boolean, e: ThreeEvent<PointerEvent>) => void }) {
  const count = STOPS + 1;
  const posts = useRef<THREE.InstancedMesh>(null!);
  const petals = useRef<THREE.InstancedMesh>(null!);
  const bulbs = useRef<THREE.InstancedMesh>(null!);
  const bases = useRef<THREE.InstancedMesh>(null!);
  const glowGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(Array.from({ length: count }, (_, i) => i * 1.37)), 1));
    g.setAttribute('scale', new THREE.BufferAttribute(new Float32Array(count), 1));
    return g;
  }, [count]);
  const glowMat = useMemo(() => makeGlowPointsMaterial('#ffd77a', 46, 0.9), []);

  const lamps = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const p = lightWorldPos(i);
        return { pos: p, region: regionAtZ(p.z) };
      }),
    [count],
  );

  const st = useMemo(
    () => ({
      open: new Float32Array(count),
      flash: new Float32Array(count),
      wobble: new Float32Array(count),
      wobbleV: new Float32Array(count),
      waking: new Float32Array(count).fill(-1),
    }),
    [count],
  );

  // initial open state follows `lit` without animation
  useEffect(() => {
    for (let i = 0; i < count; i++) {
      if (st.waking[i] < 0) st.open[i] = i <= lit ? 1 : 0;
    }
  }, [lit, count, st]);

  useEffect(() => {
    const off = bus.on('lightWake', (i: number) => {
      st.waking[i] = 0;
      st.open[i] = 0;
      sfx.play('wake');
    });
    const off2 = bus.on('sleepyLight', (i: number) => {
      if (i < 0 || i >= count) return;
      st.wobbleV[i] += 7;
      sfx.play('yawn');
      const p = lamps[i].pos.clone();
      p.y += POST_H + 0.3;
      burst('puff', p, { count: 3, size: 0.18, up: 0.5 });
    });
    return () => {
      off();
      off2();
    };
  }, [st, count, lamps]);

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), c: new THREE.Color() }),
    [],
  );

  useEffect(() => {
    lamps.forEach((l, i) => {
      tmp.m.makeTranslation(l.pos.x, l.pos.y, l.pos.z);
      posts.current.setMatrixAt(i, tmp.m);
      bases.current.setMatrixAt(i, tmp.m);
      bases.current.setColorAt(i, tmp.c.set(PETAL_COLOR[l.region]));
    });
    posts.current.instanceMatrix.needsUpdate = true;
    bases.current.instanceMatrix.needsUpdate = true;
    if (bases.current.instanceColor) bases.current.instanceColor.needsUpdate = true;
    posts.current.computeBoundingSphere();
    bases.current.computeBoundingSphere();
  }, [lamps, tmp]);

  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const time = state.clock.elapsedTime;
    const gp = glowGeo.getAttribute('position') as THREE.BufferAttribute;
    const gs = glowGeo.getAttribute('scale') as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const l = lamps[i];
      // wake animation
      if (st.waking[i] >= 0) {
        st.waking[i] += dt;
        const u = clamp(st.waking[i] / 1.3, 0, 1);
        st.open[i] = ease.outBack(u);
        if (st.waking[i] > 0.35 && st.flash[i] === 0) {
          st.flash[i] = 1;
          const p = l.pos.clone();
          p.y += POST_H + 0.2;
          burst('sparkle', p, { count: 28, speed: 3, up: 2.5, size: 0.18, life: 1.4 });
        }
        if (u >= 1) st.waking[i] = -1;
      }
      st.flash[i] = Math.max(0, st.flash[i] - dt * 0.6);
      // springy wobble for sleepy taps
      const f = -60 * st.wobble[i] - 6 * st.wobbleV[i];
      st.wobbleV[i] += f * dt;
      st.wobble[i] += st.wobbleV[i] * dt;

      const open = clamp(st.open[i], -0.2, 1.3);
      const sway = Math.sin(time * 1.3 + i) * 0.03 + st.wobble[i] * 0.06;
      const top = new THREE.Vector3(l.pos.x + sway, l.pos.y + POST_H, l.pos.z);
      for (let k = 0; k < PETALS; k++) {
        const a = (k / PETALS) * Math.PI * 2 + i;
        // closed: petals point up hugging the bulb; open: they fan outward
        const tilt = THREE.MathUtils.lerp(0.18, 1.35, open);
        tmp.e.set(-tilt, a, 0, 'YXZ');
        tmp.q.setFromEuler(tmp.e);
        tmp.s.setScalar(1);
        tmp.p.copy(top);
        tmp.m.compose(tmp.p, tmp.q, tmp.s);
        petals.current.setMatrixAt(i * PETALS + k, tmp.m);
        petals.current.setColorAt(i * PETALS + k, tmp.c.set(PETAL_COLOR[l.region]));
      }
      const glow = clamp(open, 0, 1);
      const pulse = 1 + Math.sin(time * 2.5 + i) * 0.06;
      tmp.q.identity();
      tmp.s.setScalar((0.75 + glow * 0.35) * (1 + st.flash[i] * 0.5));
      tmp.p.set(top.x, top.y + 0.2, top.z);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      bulbs.current.setMatrixAt(i, tmp.m);
      tmp.c.set('#7a6a8a').lerp(new THREE.Color('#ffe9a0'), glow);
      bulbs.current.setColorAt(i, tmp.c);
      gp.setXYZ(i, top.x, top.y + 0.2, top.z);
      gs.setX(i, glow * pulse * (1 + st.flash[i] * 2.2));
    }
    petals.current.instanceMatrix.needsUpdate = true;
    if (petals.current.instanceColor) petals.current.instanceColor.needsUpdate = true;
    bulbs.current.instanceMatrix.needsUpdate = true;
    if (bulbs.current.instanceColor) bulbs.current.instanceColor.needsUpdate = true;
    gp.needsUpdate = true;
    gs.needsUpdate = true;
    petals.current.computeBoundingSphere();
    bulbs.current.computeBoundingSphere();
  });

  const petalGeo = useMemo(
    () =>
      cachedGeo('lamp-petal', () => {
        const g = cuppedPetal(0.42, 0.17, 0.08, 0.02, 5);
        // pivot at the base, petal grows along +y then bends outward when tilted
        return g;
      }),
    [],
  );
  const postMat = useMemo(() => pattern({ a: '#ffffff', b: '#ff4f7b', mode: 'helix', freq: 1, twist: 7 }), []);
  const bulbMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), []);

  return (
    <group>
      <instancedMesh ref={posts} args={[cachedGeo('lamp-post', () => new THREE.CylinderGeometry(0.07, 0.08, POST_H, 12).translate(0, POST_H / 2, 0)), postMat, count]} castShadow />
      <instancedMesh ref={bases} args={[cachedGeo('lamp-base', () => pipedSwirl({ radius: 0.32, height: 0.3, thickness: 0.11, turns: 1.6 })), matte('#ffffff', 0.5), count]} />
      <instancedMesh ref={petals} args={[petalGeo, matte('#ffffff', 0.45), count * PETALS]} frustumCulled={false} />
      <instancedMesh ref={bulbs} args={[cachedGeo('lamp-bulb', () => new THREE.SphereGeometry(0.17, 16, 12)), bulbMat, count]} frustumCulled={false} />
      <points geometry={glowGeo} material={glowMat} frustumCulled={false} />
      {lamps.map((l, i) => (
        <mesh
          key={i}
          visible={false}
          position={[l.pos.x, l.pos.y + POST_H * 0.6, l.pos.z]}
          onPointerDown={(e) => {
            e.stopPropagation();
            onTap(i, i <= lit, e);
          }}
        >
          <cylinderGeometry args={[0.55, 0.55, POST_H * 1.4, 8]} />
        </mesh>
      ))}
    </group>
  );
}
