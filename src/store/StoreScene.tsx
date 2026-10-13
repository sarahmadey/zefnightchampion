// Inside the Underpants Store: a bright little shop with a striped floor,
// bunting, a show-off stage with a spotlight, and six pairs of dino
// underpants twirling on pedestals. Zef taps the pair he wants.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneEnv } from '../three/SceneEnv';
import { buildUnderpants } from '../dino/accessories';
import { UNDERPANTS } from '../game/rewards';
import { cachedGeo, lathe, roundedBox } from '../three/geometry';
import { Glow } from '../three/bits';
import { Dino } from '../dino/Dino';
import { coach, hero, frameDt } from '../game/actors';
import { useGame, useSave } from '../state/store';
import { DINO_COLORS } from '../game/rewards';
import { COACH_COLOR, useOutfit } from '../board/Board';
import { pickUnderpantsTap } from '../game/director';
import { sharedTime } from '../three/shaders';
import { quality } from '../game/quality';

export const STORE_ORIGIN = new THREE.Vector3(0, 0, 400);

/** Where pair `i` sits: two rows of three, the back row raised up. */
export function pedestalPos(i: number): THREE.Vector3 {
  const row = i < 3 ? 0 : 1;
  const col = i % 3;
  return new THREE.Vector3(STORE_ORIGIN.x + (col - 1) * (row ? 1.9 : 1.75), STORE_ORIGIN.y, STORE_ORIGIN.z + (row ? -2.7 : -0.9));
}

export function pedestalHeight(i: number): number {
  return i < 3 ? 1 : 1.75;
}

const floorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.BackSide });
const pedMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, clearcoat: 0.8 });
const goldMat = new THREE.MeshPhysicalMaterial({ color: '#ffc63a', metalness: 0.8, roughness: 0.25 });
const stageMat = new THREE.MeshPhysicalMaterial({ color: '#ff8fc7', roughness: 0.4, clearcoat: 0.6 });

function floorGeo() {
  return cachedGeo('store-floor', () => {
    const g = new THREE.CircleGeometry(9, 64);
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    const a = new THREE.Color('#fff0d9');
    const b = new THREE.Color('#ffd9a8');
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const ang = Math.atan2(p.getZ(i), p.getX(i));
      c.copy(Math.floor((ang + Math.PI) / (Math.PI / 12)) % 2 ? a : b);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
}

function wallGeo() {
  return cachedGeo('store-wall', () => {
    const g = new THREE.CylinderGeometry(9, 9, 7, 64, 1, true);
    g.translate(0, 3.5, 0);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    const a = new THREE.Color('#a5d8ff');
    const b = new THREE.Color('#d0ebff');
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const ang = Math.atan2(p.getZ(i), p.getX(i));
      c.copy(Math.floor((ang + Math.PI) / (Math.PI / 20)) % 2 ? a : b);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
}

function Pedestal({ i }: { i: number }) {
  const pants = useMemo(() => buildUnderpants(UNDERPANTS[i]), [i]);
  const spin = useRef<THREE.Group>(null!);
  const st = useRef({ t: i });
  const p = pedestalPos(i);
  const picked = useSave((s) => s.data.underpants.pick);
  const inStoreEvent = useGame((s) => s.awaiting === 'store-pick');
  const h = pedestalHeight(i);
  useFrame((_, raw) => {
    st.current.t += frameDt(raw);
    spin.current.rotation.y = Math.sin(st.current.t * 0.8) * 0.6;
    spin.current.position.y = h + 0.5 + Math.sin(st.current.t * 2) * 0.06;
    const s = picked === i && !inStoreEvent ? 0.001 : 0.85;
    spin.current.scale.setScalar(s);
  });
  return (
    <group position={p}>
      <mesh geometry={cachedGeo('pedestal', () => lathe([[0, 0], [0.5, 0], [0.42, 0.12], [0.32, 0.2], [0.32, 0.9], [0.45, 1.0], [0, 1.02]], 24, 10))} material={pedMat} scale={[1, h, 1]} castShadow receiveShadow />
      <mesh material={goldMat} position={[0, h, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.44, 0.03, 8, 32]} />
      </mesh>
      <group ref={spin} position={[0, h + 0.5, 0]}>
        <primitive object={pants} />
      </group>
      <Glow color={UNDERPANTS[i].accent} size={1.9} opacity={0.35} position={[0, h + 0.5, 0]} />
      <mesh
        position={[0, h + 0.35, 0]}
        visible={false}
        onPointerDown={(e) => {
          e.stopPropagation();
          pickUnderpantsTap(i);
        }}
      >
        <sphereGeometry args={[0.8, 10, 8]} />
      </mesh>
    </group>
  );
}

function Bunting() {
  const flags = useMemo(() => {
    const out: { pos: THREE.Vector3; rot: number; color: string }[] = [];
    const colors = ['#ff6b6b', '#ffd43b', '#51cf66', '#4dabf7', '#cc5de8'];
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 18; i++) {
        const a = -1.5 + (i / 17) * 3;
        const sag = Math.sin((i / 17) * Math.PI) * 0.5;
        out.push({
          pos: new THREE.Vector3(Math.sin(a) * (8.6 - r * 0.2), 5.6 - sag - r * 0.7, -Math.cos(a) * (8.6 - r * 0.2)),
          rot: -a,
          color: colors[(i + r) % colors.length],
        });
      }
    }
    return out;
  }, []);
  return (
    <group position={STORE_ORIGIN}>
      {flags.map((f, i) => (
        <mesh key={i} position={f.pos} rotation={[0, f.rot, Math.PI]}>
          <coneGeometry args={[0.22, 0.45, 3]} />
          <meshStandardMaterial color={f.color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Spot() {
  const ref = useRef<THREE.SpotLight>(null!);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.copy(STORE_ORIGIN).add(new THREE.Vector3(0, 0, 1.6));
    return o;
  }, []);
  useFrame(() => {
    ref.current.intensity = 60 + Math.sin(sharedTime.value * 2) * 8;
  });
  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={ref}
        position={[STORE_ORIGIN.x, 7, STORE_ORIGIN.z + 4]}
        target={target}
        angle={0.45}
        penumbra={0.6}
        color="#fff4d6"
        castShadow={quality.shadows}
        shadow-mapSize={[1024, 1024]}
      />
    </>
  );
}

export function StoreScene() {
  const profile = useSave((s) => s.data.profile);
  const pick = useSave((s) => s.data.underpants.pick);
  const showPants = useGame((s) => s.showUnderpants);
  const previewPants = useGame((s) => s.previewUnderpants);
  const outfit = useOutfit();
  const color = DINO_COLORS[profile.color] ?? DINO_COLORS[0];
  return (
    <>
      <SceneEnv background="#ffe8f0" />
      <hemisphereLight args={['#fff8f0', '#ffc9de', 1.4]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[STORE_ORIGIN.x + 3, 8, STORE_ORIGIN.z + 6]} intensity={1.6} />
      <Spot />
      <group position={STORE_ORIGIN}>
        <mesh geometry={floorGeo()} material={floorMat} receiveShadow />
        <mesh geometry={wallGeo()} material={wallMat} />
        <mesh material={stageMat} position={[0, 0.06, 1.6]} receiveShadow>
          <cylinderGeometry args={[1.5, 1.6, 0.12, 40]} />
        </mesh>
        <mesh geometry={cachedGeo('store-counter', () => roundedBox(2.6, 1.1, 0.8, 0.12))} material={pedMat} position={[-5.6, 0.55, 2.6]} rotation={[0, 0.9, 0]} castShadow />
      </group>
      <Bunting />
      {UNDERPANTS.map((_, i) => (
        <Pedestal key={i} i={i} />
      ))}
      <Dino actor={hero} species={profile.species} color={color} outfit={outfit} underpants={previewPants ?? (showPants ? pick : null)} />
      <Dino actor={coach} species="trex" color={COACH_COLOR} coach />
    </>
  );
}
