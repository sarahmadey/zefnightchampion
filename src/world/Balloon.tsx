// Once the castle has been earned, a striped candy hot-air balloon waits by
// the cottage. Tapping it flies Zef and Pip over the whole candy world to the
// castle, even after the active journey has started over.

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { cachedGeo, lathe, merge, paint, waffleGrid } from '../three/geometry';
import { gloss, pattern, vcolor } from '../three/materials';
import { Glow } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { cam, pip, zef } from '../game/actors';
import { stopLocalToWorld } from '../game/route';
import { useGame, useSave } from '../state/store';
import { balloonTrip } from '../game/director';
import { CASTLE_POS } from './Castle';
import { stopWorldPoints } from './stopDefs';

const DOCK_LOCAL: [number, number, number] = [-4.4, 0, 2.6];

function envelopeGeometry() {
  return cachedGeo('balloon-envelope', () =>
    lathe(
      [
        [0.25, 0],
        [0.5, 0.2],
        [1.2, 0.9],
        [1.55, 1.7],
        [1.58, 2.4],
        [1.35, 3.0],
        [0.8, 3.4],
        [0, 3.52],
      ],
      32,
      24,
    ),
  );
}

function basketGeometry() {
  return cachedGeo('balloon-basket', () => {
    const g = lathe(
      [
        [0, 0],
        [0.5, 0],
        [0.6, 0.55],
        [0.66, 0.6],
        [0.6, 0.62],
        [0.55, 0.12],
        [0, 0.12],
      ],
      28,
      20,
    );
    waffleGrid(g, 0.12, 0.02, '#f0c070', '#c98a3a');
    const ropes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const r = new THREE.CylinderGeometry(0.015, 0.015, 1.3, 4);
      r.translate(Math.cos(a) * 0.55, 1.25, Math.sin(a) * 0.55);
      ropes.push(paint(r, '#fff4e0'));
    }
    return merge([g, ...ropes]);
  });
}

export function Balloon() {
  const scene = useGame((s) => s.scene);
  const preview = useGame((s) => s.preview);
  const castleUnlocked = useSave((s) => s.data.castleUnlocked);
  const unlocked = scene === 'world' && castleUnlocked && !preview;
  const g = useRef<THREE.Group>(null!);
  const dock = useMemo(() => stopLocalToWorld(0, DOCK_LOCAL), []);
  const st = useMemo(() => ({ flying: false, u: 0 }), []);
  const envMat = useMemo(() => pattern({ a: '#ffffff', b: '#ff6fa5', mode: 'helix', freq: 10, twist: 0, roughness: 0.45, clearcoat: 0.4 }), []);

  // flight path: up from the cottage, over the regions, down to the castle gate
  const path = useMemo(() => {
    const gate = stopWorldPoints(15).zef;
    return new THREE.CatmullRomCurve3([
      dock.clone(),
      dock.clone().add(new THREE.Vector3(0, 6, -4)),
      new THREE.Vector3(-8, 22, -40),
      new THREE.Vector3(8, 26, -80),
      new THREE.Vector3(-6, 24, -118),
      CASTLE_POS.clone().add(new THREE.Vector3(4, 14, 20)),
      gate.clone().add(new THREE.Vector3(1.5, 0, 1.5)),
    ]);
  }, [dock]);

  useFrame((state) => {
    if (!g.current) return;
    const t = state.clock.elapsedTime;
    if (!st.flying) {
      g.current.position.set(dock.x, dock.y + Math.sin(t * 1.2) * 0.06, dock.z);
      g.current.rotation.y = Math.sin(t * 0.4) * 0.1;
    }
  });

  const fly = (u: number) => {
    st.flying = true;
    st.u = u;
    const p = path.getPointAt(u);
    const ahead = path.getPointAt(Math.min(1, u + 0.02));
    g.current.position.copy(p);
    g.current.rotation.y = Math.atan2(ahead.x - p.x, ahead.z - p.z);
    zef.pos.set(p.x, p.y + 0.12, p.z + 0.1);
    pip.pos.set(p.x - 0.25, p.y + 0.15, p.z - 0.1);
    zef.heading = g.current.rotation.y;
    pip.heading = g.current.rotation.y;
    // the camera rides alongside
    const side = new THREE.Vector3(Math.cos(g.current.rotation.y), 0, -Math.sin(g.current.rotation.y));
    cam.mode = 'shot';
    cam.pos.copy(p).addScaledVector(side, -6).add(new THREE.Vector3(0, 2.5, 0)).addScaledVector(new THREE.Vector3(ahead.x - p.x, 0, ahead.z - p.z).normalize(), -5);
    cam.target.copy(p).add(new THREE.Vector3(0, 1.5, 0));
    cam.lambda = 3;
    cam.fitWidth = 0;
    if (Math.random() < 0.08) burst('sparkle', p.clone().add(new THREE.Vector3(0, 0.3, 0)), { count: 2, size: 0.15 });
    if (u >= 1) st.flying = false;
  };

  const tap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const gs = useGame.getState();
    if (gs.cutscene || st.flying) return;
    sfx.play('whoosh');
    burst('sparkle', e.point, { count: 16 });
    void balloonTrip(fly);
  };

  if (!unlocked) return null;
  return (
    <group ref={g}>
      <mesh geometry={basketGeometry()} material={vcolor(0.6, 'basket')} castShadow />
      <group position={[0, 1.85, 0]}>
        <mesh geometry={envelopeGeometry()} material={envMat} castShadow />
        <mesh material={gloss('#ffd23f', 0.3, 0.6)} position={[0, 3.55, 0]}>
          <sphereGeometry args={[0.18, 12, 10]} />
        </mesh>
      </group>
      <Glow color="#ffb36b" size={0.9} opacity={0.7} position={[0, 1.95, 0]} />
      <mesh visible={false} position={[0, 2.4, 0]} onPointerDown={tap}>
        <cylinderGeometry args={[1.8, 1.2, 5, 12]} />
      </mesh>
    </group>
  );
}
