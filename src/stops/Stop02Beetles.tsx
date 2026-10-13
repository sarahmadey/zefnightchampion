// Stop 2 — Tap jellybean beetles to start their parade. Each tapped beetle
// hops awake and joins a marching line around a little cake; when all six
// march together they do a hopping wave and confetti flies.

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { StopFrame, useStop } from './common';
import { STOP_DEFS } from '../world/stopDefs';
import { cachedGeo, capsuleRadius, curveFrom, extrude, starShape, tube } from '../three/geometry';
import { gloss, matte, vcolor } from '../three/materials';
import { HintHand } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pipReact, zef, zefPlay } from '../game/actors';
import { TAU, dampAngle } from '../three/util';
import { cakeGeometry } from '../world/regions/Garden';

const ID = 2;
const COLORS = ['#ff4d6d', '#ff9f1c', '#ffd60a', '#52d273', '#9b6bff', '#ff7ac6'];
const LOOP_R = 1.75;

function beanGeometry() {
  return cachedGeo('beetle-bean', () =>
    tube(curveFrom([[0, 0.17, -0.2], [0, 0.22, 0], [0, 0.17, 0.2]]), { segments: 16, radial: 16, radius: capsuleRadius(0.16, 0.42) }),
  );
}

function legGeometry() {
  return cachedGeo('beetle-leg', () =>
    tube(curveFrom([[0, 0, 0], [0.09, -0.04, 0], [0.13, -0.12, 0]]), { segments: 6, radial: 5, radius: () => 0.018 }),
  );
}

function antennaGeometry() {
  return cachedGeo('beetle-antenna', () =>
    tube(curveFrom([[0, 0, 0], [0.02, 0.08, 0.04], [0.05, 0.16, 0.05]]), { segments: 6, radial: 5, radius: () => 0.012 }),
  );
}

type Mode = 'rest' | 'join' | 'parade' | 'home';

interface BeetleState {
  mode: Mode;
  pos: THREE.Vector3;
  heading: number;
  rest: THREE.Vector3;
  restHeading: number;
  slot: number;
  hop: number;
  hopV: number;
  flip: number;
  stepPhase: number;
  wiggle: number;
}

function Beetle({ color, st }: { color: string; st: BeetleState }) {
  const g = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const ants = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    g.current.position.copy(st.pos);
    g.current.rotation.y = st.heading;
    body.current.position.y = st.hop;
    body.current.rotation.x = st.flip;
    const walking = st.mode === 'parade' || st.mode === 'join' || st.mode === 'home';
    legs.current.forEach((l, i) => {
      if (!l) return;
      const side = i < 3 ? 1 : -1;
      const k = i % 3;
      const swing = walking ? Math.sin(st.stepPhase + k * 2.1 + (side > 0 ? 0 : Math.PI)) * 0.5 : 0;
      l.rotation.set(0, swing, walking ? 0 : -0.3 * side);
    });
    ants.current.forEach((a, i) => {
      if (a) a.rotation.set(Math.sin(t * 6 + i) * 0.2 * st.wiggle - 0.2, 0, (i ? -1 : 1) * 0.3);
    });
  });
  const legGeo = legGeometry();
  return (
    <group ref={g}>
      <group ref={body}>
        <mesh geometry={beanGeometry()} material={gloss(color, 0.12, 1)} castShadow />
        <mesh material={gloss('#3a1e14', 0.3, 0.6)} position={[0, 0.2, 0.24]}>
          <sphereGeometry args={[0.1, 14, 10]} />
        </mesh>
        {[-1, 1].map((sx) => (
          <group key={sx} position={[0.045 * sx, 0.24, 0.32]}>
            <mesh material={matte('#ffffff', 0.3)}>
              <sphereGeometry args={[0.032, 10, 8]} />
            </mesh>
            <mesh material={matte('#111111', 0.3)} position={[0, 0, 0.022]}>
              <sphereGeometry args={[0.016, 8, 6]} />
            </mesh>
          </group>
        ))}
        {[-1, 1].map((sx, i) => (
          <group key={`a${sx}`} position={[0.04 * sx, 0.28, 0.28]}>
            <mesh ref={(m) => (ants.current[i] = m)} geometry={antennaGeometry()} material={matte('#3a1e14', 0.5)} scale={[sx, 1, 1]} />
          </group>
        ))}
        {/* shiny highlight dots on the jellybean shell */}
        <mesh material={matte('#ffffff', 0.2)} position={[0.07, 0.33, 0.02]} scale={[1, 0.6, 1.6]}>
          <sphereGeometry args={[0.025, 8, 6]} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => {
          const side = i < 3 ? 1 : -1;
          const k = i % 3;
          return (
            <group key={i} ref={(l) => (legs.current[i] = l)} position={[0.12 * side, 0.1, -0.1 + k * 0.1]}>
              <mesh geometry={legGeo} material={matte('#3a1e14', 0.6)} scale={[side, 1, 1]} />
            </group>
          );
        })}
      </group>
    </group>
  );
}

function flagGeometry() {
  return cachedGeo('beetle-flag', () => extrude(starShape(5, 0.12, 0.055, 0.1), 0.02, 0.008, 4));
}

export function Stop02Beetles() {
  const s = useStop(ID);
  const d = STOP_DEFS[ID];
  const center = useMemo(() => new THREE.Vector3(d.object[0], 0, d.object[2]), [d]);
  const beetles = useMemo<BeetleState[]>(
    () =>
      COLORS.map((_, i) => {
        // resting in a little arc on the path side of the cake
        const a = Math.PI * 0.15 + (i / (COLORS.length - 1)) * Math.PI * 0.7;
        const rest = new THREE.Vector3(center.x + Math.cos(a) * 1.55, 0, center.z + Math.sin(a) * 1.55 - 0.2);
        const restHeading = Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI;
        return { mode: 'rest', pos: rest.clone(), heading: restHeading, rest, restHeading, slot: -1, hop: 0, hopV: 0, flip: 0, stepPhase: i, wiggle: 1 };
      }),
    [center],
  );
  const flag = useRef<THREE.Group>(null!);
  const parade = useMemo(() => ({ lead: 0, joined: 0, celebrated: false, timer: 0, drumT: 0 }), []);

  const loopPoint = (ang: number, out: THREE.Vector3) => out.set(center.x + Math.cos(ang) * LOOP_R, 0, center.z + Math.sin(ang) * LOOP_R * 0.85);

  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    const anyMarching = beetles.some((b) => b.mode === 'parade' || b.mode === 'join');
    if (anyMarching) parade.lead += dt * 0.55;
    if (anyMarching) {
      parade.drumT += dt;
      if (parade.drumT > 0.5) {
        parade.drumT = 0;
        sfx.play('drum');
      }
    }
    // after the celebration the beetles march a while, then go home to rest
    if (parade.celebrated) {
      parade.timer += dt;
      if (parade.timer > 12) {
        parade.celebrated = false;
        parade.timer = 0;
        parade.joined = 0;
        beetles.forEach((b) => {
          b.mode = 'home';
          b.slot = -1;
        });
      }
    }
    const tmp = new THREE.Vector3();
    beetles.forEach((b) => {
      // hop physics
      b.hopV -= 14 * dt;
      b.hop = Math.max(0, b.hop + b.hopV * dt);
      if (b.hop === 0) b.hopV = Math.max(0, b.hopV);
      b.flip = b.flip > 0 ? Math.max(0, b.flip - dt * 9) : 0;
      b.wiggle = THREE.MathUtils.damp(b.wiggle, b.mode === 'rest' ? 0.3 : 1, 3, dt);
      if (b.mode === 'rest') return;
      let target: THREE.Vector3;
      if (b.mode === 'home') target = b.rest;
      else target = loopPoint(parade.lead - b.slot * 0.5, tmp);
      const dx = target.x - b.pos.x;
      const dz = target.z - b.pos.z;
      const dist = Math.hypot(dx, dz);
      const speed = b.mode === 'parade' ? 1.6 : 2.2;
      const step = Math.min(dist, speed * dt);
      if (dist > 1e-3) {
        b.pos.x += (dx / dist) * step;
        b.pos.z += (dz / dist) * step;
        b.heading = dampAngle(b.heading, Math.atan2(dx, dz), 10, dt);
        b.stepPhase += dt * 16;
      }
      if (b.mode === 'join' && dist < 0.08) b.mode = 'parade';
      if (b.mode === 'home' && dist < 0.05) {
        b.mode = 'rest';
        b.heading = b.restHeading;
      }
      if (b.mode === 'parade') {
        b.stepPhase += dt * 10;
        b.hop = Math.max(b.hop, Math.abs(Math.sin(b.stepPhase * 0.5)) * 0.03);
      }
    });
    // the first marcher proudly carries a star flag
    const leader = beetles.find((b) => b.slot === 0 && b.mode !== 'rest' && b.mode !== 'home');
    flag.current.visible = !!leader;
    if (leader) {
      flag.current.position.set(leader.pos.x, leader.pos.y + leader.hop + 0.25, leader.pos.z);
      flag.current.rotation.y = leader.heading;
    }
  });

  const tapBeetle = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!s.ask()) return;
    const b = beetles[i];
    b.hopV = 4.2;
    sfx.play('squeak');
    burst('sparkle', b.pos.clone().setY(0.5), { count: 10, colors: [COLORS[i], '#ffffff'] });
    if (b.mode === 'rest' || b.mode === 'home') {
      b.mode = 'join';
      b.slot = parade.joined++;
      sfx.play('chime', b.slot + 2);
      zef.look = b.pos.clone();
      if (parade.joined === 1) {
        zefPlay('point', 1.2);
        pipReact('surprised', 1);
      }
      if (parade.joined === COLORS.length) {
        // everyone is marching: a hopping wave and confetti
        parade.celebrated = true;
        parade.timer = 0;
        setTimeout(() => {
          beetles.forEach((bb, k) => setTimeout(() => (bb.hopV = 4.5), k * 140));
          burst('confetti', center.clone().setY(1.2), { count: 40 });
          sfx.play('fanfare');
          zefPlay('celebrate', 1.6);
          zef.expression = 'happy';
          pipReact('dance', 2.4);
          setTimeout(() => (zef.expression = 'smile'), 2200);
        }, 900);
      }
    } else {
      b.flip = TAU;
      beetles.forEach((bb, k) => k !== i && setTimeout(() => (bb.hopV = 3), Math.abs(k - i) * 90));
    }
  };

  const restingIdx = beetles.findIndex((b) => b.mode === 'rest');
  const hintTarget = beetles[Math.max(0, restingIdx)].rest;

  return (
    <StopFrame id={ID}>
      <group position={[center.x, 0, center.z]}>
        <mesh geometry={cakeGeometry(1, 1.05, 7)} material={vcolor(0.6, 'cake')} castShadow receiveShadow />
      </group>
      {beetles.map((b, i) => (
        <group key={i}>
          <Beetle color={COLORS[i]} st={b} />
          <BeetleHit st={b} onTap={tapBeetle(i)} />
        </group>
      ))}
      <group ref={flag}>
        <mesh material={matte('#fff3d6', 0.5)} position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.6, 6]} />
        </mesh>
        <mesh geometry={flagGeometry()} material={gloss('#ffd43b', 0.3, 0.6)} position={[0, 0.62, 0]} />
      </group>
      <HintHand visible={s.hint} gesture="tap" from={[hintTarget.x, 0.45, hintTarget.z]} scale={1.1} />
    </StopFrame>
  );
}

function BeetleHit({ st, onTap }: { st: BeetleState; onTap: (e: ThreeEvent<PointerEvent>) => void }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    ref.current.position.set(st.pos.x, 0.25, st.pos.z);
  });
  return (
    <mesh ref={ref} visible={false} onPointerDown={onTap}>
      <sphereGeometry args={[0.42, 8, 6]} />
    </mesh>
  );
}

