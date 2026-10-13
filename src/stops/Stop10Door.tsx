// Stop 10 — Knock on a waffle tree door to discover what lives inside.
// Three knocks and the little door creaks open: out pops a different friend
// each time (a cinnamon-bun hedgehog, a marzipan bunny, a cookie owl) who
// waves hello and sends Zef a heart.

import { useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { StopFrame, useStop } from './common';
import { STOP_DEFS, localToWorld } from '../world/stopDefs';
import { cachedGeo, extrude, lathe, paint } from '../three/geometry';
import { emissive, gloss, matte, pattern, vcolor } from '../three/materials';
import { Glow, HintHand } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pipReact, zef, zefPlay } from '../game/actors';
import { clamp, ease } from '../three/util';
import { waffleTreeGeometry } from '../world/regions/Woods';

const ID = 10;
const DOOR_W = 0.62;
const DOOR_H = 0.95;

function doorShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(DOOR_W, 0);
  s.lineTo(DOOR_W, DOOR_H - DOOR_W / 2);
  s.absarc(DOOR_W / 2, DOOR_H - DOOR_W / 2, DOOR_W / 2, 0, Math.PI, false);
  s.lineTo(0, 0);
  return s;
}

function Hedgehog() {
  return (
    <group>
      <mesh material={pattern({ a: '#e7a35a', b: '#8a4b20', mode: 'spiral', freq: 1, twist: 8, roughness: 0.6, clearcoat: 0.3 })} rotation={[0, 0, 0]} scale={[1, 1, 0.75]}>
        <sphereGeometry args={[0.24, 20, 16]} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => {
        const a = -0.6 + (i / 8) * 1.2 + Math.PI / 2;
        return (
          <mesh key={i} material={gloss(['#ff6b8b', '#ffd43b', '#69db7c', '#4dabf7'][i % 4], 0.3, 0.5)} position={[Math.cos(a) * 0.2, Math.sin(a) * 0.2 + 0.05, -0.08]} rotation={[0, 0, a - Math.PI / 2]}>
            <coneGeometry args={[0.04, 0.12, 6]} />
          </mesh>
        );
      })}
      <mesh material={matte('#f6d2a8', 0.6)} position={[0, -0.02, 0.17]} scale={[0.8, 0.7, 0.8]}>
        <sphereGeometry args={[0.13, 14, 12]} />
      </mesh>
      <mesh material={gloss('#2a1a14', 0.2, 0.8)} position={[0, -0.02, 0.29]}>
        <sphereGeometry args={[0.03, 8, 6]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} material={gloss('#1d1430', 0.1, 1)} position={[sx * 0.07, 0.06, 0.24]}>
          <sphereGeometry args={[0.025, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

function Bunny() {
  return (
    <group>
      <mesh material={matte('#ffc2d6', 0.6)} position={[0, -0.05, 0]}>
        <sphereGeometry args={[0.2, 18, 14]} />
      </mesh>
      <mesh material={matte('#ffd6e4', 0.6)} position={[0, 0.2, 0.05]}>
        <sphereGeometry args={[0.15, 18, 14]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * 0.06, 0.36, 0.02]} rotation={[0, 0, sx * -0.18]}>
          <mesh material={matte('#ffd6e4', 0.6)} position={[0, 0.12, 0]} scale={[0.6, 1, 0.4]}>
            <capsuleGeometry args={[0.06, 0.2, 4, 10]} />
          </mesh>
          <mesh material={matte('#ff8fb1', 0.6)} position={[0, 0.12, 0.02]} scale={[0.35, 0.8, 0.2]}>
            <capsuleGeometry args={[0.06, 0.2, 4, 10]} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={`e${sx}`} material={gloss('#1d1430', 0.1, 1)} position={[sx * 0.055, 0.23, 0.17]}>
          <sphereGeometry args={[0.025, 8, 6]} />
        </mesh>
      ))}
      <mesh material={matte('#ff6f9a', 0.5)} position={[0, 0.18, 0.19]}>
        <sphereGeometry args={[0.02, 8, 6]} />
      </mesh>
    </group>
  );
}

function Owl() {
  return (
    <group>
      <mesh material={matte('#c98a50', 0.7)} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.45, 1.15]}>
        <cylinderGeometry args={[0.24, 0.24, 0.3, 24]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * 0.1, 0.07, 0.08]}>
          <mesh material={matte('#ffffff', 0.4)}>
            <sphereGeometry args={[0.075, 14, 12]} />
          </mesh>
          <mesh material={gloss('#1d1430', 0.1, 1)} position={[0, 0, 0.06]}>
            <sphereGeometry args={[0.035, 10, 8]} />
          </mesh>
        </group>
      ))}
      <mesh material={gloss('#ff9f1c', 0.4, 0.5)} position={[0, -0.03, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.035, 0.08, 8]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={`t${sx}`} material={matte('#a96a35', 0.7)} position={[sx * 0.14, 0.22, 0]} rotation={[0, 0, sx * -0.4]}>
          <coneGeometry args={[0.05, 0.12, 6]} />
        </mesh>
      ))}
    </group>
  );
}

const RESIDENTS = [
  { name: 'hedgehog', sound: 'squeak' as const, El: Hedgehog },
  { name: 'bunny', sound: 'giggle' as const, El: Bunny },
  { name: 'owl', sound: 'hoot' as const, El: Owl },
];

export function Stop10Door() {
  const s = useStop(ID);
  const d = STOP_DEFS[ID];
  const [ox, , oz] = d.object;
  const facing = useMemo(() => Math.atan2(d.cam[0] - ox, d.cam[2] - oz), [d, ox, oz]);
  const door = useRef<THREE.Group>(null!);
  const friend = useRef<THREE.Group>(null!);
  const windowGlow = useRef<THREE.Sprite>(null!);
  const [who, setWho] = useState(0);
  const st = useMemo(() => ({ knocks: 0, shake: 0, open: 0, openTarget: 0, outT: -1, next: 0 }), []);
  const doorGeo = useMemo(() => cachedGeo('tree-door', () => paint(extrude(doorShape(), 0.06, 0.02, 14), '#8a3f1f')), []);
  const frameGeo = useMemo(
    () =>
      cachedGeo('tree-doorframe', () => {
        const g = lathe(
          [
            [DOOR_W / 2 + 0.02, -0.05],
            [DOOR_W / 2 + 0.12, -0.05],
            [DOOR_W / 2 + 0.12, 0.05],
            [DOOR_W / 2 + 0.02, 0.05],
          ],
          28,
          4,
        );
        g.rotateX(Math.PI / 2);
        return paint(g, '#ffe7b0');
      }),
    [],
  );
  const R = 0.55 * 1.3;
  const doorZ = R - 0.02;

  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    st.shake = Math.max(0, st.shake - dt * 4);
    st.open = THREE.MathUtils.damp(st.open, st.openTarget, st.openTarget > st.open ? 5 : 3, dt);
    door.current.rotation.y = -ease.outCubic(clamp(st.open, 0, 1)) * 1.7 + Math.sin(state.clock.elapsedTime * 50) * 0.04 * st.shake;
    door.current.position.z = doorZ + Math.sin(state.clock.elapsedTime * 45) * 0.01 * st.shake;
    // the friend pops out, says hello, and pops back in
    if (st.outT >= 0) {
      st.outT += dt;
      const t = st.outT;
      const out = t < 0.6 ? ease.outBack(t / 0.6) : t < 4.2 ? 1 : 1 - ease.inOutSine((t - 4.2) / 0.6);
      friend.current.visible = out > 0.02;
      friend.current.position.set(0, 0.3, doorZ + 0.05 + out * 0.45);
      friend.current.scale.setScalar(Math.max(0.001, out) * 1.25);
      friend.current.rotation.z = Math.sin(t * 8) * 0.12 * (t > 0.6 && t < 3 ? 1 : 0);
      friend.current.position.y = 0.3 + Math.abs(Math.sin(t * 6)) * 0.08 * (t > 0.6 && t < 3 ? 1 : 0);
      if (t > 4.8 && st.openTarget > 0) {
        st.openTarget = 0;
        sfx.play('creak');
      }
      if (t > 5.4) {
        st.outT = -1;
        st.knocks = 0;
        setWho((w) => (w + 1) % RESIDENTS.length);
      }
    } else friend.current.visible = false;
    (windowGlow.current.material as THREE.SpriteMaterial).opacity = 0.35 + st.open * 0.4 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
  });

  const knock = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!s.ask()) return;
    if (st.outT >= 0) {
      // tap the friend for another hello
      sfx.play(RESIDENTS[who].sound);
      burst('heart', e.point, { count: 3 });
      return;
    }
    st.knocks++;
    st.shake = 1;
    sfx.play('knock');
    zefPlay('knock', 0.7);
    burst('puff', e.point, { count: 2, size: 0.12 });
    if (st.knocks >= 3) {
      setTimeout(() => {
        st.openTarget = 1;
        st.outT = 0;
        sfx.play('creak');
        setTimeout(() => {
          sfx.play(RESIDENTS[who].sound);
          sfx.play('sparkle');
          const p = localToWorld(ID, [ox, 0.6, oz]);
          burst('sparkle', p, { count: 20 });
          // a heart floats over to Zef
          burst('heart', p, { count: 6, dir: zef.pos.clone().sub(p).setY(0.2).normalize(), speed: 1.5 });
          zef.expression = 'wow';
          zefPlay('wave', 1.6);
          pipReact('love', 1.6);
          setTimeout(() => (zef.expression = 'happy'), 900);
          setTimeout(() => (zef.expression = 'smile'), 3000);
        }, 450);
      }, 350);
    } else pipReact('surprised', 0.6);
  };

  const Friend = RESIDENTS[who].El;

  return (
    <StopFrame id={ID}>
      <group position={[ox, 0, oz]} rotation={[0, facing, 0]}>
        <mesh geometry={waffleTreeGeometry(2)} material={vcolor(0.5, 'waffle-tree')} scale={1.3} castShadow receiveShadow />
        <mesh geometry={frameGeo} material={vcolor(0.5, 'doorframe')} position={[0, DOOR_H - DOOR_W / 2, doorZ + 0.01]} />
        <mesh material={matte('#3a1d10', 0.9)} position={[0, DOOR_H / 2 - 0.05, doorZ - 0.03]}>
          <planeGeometry args={[DOOR_W, DOOR_H]} />
        </mesh>
        <mesh material={emissive('#ffcf6b', 1.4)} position={[0, 0.45, doorZ - 0.05]}>
          <planeGeometry args={[DOOR_W * 0.9, DOOR_H * 0.85]} />
        </mesh>
        <group ref={door} position={[-DOOR_W / 2, 0, doorZ]}>
          <mesh geometry={doorGeo} castShadow material={vcolor(0.5, 'tree-door')} />
          <mesh material={emissive('#ffd36b', 1.4)} position={[DOOR_W / 2, DOOR_H - DOOR_W / 2, 0.04]}>
            <circleGeometry args={[0.1, 18]} />
          </mesh>
          <mesh material={gloss('#ffd43b', 0.25, 0.8)} position={[DOOR_W - 0.1, 0.42, 0.06]}>
            <sphereGeometry args={[0.035, 10, 8]} />
          </mesh>
        </group>
        <Glow ref={windowGlow} color="#ffcf6b" size={1.1} opacity={0.4} position={[0, DOOR_H - DOOR_W / 2, doorZ + 0.25]} />
        <group ref={friend} visible={false}>
          <Friend />
        </group>
        {/* doorstep, lantern and mailbox */}
        <mesh material={matte('#e9b25c', 0.7)} position={[0, 0.04, doorZ + 0.35]}>
          <cylinderGeometry args={[0.42, 0.45, 0.08, 24]} />
        </mesh>
        <group position={[0.65, 0, doorZ + 0.3]}>
          <mesh material={matte('#5b2f18', 0.6)} position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.025, 0.03, 0.8, 6]} />
          </mesh>
          <mesh material={emissive('#ffcf6b', 1.6)} position={[0, 0.85, 0]}>
            <sphereGeometry args={[0.07, 10, 8]} />
          </mesh>
          <Glow color="#ffcf6b" size={0.8} opacity={0.6} position={[0, 0.85, 0]} />
        </group>
        <group position={[-0.7, 0, doorZ + 0.25]}>
          <mesh material={matte('#ffffff', 0.5)} position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.6, 6]} />
          </mesh>
          <mesh material={gloss('#ff6b8b', 0.4, 0.5)} position={[0, 0.65, 0]}>
            <boxGeometry args={[0.24, 0.16, 0.14]} />
          </mesh>
        </group>
        <mesh visible={false} position={[0, 0.55, doorZ + 0.3]} onPointerDown={knock}>
          <boxGeometry args={[1.5, 1.4, 1.0]} />
        </mesh>
        <HintHand visible={s.hint} gesture="tap" from={[0, 0.55, doorZ + 0.25]} scale={1.1} />
      </group>
    </StopFrame>
  );
}
