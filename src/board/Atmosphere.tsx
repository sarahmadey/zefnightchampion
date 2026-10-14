// Sky, fog, clouds and sunlight for the board. Colours ease from one land's
// mood to the next as Zef crosses a bridge. The sun's shadow follows the dino.

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeSkyMaterial } from '../three/shaders';
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

/** A soft, wispy cloud painted from many feathered puffs, with a cooler underside. */
function cloudTexture(seed: number): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const rng = mulberry32(seed);
  for (let i = 0; i < 70; i++) {
    const spread = 0.35 + rng() * 0.65;
    const x = 128 + (rng() - 0.5) * 190 * spread;
    const lift = 1 - Math.abs(x - 128) / 128;
    const y = 78 - rng() * 42 * lift;
    const r = 14 + rng() * 26 * (0.6 + lift * 0.6);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.32)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // shade the underside where the puffs are
  g.globalCompositeOperation = 'source-atop';
  const shade = g.createLinearGradient(0, 30, 0, 100);
  shade.addColorStop(0, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(176,192,222,0.55)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft clouds that drift by and travel with the camera. */
function Clouds() {
  const camera = useThree((s) => s.camera);
  const group = useRef<THREE.Group>(null!);
  const data = useMemo(() => {
    const rng = mulberry32(42);
    const textures = [0, 1, 2].map((i) => cloudTexture(300 + i * 17));
    return Array.from({ length: 14 }, (_, i) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[i % 3], transparent: true, depthWrite: false, fog: false, opacity: 0.95 }));
      sprite.renderOrder = -5;
      sprite.raycast = () => null;
      return {
        sprite,
        x: randRange(rng, -140, 140),
        y: randRange(rng, 30, 60),
        z: randRange(rng, -180, -40),
        s: randRange(rng, 9, 18),
        speed: randRange(rng, 0.3, 0.9),
      };
    });
  }, []);
  useEffect(() => {
    const g = group.current;
    for (const c of data) g.add(c.sprite);
    return () => {
      for (const c of data) g.remove(c.sprite);
    };
  }, [data]);
  useFrame((_, raw) => {
    const dt = frameDt(raw) * (motion.reduced ? 0.3 : 1);
    for (const c of data) {
      c.x += c.speed * dt;
      if (c.x > 160) c.x = -160;
      c.sprite.position.set(c.x, c.y, camera.position.z + c.z);
      c.sprite.scale.set(c.s * 3.2, c.s * 1.6, 1);
    }
  });
  return <group ref={group} />;
}
