// Scene-level background and fog. (`attach="fog"` on an element nested in a
// group attaches to that group, not the scene — so set them directly here.)

import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export function SceneEnv({
  background,
  fog,
}: {
  background?: THREE.ColorRepresentation;
  fog?: { color: THREE.ColorRepresentation; density?: number; near?: number; far?: number };
}) {
  const scene = useThree((s) => s.scene);
  const fogKey = fog ? `${String(fog.color)}|${fog.density}|${fog.near}|${fog.far}` : '';
  useLayoutEffect(() => {
    const prevBg = scene.background;
    const prevFog = scene.fog;
    scene.background = background !== undefined ? new THREE.Color(background) : null;
    if (fog) {
      scene.fog =
        fog.density !== undefined
          ? new THREE.FogExp2(new THREE.Color(fog.color).getHex(), fog.density)
          : new THREE.Fog(new THREE.Color(fog.color).getHex(), fog.near ?? 10, fog.far ?? 100);
    } else scene.fog = null;
    return () => {
      scene.background = prevBg;
      scene.fog = prevFog;
    };
    // fogKey captures the fog settings
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, background, fogKey]);
  return null;
}
