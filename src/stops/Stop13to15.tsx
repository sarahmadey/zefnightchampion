// Stop 13 — Light gumdrop lanterns in any order. Each tap lights a lantern
// with its own chime; when all five glow, they play a little chord and a
// ribbon of light streams up the mountain to the castle.
// Stops 14 and 15 live on the castle itself (tower windows and doors); these
// components add their gesture hints.

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { StopFrame, useStop } from './common';
import { STOP_DEFS, localToWorld } from '../world/stopDefs';
import { gumdropGeometry } from '../three/geometry';
import { gloss, jelly, pattern } from '../three/materials';
import { Glow, HintHand } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pipReact, zef, zefPlay } from '../game/actors';
import { Spring } from '../three/util';
import { CASTLE_POS, TOWERS } from '../world/Castle';

const LANTERNS = [
  { x: -2.6, z: 1.1, h: 1.5, color: '#ff5d8f', note: 0 },
  { x: -3.9, z: 0.5, h: 1.9, color: '#ffd43b', note: 2 },
  { x: -4.7, z: -0.7, h: 1.6, color: '#51cf66', note: 4 },
  { x: -4.3, z: -2.0, h: 2.0, color: '#4dabf7', note: 5 },
  { x: -3.0, z: -2.6, h: 1.7, color: '#b197fc', note: 7 },
];

function Lantern({ spec, lit, spring }: { spec: (typeof LANTERNS)[number]; lit: { v: number }; spring: Spring }) {
  const body = useRef<THREE.Group>(null!);
  const bulb = useRef<THREE.Mesh>(null!);
  const glow = useRef<THREE.Sprite>(null!);
  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const v = spring.update(dt);
    body.current.scale.set(1 + v * 0.4, 1 - v * 0.6, 1 + v * 0.4);
    body.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.5 + spec.x) * 0.06;
    (bulb.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15 + lit.v * 2.4;
    (glow.current.material as THREE.SpriteMaterial).opacity = lit.v * 0.75;
    glow.current.scale.setScalar(1.2 + lit.v * 1.2 + Math.sin(state.clock.elapsedTime * 3 + spec.x) * 0.08 * lit.v);
  });
  return (
    <group position={[spec.x, 0, spec.z]}>
      <mesh material={pattern({ a: '#ffffff', b: spec.color, mode: 'helix', freq: 1, twist: 6 })} position={[0, spec.h / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.06, spec.h, 10]} />
      </mesh>
      <mesh material={gloss('#ffd23f', 0.3, 0.7)} position={[0.18, spec.h, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.18, 0.025, 6, 16, Math.PI]} />
      </mesh>
      <group ref={body} position={[0.36, spec.h - 0.12, 0]}>
        <group position={[0, -0.42, 0]}>
          <mesh geometry={gumdropGeometry(28)} material={jelly(spec.color, 0.7)} scale={0.62} />
          <mesh ref={bulb} position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.13, 14, 10]} />
            <meshStandardMaterial color="#fff6d8" emissive={spec.color} emissiveIntensity={0.15} toneMapped={false} />
          </mesh>
          <mesh material={gloss('#ffd23f', 0.3, 0.7)} position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 0.06, 12]} />
          </mesh>
          <Glow ref={glow} color={spec.color} size={1.6} opacity={0} position={[0, 0.25, 0]} />
        </group>
      </group>
    </group>
  );
}

export function Stop13Lanterns() {
  const s = useStop(13);
  const d = STOP_DEFS[13];
  const [ox, , oz] = d.object;
  const st = useMemo(() => ({ lit: LANTERNS.map(() => ({ v: 0, hold: 0 })), springs: LANTERNS.map(() => new Spring(0, 220, 8)), done: false, ribbonT: -1 }), []);

  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    st.lit.forEach((l) => {
      if (l.hold > 0) {
        l.hold -= dt;
        l.v = THREE.MathUtils.damp(l.v, 1, 8, dt);
      } else l.v = THREE.MathUtils.damp(l.v, 0, 1.5, dt);
    });
    if (st.ribbonT >= 0) {
      st.ribbonT += dt;
      // a ribbon of light climbs from the lanterns to the castle
      const k = Math.min(1, st.ribbonT / 3);
      const from = localToWorld(13, [ox - 3.6, 2, oz - 0.8]);
      const to = CASTLE_POS.clone().add(new THREE.Vector3(0, 10, 4));
      const p = from.clone().lerp(to, k);
      p.y += Math.sin(k * Math.PI) * 4;
      burst('sparkle', p, { count: 4, speed: 0.5, up: 0.2, gravity: 0, life: 1.6, colors: LANTERNS.map((l) => l.color), size: 0.22 });
      if (st.ribbonT > 3.2) {
        st.ribbonT = -1;
        burst('sparkle', to, { count: 40, speed: 5, size: 0.35, colors: LANTERNS.map((l) => l.color) });
        sfx.play('firework');
      }
    }
    if (st.done && st.lit.every((l) => l.v < 0.3)) st.done = false;
  });

  const light = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!s.ask()) return;
    const l = st.lit[i];
    l.hold = 11;
    st.springs[i].kick(5);
    sfx.play('chime', LANTERNS[i].note);
    burst('sparkle', e.point, { count: 14, colors: [LANTERNS[i].color, '#ffffff'] });
    zef.look = localToWorld(13, [ox + LANTERNS[i].x + 3.5, LANTERNS[i].h, oz + LANTERNS[i].z + 0.6]);
    if (!st.done && st.lit.every((x) => x.hold > 0)) {
      st.done = true;
      st.lit.forEach((x) => (x.hold = 12));
      // a little chord, then the ribbon of light
      LANTERNS.forEach((ln, k) => setTimeout(() => sfx.play('chime', ln.note + 5), 300 + k * 130));
      setTimeout(() => {
        st.ribbonT = 0;
        sfx.play('magic');
      }, 1100);
      zef.expression = 'happy';
      zefPlay('celebrate', 1.5);
      pipReact('cheer', 1.6);
      setTimeout(() => (zef.expression = 'smile'), 2000);
    } else if (i % 2 === 0) pipReact('surprised', 0.8);
  };

  const firstDark = st.lit.findIndex((l) => l.hold <= 0);
  const hint = LANTERNS[Math.max(0, firstDark)];

  return (
    <StopFrame id={13}>
      <group position={[ox + 3.5, 0, oz + 0.6]}>
        {LANTERNS.map((spec, i) => (
          <group key={i}>
            <Lantern spec={spec} lit={st.lit[i]} spring={st.springs[i]} />
            <mesh visible={false} position={[spec.x + 0.36, spec.h - 0.45, spec.z]} onPointerDown={light(i)}>
              <sphereGeometry args={[0.62, 10, 8]} />
            </mesh>
          </group>
        ))}
        <HintHand visible={s.hint} gesture="tap" from={[hint.x + 0.36, hint.h - 0.35, hint.z + 0.3]} scale={1.1} />
      </group>
    </StopFrame>
  );
}

/** Stop 14: the castle towers react to taps; this adds the hint. */
export function Stop14Towers() {
  const s = useStop(14);
  const t = TOWERS[0];
  const p = CASTLE_POS.clone().add(new THREE.Vector3(t.x - 0.3, t.h * 0.5, t.z + t.r + 0.8));
  return <HintHand visible={s.hint} gesture="tap" from={[p.x, p.y, p.z]} scale={2.6} />;
}

/** Stop 15: the castle doors open; this adds the hint. */
export function Stop15Doors() {
  const s = useStop(15);
  const p = CASTLE_POS.clone().add(new THREE.Vector3(0.3, 1.9, 9.4));
  return <HintHand visible={s.hint} gesture="tap" from={[p.x, p.y, p.z]} scale={1.6} />;
}
