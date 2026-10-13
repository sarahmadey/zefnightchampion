// Stop 6 — Spin a peppermint windmill and watch the breeze. Swiping the
// peppermint sails spins them; the breeze bends the cotton-candy trees,
// drifts bubbles and clouds, spins little pinwheels, lifts a candy kite and
// ruffles Zef's hair and Pip's tail. It all calms down as the sails slow.

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { StopFrame, useDrag, useStop } from './common';
import { STOP_DEFS, localToWorld } from '../world/stopDefs';
import { cachedGeo, curveFrom, extrude, lathe, tube } from '../three/geometry';
import { gloss, matte, pattern } from '../three/materials';
import { HintHand } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pip, pipReact, zef, zefPlay } from '../game/actors';
import { windUniforms } from '../world/decor';
import { peppermintSailGeometry } from '../world/regions/Meadow';
import { TAU, clamp } from '../three/util';
import { motion } from '../game/settings';

const ID = 6;

function towerGeometry() {
  return cachedGeo('big-windmill-tower', () =>
    lathe(
      [
        [0, 0],
        [1.25, 0],
        [1.05, 1.8],
        [0.78, 4.0],
        [0.86, 4.05],
        [0.86, 4.3],
        [0, 4.35],
      ],
      28,
      16,
    ),
  );
}

function kiteGeometry() {
  return cachedGeo('candy-kite', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.45);
    s.lineTo(0.3, 0);
    s.lineTo(0, -0.55);
    s.lineTo(-0.3, 0);
    s.lineTo(0, 0.45);
    return extrude(s, 0.03, 0.012, 2);
  });
}

function Pinwheel({ position, spin }: { position: [number, number, number]; spin: { v: number } }) {
  const head = useRef<THREE.Group>(null!);
  const st = useMemo(() => ({ a: Math.random() * 6 }), []);
  useFrame((_, rawDt) => {
    st.a += frameDt(rawDt) * (0.4 + spin.v * 1.6);
    head.current.rotation.z = st.a;
  });
  const colors = ['#ff5d8f', '#ffd43b', '#4dabf7', '#69db7c'];
  return (
    <group position={position}>
      <mesh material={matte('#ffffff', 0.5)} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.025, 0.03, 1.0, 6]} />
      </mesh>
      <group ref={head} position={[0, 1.02, 0.03]}>
        {colors.map((c, k) => (
          <mesh key={k} material={gloss(c, 0.35, 0.4)} rotation={[0, 0, (k / 4) * TAU]} position={[0, 0, 0]}>
            <coneGeometry args={[0.13, 0.32, 3]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function Stop06Windmill() {
  const s = useStop(ID);
  const d = STOP_DEFS[ID];
  const [ox, , oz] = d.object;
  const camera = useThree((st) => st.camera);
  const rotor = useRef<THREE.Group>(null!);
  const kite = useRef<THREE.Group>(null!);
  const string = useRef<THREE.Mesh>(null!);
  const st = useMemo(() => ({ angle: 0, omega: 0.2, spin: { v: 0 }, gustT: 0, lastDir: 1, cheered: false }), []);
  // face the rotor toward the stop camera
  const facing = useMemo(() => Math.atan2(d.cam[0] - ox, d.cam[2] - oz), [d, ox, oz]);
  const sailMat = useMemo(() => pattern({ a: '#ffffff', b: '#e8253f', mode: 'spiral', freq: 6, twist: 0, duty: 0.5 }), []);
  const anchor = useMemo(() => new THREE.Vector3(d.pip[0] - 0.9, 0.9, d.pip[1] + 0.2), [d]);
  const rotorWorld = useMemo(() => localToWorld(ID, [ox + Math.sin(facing) * 0.95, 3.6, oz + Math.cos(facing) * 0.95]), [ox, oz, facing]);

  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    st.omega *= Math.exp(-0.42 * dt);
    if (Math.abs(st.omega) < 0.25) st.omega = 0.25 * Math.sign(st.omega || 1);
    st.angle += st.omega * dt * (motion.reduced ? 0.6 : 1);
    rotor.current.rotation.z = st.angle;
    const breeze = clamp((Math.abs(st.omega) - 0.3) / 9, 0, 1);
    st.spin.v = THREE.MathUtils.damp(st.spin.v, breeze, 3, dt);
    windUniforms.breeze.value = st.spin.v;
    if (s.focused || st.spin.v > 0.02) {
      zef.breeze = st.spin.v;
      pip.breeze = st.spin.v;
    }
    // petals and sparkles carried on the breeze
    if (st.spin.v > 0.15 && !motion.reduced) {
      st.gustT += dt * st.spin.v * 18;
      while (st.gustT > 1) {
        st.gustT -= 1;
        const p = rotorWorld.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 3));
        const dir = localToWorld(ID, [1, 0, 0.2]).sub(localToWorld(ID, [0, 0, 0])).normalize();
        burst(Math.random() < 0.5 ? 'confetti' : 'sparkle', p, { count: 1, speed: 2.5 + st.spin.v * 4, dir, gravity: -0.4, up: 0.2, life: 2.2, colors: ['#ffffff', '#ffc2d6', '#ff5d7a'], size: Math.random() < 0.5 ? 0.06 : 0.12 });
      }
    }
    if (st.spin.v > 0.7 && !st.cheered) {
      st.cheered = true;
      zef.expression = 'wow';
      zefPlay('lookUp', 1.6);
      pipReact('spin', 1.4);
      setTimeout(() => (zef.expression = 'smile'), 1800);
    }
    if (st.spin.v < 0.2) st.cheered = false;
    // the kite climbs with the wind
    const t = state.clock.elapsedTime;
    const h = 1.8 + st.spin.v * 3.2;
    const kx = anchor.x + 1.6 + st.spin.v * 1.8 + Math.sin(t * 1.3) * 0.25 * (0.3 + st.spin.v);
    const kz = anchor.z - 1.2 + Math.cos(t * 0.9) * 0.2;
    kite.current.position.set(kx, anchor.y + h, kz);
    kite.current.rotation.set(0.2 + Math.sin(t * 2) * 0.1, facing, Math.sin(t * 1.7) * 0.25 * (0.4 + st.spin.v));
    const a = anchor;
    const b = kite.current.position;
    const mid = a.clone().lerp(b, 0.5);
    string.current.position.copy(mid);
    string.current.scale.set(1, a.distanceTo(b), 1);
    string.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  });

  const center2D = () => {
    const v = rotorWorld.clone().project(camera);
    return new THREE.Vector2(((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight);
  };

  const drag = useDrag({
    onStart: () => {
      if (!s.ask()) return false;
    },
    onMove: (info) => {
      const c = center2D();
      const r = info.screen.clone().sub(c);
      // swiping around (or across) the rotor turns it in that direction
      const cross = r.x * info.delta.y - r.y * info.delta.x;
      const dir = Math.abs(cross) > 1 ? -Math.sign(cross) : st.lastDir;
      st.lastDir = dir;
      st.omega += dir * info.delta.length() * 0.06;
      st.omega = clamp(st.omega, -16, 16);
      if (Math.random() < 0.08) sfx.play('whoosh');
    },
    onEnd: (info) => {
      s.touch();
      if (info.total.length() < 10) {
        st.omega += st.lastDir * 4;
        sfx.play('whoosh');
        burst('puff', info.event.point, { count: 3, size: 0.2 });
      }
    },
  });

  return (
    <StopFrame id={ID}>
      <group position={[ox, 0, oz]} rotation={[0, facing, 0]}>
        <mesh geometry={towerGeometry()} material={pattern({ a: '#ffffff', b: '#ff8fb3', mode: 'helix', freq: 0, twist: 2.5, roughness: 0.6, clearcoat: 0.2 })} castShadow receiveShadow />
        <mesh material={matte('#ff6f9a', 0.55)} position={[0, 4.75, 0]} castShadow>
          <coneGeometry args={[1.15, 1.2, 28]} />
        </mesh>
        <mesh material={matte('#ffffff', 0.5)} position={[0, 5.45, 0]}>
          <sphereGeometry args={[0.18, 12, 10]} />
        </mesh>
        {/* door and window */}
        <mesh material={gloss('#8a4b2a', 0.4, 0.4)} position={[0, 0.55, 1.2]} rotation={[-0.06, 0, 0]}>
          <boxGeometry args={[0.6, 1.1, 0.08]} />
        </mesh>
        <mesh material={matte('#ffe7a8', 0.4)} position={[0, 2.5, 0.92]}>
          <circleGeometry args={[0.22, 20]} />
        </mesh>
        <group ref={rotor} position={[0, 3.6, 0.95]}>
          {[0, 1, 2, 3].map((k) => (
            <group key={k} rotation={[0, 0, (k / 4) * TAU]}>
              <mesh material={matte('#fff6e8', 0.6)} position={[0, 0.75, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 1.5, 6]} />
              </mesh>
              <mesh geometry={peppermintSailGeometry()} material={sailMat} position={[0, 1.55, 0.04]} scale={1.45} castShadow />
            </group>
          ))}
          <mesh material={matte('#ff6f9a', 0.5)}>
            <sphereGeometry args={[0.22, 14, 10]} />
          </mesh>
        </group>
        {/* big swipe disc in front of the sails */}
        <mesh visible={false} position={[0, 3.6, 1.3]} rotation={[Math.PI / 2, 0, 0]} {...drag}>
          <cylinderGeometry args={[2.7, 2.7, 0.4, 20]} />
        </mesh>
        <HintHand visible={s.hint} gesture="spin" from={[0, 3.6, 1.6]} to={[1.2, 3.6, 1.6]} scale={1.4} />
      </group>
      <Pinwheel position={[d.zef[0] - 1.4, 0, d.zef[1] + 1.6]} spin={st.spin} />
      <Pinwheel position={[ox + 2.2, 0, oz + 1.8]} spin={st.spin} />
      <Pinwheel position={[ox - 1.8, 0, oz + 2.4]} spin={st.spin} />
      {/* candy kite tied to a little post */}
      <mesh material={matte('#fff3d6', 0.5)} position={[anchor.x, anchor.y / 2, anchor.z]}>
        <cylinderGeometry args={[0.04, 0.05, anchor.y, 6]} />
      </mesh>
      <mesh ref={string} material={matte('#ffffff', 0.4)}>
        <cylinderGeometry args={[0.008, 0.008, 1, 4]} />
      </mesh>
      <group ref={kite}>
        <mesh geometry={kiteGeometry()} material={pattern({ a: '#ff5d8f', b: '#ffd43b', mode: 'spiral', freq: 4, twist: 0 })} />
        <mesh geometry={cachedGeo('kite-tail', () => tube(curveFrom([[0, -0.55, 0], [0.1, -0.9, 0], [-0.1, -1.25, 0], [0.05, -1.6, 0]]), { segments: 16, radial: 5, radius: () => 0.02 }))} material={matte('#ffffff', 0.5)} />
      </group>
    </StopFrame>
  );
}
