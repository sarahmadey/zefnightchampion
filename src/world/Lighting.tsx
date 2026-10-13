// Warm late-afternoon light with soft shadows that follow Zef around the world.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { zef } from '../game/actors';
import { SKY } from './Sky';

export function WorldLights({ shadowSize = 2048 }: { shadowSize?: number }) {
  const light = useRef<THREE.DirectionalLight>(null!);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const c = zef.pos;
    // snap the shadow frustum to texels so shadows don't shimmer while walking
    const snap = 0.25;
    const x = Math.round(c.x / snap) * snap;
    const z = Math.round(c.z / snap) * snap;
    light.current.position.set(x + 16, c.y + 24, z - 5);
    target.position.set(x, c.y, z);
    target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight args={['#fff3ea', '#c4a3d9', 1.35]} />
      <ambientLight intensity={0.18} color="#ffe6f2" />
      <directionalLight
        ref={light}
        intensity={2.5}
        color="#fff0d6"
        castShadow
        target={target}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-17}
        shadow-camera-right={17}
        shadow-camera-top={17}
        shadow-camera-bottom={-17}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
        shadow-radius={3}
      />
      <primitive object={target} />
      <fogExp2 attach="fog" args={[SKY.fog, 0.0042]} />
    </>
  );
}
