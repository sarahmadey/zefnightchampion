// The keepsake shelf beside the cottage: a gingerbread cabinet with fifteen
// cubbies. Every surprise Zef has ever discovered leaves a little 3D keepsake
// here — they stay even when the journey starts over. Tap one and it hops,
// spins and sparkles.

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  cachedGeo,
  cuppedPetal,
  gumdropGeometry,
  heartShape,
  extrude,
  merge,
  paint,
  puffGeometry,
  roundedBox,
} from '../three/geometry';
import { emissive, gloss, jelly, marshmallow, matte, pattern, vcolor, vcolorGloss } from '../three/materials';
import { Glow } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx, type SoundName } from '../audio/sfx';
import { cam, frameDt, pipReact, zef, zefPlay } from '../game/actors';
import { stopFrame, stopLocalToWorld, nearestOnRoute } from '../game/route';
import { useGame, useJourney } from '../state/store';
import { setFocus } from '../game/world';
import { walkRoute } from '../game/nav';
import { Spring, TAU } from '../three/util';
import { lemonBoatGeometry } from './regions/River';
import { useDistanceCull } from './decor';
import { peppermintSailGeometry } from './regions/Meadow';

const SHELF_LOCAL: [number, number, number] = [4.1, 0, 3.0];
const COLS = 5;
const ROWS = 3;
const CELL_W = 0.62;
const CELL_H = 0.62;

export function shelfWorld() {
  const p = stopLocalToWorld(0, SHELF_LOCAL);
  const f = stopFrame(0);
  const camLocal: [number, number, number] = [SHELF_LOCAL[0] - 3.2, 2.5, SHELF_LOCAL[2] - 3.0];
  return {
    pos: p,
    yaw: f.yaw + Math.atan2(camLocal[0] - SHELF_LOCAL[0], camLocal[2] - SHELF_LOCAL[2]),
    cam: stopLocalToWorld(0, camLocal),
    look: stopLocalToWorld(0, [SHELF_LOCAL[0], 1.15, SHELF_LOCAL[2]]),
    zefSpot: stopLocalToWorld(0, [SHELF_LOCAL[0] - 2.3, 0, SHELF_LOCAL[2] - 0.5]),
  };
}

export function goToShelf() {
  const g = useGame.getState();
  if (g.cutscene) return;
  const w = shelfWorld();
  const n = nearestOnRoute(w.zefSpot.x, w.zefSpot.z);
  if (g.focusStop !== null) setFocus(null);
  walkRoute(n.s, n.lateral, () => {
    useGame.getState().set({ shelfFocus: true });
    cam.mode = 'focus';
    cam.pos.copy(w.cam);
    cam.target.copy(w.look);
    cam.fitWidth = 3.8;
    cam.lambda = 2.4;
    zef.look = w.look.clone();
    zefPlay('point', 1.2);
  });
}

// ------------------------------------------------------------ tokens

function Token({ id }: { id: number }) {
  switch (id) {
    case 1:
      return (
        <group>
          {Array.from({ length: 5 }, (_, k) => (
            <mesh key={k} geometry={cachedGeo('tok-petal', () => cuppedPetal(0.12, 0.08, 0.02, 0.01))} material={matte('#ffffff', 0.4)} rotation={[-0.3, (k / 5) * TAU, 0]} position={[0, 0.12, 0]} />
          ))}
          <mesh material={gloss('#ffd43b', 0.3, 0.5)} position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.04, 10, 8]} />
          </mesh>
        </group>
      );
    case 2:
      return (
        <group position={[0, 0.08, 0]}>
          <mesh material={gloss('#9b6bff', 0.12, 1)} scale={[1, 0.7, 1.4]}>
            <sphereGeometry args={[0.1, 14, 10]} />
          </mesh>
          <mesh material={gloss('#3a1e14', 0.3, 0.5)} position={[0, 0.02, 0.13]}>
            <sphereGeometry args={[0.05, 10, 8]} />
          </mesh>
        </group>
      );
    case 3:
      return (
        <group>
          <mesh material={jelly('#ffe9f0', 0.5)} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.24, 16]} />
          </mesh>
          <mesh material={gloss('#c8102e', 0.08, 1)} position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.18, 16]} />
          </mesh>
          <mesh material={pattern({ a: '#e3263f', b: '#ffffff', mode: 'swirl', freq: 8, twist: 0 })} position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.04, 16]} />
          </mesh>
        </group>
      );
    case 4:
      return <mesh geometry={cachedGeo('tok-cloud', () => puffGeometry(12, 5, 0.6, 2))} material={marshmallow('#ffffff')} position={[0, 0.12, 0]} scale={0.18} />;
    case 5:
      return (
        <group position={[0, 0.13, 0]}>
          <mesh material={marshmallow('#ffffff')}>
            <sphereGeometry args={[0.11, 14, 10]} />
          </mesh>
          <mesh material={matte('#3b2a3a', 0.6)} position={[0, 0.02, 0.1]}>
            <sphereGeometry args={[0.055, 10, 8]} />
          </mesh>
        </group>
      );
    case 6:
      return (
        <group>
          <mesh material={matte('#ffffff', 0.5)} position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.2, 6]} />
          </mesh>
          <mesh geometry={peppermintSailGeometry()} material={pattern({ a: '#ffffff', b: '#e8253f', mode: 'spiral', freq: 6, twist: 0 })} position={[0, 0.22, 0]} scale={0.2} />
        </group>
      );
    case 7:
      return <mesh geometry={lemonBoatGeometry()} material={vcolorGloss(0.3, 0.6)} position={[0, 0.06, 0]} scale={0.22} />;
    case 8:
      return (
        <mesh material={gloss('#e3182f', 0.25, 0.7)} position={[0, 0.13, 0]}>
          <torusKnotGeometry args={[0.07, 0.025, 48, 8, 2, 3]} />
        </mesh>
      );
    case 9:
      return (
        <group position={[0, 0.11, 0]}>
          <mesh material={jelly('#ffe9a0', 0.85)} scale={[1, 0.75, 1.3]}>
            <sphereGeometry args={[0.1, 14, 10]} />
          </mesh>
          <mesh material={gloss('#1d1430', 0.1, 1)} position={[0.05, 0.02, 0.1]}>
            <sphereGeometry args={[0.015, 8, 6]} />
          </mesh>
          <mesh material={gloss('#1d1430', 0.1, 1)} position={[-0.05, 0.02, 0.1]}>
            <sphereGeometry args={[0.015, 8, 6]} />
          </mesh>
        </group>
      );
    case 10:
      return (
        <group>
          <mesh material={matte('#e7b066', 0.6)} position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.11, 0.12, 0.28, 14]} />
          </mesh>
          <mesh material={gloss('#8a3f1f', 0.4, 0.4)} position={[0, 0.1, 0.11]}>
            <circleGeometry args={[0.06, 14]} />
          </mesh>
          <mesh material={emissive('#ffd36b', 1.2)} position={[0, 0.2, 0.115]}>
            <circleGeometry args={[0.025, 10]} />
          </mesh>
        </group>
      );
    case 11:
      return (
        <group>
          <mesh material={jelly('#fff3c4', 0.5)} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.22, 14]} />
          </mesh>
          <mesh material={emissive('#ffc94d', 2)} position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.035, 8, 6]} />
          </mesh>
          <Glow color="#ffc94d" size={0.35} opacity={0.8} position={[0, 0.12, 0]} />
        </group>
      );
    case 12:
      return (
        <group position={[0, 0.14, 0]}>
          <mesh material={matte('#d58b4a', 0.7)} scale={[1.2, 1, 0.35]}>
            <sphereGeometry args={[0.1, 12, 10]} />
          </mesh>
          <mesh material={matte('#d58b4a', 0.7)} position={[0.09, 0.08, 0]} scale={[0.7, 0.9, 0.35]}>
            <sphereGeometry args={[0.07, 10, 8]} />
          </mesh>
        </group>
      );
    case 13:
      return (
        <group>
          <mesh geometry={gumdropGeometry(16)} material={jelly('#51cf66', 0.8)} scale={0.28} />
          <mesh material={emissive('#d3f9d8', 1.6)} position={[0, 0.09, 0]}>
            <sphereGeometry args={[0.04, 8, 6]} />
          </mesh>
        </group>
      );
    case 14:
      return (
        <group>
          <mesh material={matte('#e6d0ff', 0.5)} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.24, 14]} />
          </mesh>
          <mesh material={pattern({ a: '#ffffff', b: '#9a6bff', mode: 'helix', freq: 6, twist: 1.2 })} position={[0, 0.3, 0]}>
            <coneGeometry args={[0.1, 0.14, 14]} />
          </mesh>
          <mesh material={emissive('#ffd76e', 1.4)} position={[0, 0.14, 0.072]}>
            <planeGeometry args={[0.04, 0.06]} />
          </mesh>
        </group>
      );
    case 15:
      return (
        <group position={[0, 0.06, 0]}>
          <mesh material={gloss('#ffcf33', 0.2, 1)}>
            <cylinderGeometry args={[0.11, 0.1, 0.08, 16, 1, true]} />
          </mesh>
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} material={gloss('#ffcf33', 0.2, 1)} position={[Math.cos((i / 5) * TAU) * 0.1, 0.07, Math.sin((i / 5) * TAU) * 0.1]}>
              <coneGeometry args={[0.025, 0.07, 6]} />
            </mesh>
          ))}
          <mesh material={gloss('#ff4f8a', 0.1, 1)} position={[0, 0.02, 0.11]}>
            <sphereGeometry args={[0.02, 8, 6]} />
          </mesh>
        </group>
      );
  }
  return null;
}

const TOKEN_SOUNDS: SoundName[] = ['tap', 'sparkle', 'squeak', 'splash', 'boing', 'baa', 'whoosh', 'bloop', 'squeak', 'whale', 'knock', 'chime', 'musicBox', 'chime', 'chime', 'fanfare'];

function Slot({ id, earned, position }: { id: number; earned: boolean; position: [number, number, number] }) {
  const g = useRef<THREE.Group>(null!);
  const st = useMemo(() => ({ hop: new Spring(0, 120, 6), spin: 0 }), []);
  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const h = st.hop.update(dt);
    st.spin *= Math.exp(-2 * dt);
    g.current.position.y = Math.max(0, h) * 0.25;
    g.current.rotation.y += dt * (0.3 + st.spin);
    g.current.scale.setScalar(earned ? 1 + Math.sin(state.clock.elapsedTime * 2 + id) * 0.02 : 1);
  });
  const tap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!useGame.getState().shelfFocus) {
      goToShelf();
      return;
    }
    if (!earned) {
      sfx.play('tap');
      return;
    }
    st.hop.kick(8);
    st.spin = 10;
    sfx.play(TOKEN_SOUNDS[id], id % 8);
    burst('sparkle', e.point, { count: 14 });
    if (id % 3 === 0) pipReact('cheer', 1);
    zef.expression = 'happy';
    setTimeout(() => (zef.expression = 'smile'), 900);
  };
  return (
    <group position={position}>
      <mesh material={matte(earned ? '#fff4e0' : '#e9d4c2', 0.6)} position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.04, 18]} />
      </mesh>
      {earned ? (
        <group ref={g}>
          <Token id={id} />
        </group>
      ) : (
        <group ref={g}>
          {/* an empty spot waiting for a keepsake */}
          <mesh material={matte('#d9c2b0', 0.7)} position={[0, 0.08, 0]} scale={[1, 1.25, 1]}>
            <sphereGeometry args={[0.06, 10, 8]} />
          </mesh>
        </group>
      )}
      <mesh visible={false} position={[0, 0.2, 0.05]} onPointerDown={tap}>
        <boxGeometry args={[CELL_W * 0.95, CELL_H * 0.95, 0.5]} />
      </mesh>
    </group>
  );
}

function cabinetGeometry() {
  return cachedGeo('keepsake-cabinet', () => {
    const parts: THREE.BufferGeometry[] = [];
    const W = COLS * CELL_W + 0.2;
    const H = ROWS * CELL_H + 0.2;
    const back = roundedBox(W, H, 0.08, 0.04, 2);
    back.translate(0, H / 2 + 0.25, -0.24);
    parts.push(paint(back, '#b8743d'));
    for (let r = 0; r <= ROWS; r++) {
      const shelf = roundedBox(W, 0.08, 0.5, 0.03, 2);
      shelf.translate(0, 0.25 + 0.06 + r * CELL_H, 0);
      parts.push(paint(shelf, '#d6955a'));
    }
    for (let c = 0; c <= COLS; c++) {
      const side = roundedBox(0.08, H, 0.5, 0.03, 2);
      side.translate(-W / 2 + 0.1 + c * CELL_W, H / 2 + 0.25, 0);
      parts.push(paint(side, '#d6955a'));
    }
    for (const sx of [-1, 1]) {
      const leg = roundedBox(0.14, 0.32, 0.4, 0.05, 2);
      leg.translate(sx * (W / 2 - 0.15), 0.14, 0);
      parts.push(paint(leg, '#a5642f'));
    }
    const sign = extrude(heartShape(0.7), 0.08, 0.03, 12);
    sign.translate(0, H + 0.62, -0.2);
    parts.push(paint(sign, '#ff8fb8'));
    return merge(parts);
  });
}

export function KeepsakeShelf() {
  const journey = useJourney();
  const w = useMemo(() => shelfWorld(), []);
  const W = COLS * CELL_W + 0.2;
  const ref = useRef<THREE.Group>(null);
  useDistanceCull(ref, 45, w.pos, 2);
  return (
    <group ref={ref} position={w.pos} rotation={[0, w.yaw, 0]}>
      <mesh geometry={cabinetGeometry()} material={vcolor(0.65, 'cabinet')} castShadow receiveShadow />
      {Array.from({ length: 15 }, (_, i) => {
        const id = i + 1;
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        return (
          <Slot
            key={id}
            id={id}
            earned={journey.keepsakes.has(id)}
            position={[-W / 2 + 0.1 + CELL_W / 2 + c * CELL_W, 0.25 + 0.1 + (ROWS - 1 - r) * CELL_H, 0.02]}
          />
        );
      })}
      <mesh
        visible={false}
        position={[0, 1.2, 0.2]}
        onPointerDown={(e) => {
          if (useGame.getState().shelfFocus) return;
          e.stopPropagation();
          goToShelf();
        }}
      >
        <boxGeometry args={[W + 0.4, 2.6, 0.9]} />
      </mesh>
    </group>
  );
}

