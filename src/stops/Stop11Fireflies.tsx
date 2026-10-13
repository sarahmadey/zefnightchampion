// Stop 11 — Trace a path to guide syrup-coloured fireflies through the trees.
// Drawing on the mossy clearing leaves a glowing syrup trail; the fireflies
// follow it in a little conga line, lighting the mushroom lamps they pass,
// and swirl into a heart at the end. Light every lamp and the jar glows.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { StopFrame, useDrag, useStop } from './common';
import { STOP_DEFS, localToWorld } from '../world/stopDefs';
import { cachedGeo, lathe, paint, merge } from '../three/geometry';
import { jelly, matte, vcolor } from '../three/materials';
import { makeGlowPointsMaterial } from '../three/shaders';
import { Glow, HintHand } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pipReact, zef, zefPlay } from '../game/actors';
import { stopFrame } from '../game/route';
import { TAU, clamp } from '../three/util';

const ID = 11;
const FLIES = 10;
const MAX_TRAIL = 80;
const R = 3.1;

function lampGeometry() {
  return cachedGeo('mushroom-lamp', () => {
    const stem = lathe(
      [
        [0, 0],
        [0.1, 0],
        [0.07, 0.35],
        [0.08, 0.45],
        [0, 0.45],
      ],
      12,
      8,
    );
    return paint(stem, '#fff4e0');
  });
}

function capGeometry() {
  return cachedGeo('mushroom-cap', () =>
    lathe(
      [
        [0, 0.38],
        [0.32, 0.36],
        [0.34, 0.42],
        [0.26, 0.56],
        [0.1, 0.64],
        [0, 0.66],
      ],
      18,
      10,
    ),
  );
}

export function Stop11Fireflies() {
  const s = useStop(ID);
  const d = STOP_DEFS[ID];
  const [ox, , oz] = d.object;
  const lamps = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * TAU + 0.4;
        return { pos: new THREE.Vector3(ox + Math.cos(a) * 2.3, 0, oz + Math.sin(a) * 2.0), lit: 0, color: ['#ffd36b', '#ff9fc4', '#9fe3ff', '#c9f2a0', '#e2c6ff', '#ffb36b'][i] };
      }),
    [ox, oz],
  );
  const capRefs = useRef<(THREE.Mesh | null)[]>([]);
  const glowRefs = useRef<(THREE.Sprite | null)[]>([]);
  const jarGlow = useRef<THREE.Sprite>(null!);
  const st = useMemo(
    () => ({
      trail: [] as { p: THREE.Vector3; age: number }[],
      drawing: false,
      progress: -1,
      speed: 7,
      heartT: -1,
      end: new THREE.Vector3(ox, 0.5, oz),
      flies: Array.from({ length: FLIES }, (_, i) => ({ p: new THREE.Vector3(ox + Math.cos(i) * 1.5, 1 + (i % 3) * 0.3, oz + Math.sin(i) * 1.5), ph: i * 0.7 })),
      allLit: false,
      jar: 0,
    }),
    [ox, oz],
  );
  // trail and firefly glow points
  const trailGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL).map((_, i) => i), 1));
    g.setAttribute('scale', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL), 1));
    return g;
  }, []);
  const flyGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FLIES * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(FLIES).map((_, i) => i * 3.1), 1));
    g.setAttribute('scale', new THREE.BufferAttribute(new Float32Array(FLIES).fill(1), 1));
    return g;
  }, []);
  const trailMat = useMemo(() => makeGlowPointsMaterial('#ffb84d', 30, 0.8), []);
  const flyMat = useMemo(() => makeGlowPointsMaterial('#ffd36b', 48, 1), []);

  const groundPlane = useMemo(() => {
    const o = stopFrame(ID).origin;
    return new THREE.Plane(new THREE.Vector3(0, 1, 0), -o.y);
  }, []);
  const toLocal = (w: THREE.Vector3) => {
    const f = stopFrame(ID);
    const rel = w.clone().sub(f.origin);
    return new THREE.Vector3(rel.dot(f.right), 0, -rel.dot(f.forward));
  };

  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const t = state.clock.elapsedTime;
    // age the trail
    st.trail.forEach((p) => (p.age += dt));
    if (!st.drawing && st.progress < 0) st.trail = st.trail.filter((p) => p.age < 2.5);
    const tp = trailGeo.getAttribute('position') as THREE.BufferAttribute;
    const ts = trailGeo.getAttribute('scale') as THREE.BufferAttribute;
    for (let i = 0; i < MAX_TRAIL; i++) {
      const p = st.trail[i];
      if (p) {
        tp.setXYZ(i, p.p.x, 0.12, p.p.z);
        ts.setX(i, clamp(1 - p.age / 9, 0.15, 1) * (st.progress >= 0 && i < st.progress ? 0.5 : 1));
      } else ts.setX(i, 0);
    }
    tp.needsUpdate = true;
    ts.needsUpdate = true;

    // fireflies follow the trail like a conga line
    if (st.progress >= 0) {
      st.progress += dt * st.speed;
      if (st.progress > st.trail.length + FLIES * 2.5 && !st.drawing) {
        st.progress = -1;
        st.heartT = 0;
        sfx.play('magic');
        burst('sparkle', localToWorld(ID, [st.end.x, 1, st.end.z]), { count: 20, colors: ['#ffd36b', '#ffffff'] });
      }
    }
    if (st.heartT >= 0) {
      st.heartT += dt;
      if (st.heartT > 3) st.heartT = -1;
    }
    const fp = flyGeo.getAttribute('position') as THREE.BufferAttribute;
    st.flies.forEach((f, i) => {
      const target = new THREE.Vector3();
      if (st.progress >= 0 && st.trail.length > 1) {
        const idx = clamp(Math.floor(st.progress - i * 2.5), 0, st.trail.length - 1);
        target.copy(st.trail[idx].p).setY(0.55 + Math.sin(t * 6 + f.ph) * 0.08);
      } else if (st.heartT >= 0) {
        // a heart of light at the end of the path
        const a = (i / FLIES) * TAU + st.heartT * 0.8;
        const hx = 16 * Math.pow(Math.sin(a), 3);
        const hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
        target.set(st.end.x + hx * 0.045, 1.2 + hy * 0.045, st.end.z);
      } else {
        target.set(ox + Math.cos(t * 0.4 + f.ph) * 1.3, 1.0 + Math.sin(t * 0.7 + f.ph * 2) * 0.35, oz + Math.sin(t * 0.33 + f.ph) * 1.1);
      }
      f.p.lerp(target, Math.min(1, dt * 5));
      fp.setXYZ(i, f.p.x, f.p.y, f.p.z);
      // light the lamps they pass
      lamps.forEach((l) => {
        if (l.lit < 1 && st.progress >= 0 && Math.hypot(f.p.x - l.pos.x, f.p.z - l.pos.z) < 0.75) {
          l.lit = 1;
          sfx.play('chime', lamps.indexOf(l) + 2);
          burst('sparkle', localToWorld(ID, [l.pos.x, 0.7, l.pos.z]), { count: 10, colors: [l.color, '#ffffff'] });
        }
      });
    });
    fp.needsUpdate = true;
    // lamps glow, then slowly fade so the game can be played again
    let lit = 0;
    lamps.forEach((l, i) => {
      if (l.lit > 0) {
        l.lit = Math.max(0, l.lit - dt * 0.04);
        lit++;
      }
      const cap = capRefs.current[i];
      if (cap) (cap.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.1 + l.lit * 1.6;
      const g = glowRefs.current[i];
      if (g) (g.material as THREE.SpriteMaterial).opacity = l.lit * 0.7;
    });
    if (lit === lamps.length && lamps.every((l) => l.lit > 0.6) && !st.allLit) {
      st.allLit = true;
      st.jar = 1;
      sfx.play('fanfare');
      zef.expression = 'happy';
      zefPlay('celebrate', 1.5);
      pipReact('dance', 2);
      setTimeout(() => (zef.expression = 'smile'), 2000);
    }
    if (lit < lamps.length) st.allLit = false;
    st.jar = Math.max(0, st.jar - dt * 0.05);
    (jarGlow.current.material as THREE.SpriteMaterial).opacity = 0.2 + st.jar * 0.7 + Math.sin(t * 3) * 0.05 * st.jar;
  });

  const drag = useDrag({
    plane: () => groundPlane,
    onStart: (info) => {
      if (!s.ask()) return false;
      st.trail = [{ p: toLocal(info.point), age: 0 }];
      st.drawing = true;
      st.progress = 0;
      st.heartT = -1;
      sfx.play('sparkle');
    },
    onMove: (info) => {
      const p = toLocal(info.point);
      // keep the trail inside the clearing
      const off = new THREE.Vector3(p.x - ox, 0, p.z - oz);
      if (off.length() > R) off.setLength(R);
      p.set(ox + off.x, 0, oz + off.z);
      const last = st.trail[st.trail.length - 1];
      if (!last || last.p.distanceTo(p) > 0.16) {
        if (st.trail.length < MAX_TRAIL) st.trail.push({ p, age: 0 });
        if (st.trail.length % 6 === 0) sfx.play('chime', 6 + ((st.trail.length / 6) % 5));
      }
    },
    onEnd: (info) => {
      st.drawing = false;
      s.touch();
      const last = st.trail[st.trail.length - 1];
      if (last) st.end.copy(last.p);
      if (info.total.length() < 10) {
        // a tap sends the fireflies on a little loop around the tap
        const c = toLocal(info.point);
        st.trail = Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * TAU;
          return { p: new THREE.Vector3(c.x + Math.cos(a) * 0.9, 0, c.z + Math.sin(a) * 0.9), age: 0 };
        });
        st.end.copy(c);
        st.progress = 0;
      }
    },
  });

  return (
    <StopFrame id={ID}>
      {/* mossy clearing */}
      <mesh material={matte('#6f8a45', 0.95)} position={[ox, 0.03, oz]} receiveShadow>
        <cylinderGeometry args={[R + 0.2, R + 0.4, 0.05, 40]} />
      </mesh>
      <mesh geometry={cachedGeo('clearing-stump', () => merge([lathe([[0, 0], [0.5, 0], [0.42, 0.45], [0, 0.45]], 18, 6)]))} material={matte('#9a6a3a', 0.8)} position={[ox, 0, oz]} />
      <mesh material={jelly('#fff3c4', 0.5)} position={[ox, 0.75, oz]}>
        <cylinderGeometry args={[0.25, 0.25, 0.55, 18]} />
      </mesh>
      <mesh material={matte('#e3263f', 0.6)} position={[ox, 1.05, oz]}>
        <cylinderGeometry args={[0.27, 0.27, 0.08, 18]} />
      </mesh>
      <Glow ref={jarGlow} color="#ffd36b" size={2.2} opacity={0.2} position={[ox, 0.8, oz]} />
      {lamps.map((l, i) => (
        <group key={i} position={l.pos}>
          <mesh geometry={lampGeometry()} material={vcolor(0.6, 'lampstem')} />
          <mesh ref={(m) => (capRefs.current[i] = m)} geometry={capGeometry()}>
            <meshStandardMaterial color={l.color} emissive={l.color} emissiveIntensity={0.1} roughness={0.5} />
          </mesh>
          <Glow ref={(g: THREE.Sprite | null) => (glowRefs.current[i] = g)} color={l.color} size={1.4} opacity={0} position={[0, 0.55, 0]} />
        </group>
      ))}
      <points geometry={trailGeo} material={trailMat} frustumCulled={false} />
      <points geometry={flyGeo} material={flyMat} frustumCulled={false} />
      {/* big invisible drawing surface */}
      <mesh visible={false} position={[ox, 0.06, oz]} {...drag}>
        <cylinderGeometry args={[R + 0.6, R + 0.6, 0.12, 24]} />
      </mesh>
      <HintHand visible={s.hint} gesture="drag" from={[ox - 1.8, 0.15, oz + 1.0]} to={[ox + 1.6, 0.15, oz - 1.2]} scale={1.3} />
    </StopFrame>
  );
}
