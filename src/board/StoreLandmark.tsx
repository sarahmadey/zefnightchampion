// The Underpants Store, far away on its own mesa at the horizon of every
// land: a cheerful little shop with a giant pair of underpants on the roof
// and a flag of underpants flapping above. Its windows light up as the
// underpants meter fills.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cachedGeo, lathe, roundedBox } from '../three/geometry';
import { buildUnderpants } from '../dino/accessories';
import { UNDERPANTS } from '../game/rewards';
import { Glow } from '../three/bits';
import { sharedTime } from '../three/shaders';

const wallMat = new THREE.MeshStandardMaterial({ color: '#fff4e6', roughness: 0.8 });
const roofMat = new THREE.MeshStandardMaterial({ color: '#4dabf7', roughness: 0.6 });
const trimMat = new THREE.MeshStandardMaterial({ color: '#ff6b9a', roughness: 0.6 });
const mesaMat = new THREE.MeshStandardMaterial({ color: '#c8a27a', roughness: 0.9 });
const grassMat = new THREE.MeshStandardMaterial({ color: '#7fd16a', roughness: 0.9 });
const poleMat = new THREE.MeshStandardMaterial({ color: '#dee2e6', roughness: 0.4, metalness: 0.4 });

export function StoreBuilding({ glow = 0.5 }: { glow?: number }) {
  const sign = useMemo(() => {
    const u = buildUnderpants(UNDERPANTS[0]);
    u.scale.setScalar(2.2);
    return u;
  }, []);
  const flag = useMemo(() => {
    const u = buildUnderpants(UNDERPANTS[1]);
    u.scale.setScalar(0.9);
    return u;
  }, []);
  const flagRef = useRef<THREE.Group>(null!);
  const winMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffe8a3', emissive: new THREE.Color('#ffd43b'), emissiveIntensity: 0.4 + glow, toneMapped: false }), [glow]);
  useFrame(() => {
    const t = sharedTime.value;
    if (flagRef.current) {
      flagRef.current.rotation.y = Math.sin(t * 2.2) * 0.35;
      flagRef.current.rotation.z = Math.sin(t * 3.1) * 0.08;
    }
    winMat.emissiveIntensity = 0.4 + glow + Math.sin(t * 2) * 0.1 * glow;
  });
  return (
    <group>
      <mesh geometry={cachedGeo('store-walls', () => roundedBox(6, 3.6, 4.4, 0.25))} material={wallMat} position={[0, 1.8, 0]} />
      <mesh material={roofMat} position={[0, 4.1, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[4.8, 2.2, 4]} />
      </mesh>
      <mesh geometry={cachedGeo('store-awning', () => roundedBox(6.4, 0.25, 1.4, 0.1))} material={trimMat} position={[0, 2.9, 2.5]} rotation={[0.35, 0, 0]} />
      {[-1.7, 1.7].map((x) => (
        <mesh key={x} geometry={cachedGeo('store-window', () => roundedBox(1.3, 1.1, 0.1, 0.12))} material={winMat} position={[x, 1.8, 2.22]} />
      ))}
      <mesh geometry={cachedGeo('store-door', () => roundedBox(1.2, 2.0, 0.12, 0.3))} material={trimMat} position={[0, 1.0, 2.22]} />
      <primitive object={sign} position={[0, 5.9, 0.6]} rotation={[0.15, 0, 0]} />
      <mesh material={poleMat} position={[2.6, 6.0, -1.2]}>
        <cylinderGeometry args={[0.07, 0.07, 6.5, 8]} />
      </mesh>
      <group ref={flagRef} position={[2.6, 8.6, -1.2]}>
        <primitive object={flag} position={[0.9, 0, 0]} />
      </group>
      <Glow color="#fff1a8" size={14} opacity={0.25 * glow + 0.1} position={[0, 4, 0]} />
    </group>
  );
}

/** The store as a far-off landmark on a mesa. */
export function StoreLandmark({ position, meterFrac }: { position: THREE.Vector3; meterFrac: number }) {
  const mesa = useMemo(
    () =>
      cachedGeo('store-mesa', () =>
        lathe(
          [
            [0, -14],
            [9, -14],
            [8, -6],
            [7.2, -1],
            [6.8, -0.1],
            [0, 0],
          ],
          28,
          10,
        ),
      ),
    [],
  );
  return (
    <group position={position}>
      <mesh geometry={mesa} material={mesaMat} />
      <mesh material={grassMat} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6.8, 28]} />
      </mesh>
      <group scale={0.95}>
        <StoreBuilding glow={meterFrac} />
      </group>
    </group>
  );
}
