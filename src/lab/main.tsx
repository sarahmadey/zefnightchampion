// Dev-only turntable for looking at one dinosaur under studio lights.
// /lab.html?species=trex&color=0&coach=1&view=34&action=none
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { Dino } from '../dino/Dino';
import { makeActor, play, type DinoAction } from '../game/actors';
import { ACCESSORIES, DINO_COLORS, type Species } from '../game/rewards';

const q = new URLSearchParams(location.search);
const species = (q.get('species') ?? 'trex') as Species;
const color = DINO_COLORS[Number(q.get('color') ?? 0)];
const coach = q.get('coach') === '1';
// ?outfit=0,1,3 (accessory indices) and ?pants=2 (underpants design)
const outfit = q.get('outfit') ? Object.fromEntries(q.get('outfit')!.split(',').map((i) => [ACCESSORIES[Number(i)].slot, Number(i)])) : undefined;
const pants = q.get('pants') !== null ? Number(q.get('pants')) : null;
const actor = makeActor(0, 0);
actor.heading = 0;
const action = q.get('action');
if (action && action !== 'none') play(actor, action as DinoAction, 99, true);

const VIEWS: Record<string, [number, number, number, number]> = {
  // azimuth (deg from front), elevation (deg), distance, target height
  front: [0, 8, 3.2, 0.72],
  '34': [35, 12, 3.2, 0.72],
  side: [90, 6, 3.4, 0.68],
  back: [160, 15, 3.4, 0.7],
  face: [25, 6, 1.25, 1.17],
  feet: [40, 10, 1.4, 0.2],
  top: [30, 55, 3.4, 0.6],
};

function Rig() {
  const { camera } = useThree();
  useEffect(() => {
    const set = (v: string) => {
      const [az, el, dist, ty] = VIEWS[v] ?? VIEWS['34'];
      const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
      camera.position.set(Math.sin(a) * Math.cos(e) * dist, ty + Math.sin(e) * dist, Math.cos(a) * Math.cos(e) * dist);
      camera.lookAt(0, ty, 0);
    };
    set(q.get('view') ?? '34');
    (window as unknown as { __lab: unknown }).__lab = { setView: set, actor };
  }, [camera]);
  return null;
}

function Lab() {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, near: 0.05, far: 50 }} gl={{ antialias: true }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
      <color attach="background" args={['#cfd8cf']} />
      <hemisphereLight args={['#f2f6ff', '#6b7a5c', 1.1]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-2} shadow-camera-right={2} shadow-camera-top={2} shadow-camera-bottom={-2} />
      <directionalLight position={[-3, 2, -2]} intensity={0.8} color="#cfe3ff" />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[4, 48]} />
        <meshStandardMaterial color="#b9c4ae" roughness={0.9} />
      </mesh>
      <Dino actor={actor} species={species} color={color} coach={coach} outfit={outfit} underpants={pants} />
      <Rig />
    </Canvas>
  );
}

const t0 = performance.now();
createRoot(document.getElementById('root')!).render(<Lab />);
requestAnimationFrame(() => console.log(`lab ready ${Math.round(performance.now() - t0)}ms`));
