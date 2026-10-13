// Sky, fog, clouds and sunlight for the board. Colours ease from one land's
// mood to the next as Zef crosses a bridge. The sun's shadow follows the dino.

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeSkyMaterial } from '../three/shaders';
import { cachedGeo, puffGeometry } from '../three/geometry';
import { themeFor, type Theme } from './themes';
import { hero, frameDt } from '../game/actors';
import { quality } from '../game/quality';
import { mulberry32, randRange } from '../three/util';
import { motion } from '../game/settings';

export const SUN_DIR = new THREE.Vector3(0.45, 0.75, 0.35).normalize();

function lerpColor(target: THREE.Color, to: string, k: number) {
  target.lerp(tmp.set(to), k);
}
const tmp = new THREE.Color();

export function Atmosphere({ theme: themeOverride, land }: { land: number; theme?: Theme }) {
  const theme = themeOverride ?? themeFor(land);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const sky = useMemo(
    () => makeSkyMaterial({ zenith: theme.sky.zenith, mid: theme.sky.mid, horizon: theme.sky.horizon, ground: theme.sky.ground, sun: theme.sky.sun, sunDir: SUN_DIR }),
    // the material is created once and eased toward each new theme
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const skyRef = useRef<THREE.Mesh>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const sun = useRef<THREE.DirectionalLight>(null!);
  const target = useMemo(() => new THREE.Object3D(), []);
  const fog = useMemo(() => new THREE.FogExp2(new THREE.Color(theme.fog).getHex(), 0.011), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const prevFog = scene.fog;
    const prevBg = scene.background;
    scene.fog = fog;
    scene.background = new THREE.Color(theme.fog);
    return () => {
      scene.fog = prevFog;
      scene.background = prevBg;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, fog]);

  useLayoutEffect(() => {
    scene.add(target);
    return () => {
      scene.remove(target);
    };
  }, [scene, target]);

  useFrame((_, raw) => {
    const dt = frameDt(raw);
    const k = 1 - Math.exp(-dt * 1.2);
    const u = sky.uniforms;
    lerpColor(u.zenith.value, theme.sky.zenith, k);
    lerpColor(u.mid.value, theme.sky.mid, k);
    lerpColor(u.horizon.value, theme.sky.horizon, k);
    lerpColor(u.ground.value, theme.sky.ground, k);
    lerpColor(u.sunColor.value, theme.sky.sun, k);
    lerpColor(fog.color, theme.fog, k);
    if (scene.background instanceof THREE.Color) scene.background.copy(fog.color);
    if (hemi.current) {
      lerpColor(hemi.current.color, theme.hemi[0], k);
      lerpColor(hemi.current.groundColor, theme.hemi[1], k);
    }
    if (sun.current) {
      lerpColor(sun.current.color, theme.sun, k);
      sun.current.intensity += (theme.sunIntensity - sun.current.intensity) * k;
      // the shadow box follows the dino
      sun.current.position.copy(hero.pos).addScaledVector(SUN_DIR, 30);
      target.position.copy(hero.pos);
      sun.current.target = target;
    }
    skyRef.current.position.copy(camera.position);
  });

  return (
    <>
      <mesh ref={skyRef} material={sky} frustumCulled={false} renderOrder={-10} raycast={() => null}>
        <sphereGeometry args={[480, 32, 20]} />
      </mesh>
      <hemisphereLight ref={hemi} args={[theme.hemi[0], theme.hemi[1], 1.25]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        ref={sun}
        intensity={theme.sunIntensity}
        color={theme.sun}
        castShadow={quality.shadows}
        shadow-mapSize={[quality.shadowSize, quality.shadowSize]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />
      <Clouds />
    </>
  );
}

function cloudGeo(i: number) {
  return cachedGeo(`bcloud-${i}`, () => {
    const g = puffGeometry(200 + i * 7, 9, 1.6, 2);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const top = new THREE.Color('#ffffff');
    const under = new THREE.Color('#dfe9ff');
    const c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      c.copy(under).lerp(top, THREE.MathUtils.smoothstep(pos.getY(k), -0.3, 0.45));
      col[k * 3] = c.r;
      col[k * 3 + 1] = c.g;
      col[k * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
}

const cloudMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.35, fog: false });

/** Soft clouds that drift by and travel with the camera. */
function Clouds() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const camera = useThree((s) => s.camera);
  const data = useMemo(() => {
    const rng = mulberry32(42);
    return Array.from({ length: 14 }, () => ({
      x: randRange(rng, -140, 140),
      y: randRange(rng, 30, 60),
      z: randRange(rng, -180, -40),
      s: randRange(rng, 7, 14),
      speed: randRange(rng, 0.3, 0.9),
    }));
  }, []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  useFrame((_, raw) => {
    const dt = frameDt(raw) * (motion.reduced ? 0.3 : 1);
    data.forEach((c, i) => {
      c.x += c.speed * dt;
      if (c.x > 160) c.x = -160;
      m.compose(new THREE.Vector3(c.x, c.y, camera.position.z + c.z), q, new THREE.Vector3(c.s * 1.6, c.s * 0.7, c.s));
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[cloudGeo(0), cloudMat, data.length]} frustumCulled={false} raycast={() => null} />;
}
