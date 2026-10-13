// The first-time stage: four dinos line up under a spotlight and Zef taps
// the one that is him (T. rex, triceratops, stegosaurus or long-neck), then
// picks its colour.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { SceneEnv } from '../three/SceneEnv';
import { Dino } from '../dino/Dino';
import { type DinoActor, play } from '../game/actors';
import { DINO_COLORS, SPECIES, type Species } from '../game/rewards';
import { useGame, useSave } from '../state/store';
import { setupPickSpecies } from '../game/director';
import { cachedGeo, lathe } from '../three/geometry';
import { fernGeometry, palmGeometry, bushGeometry } from '../board/props';
import { Glow } from '../three/bits';

export const SETUP_ORIGIN = new THREE.Vector3(0, 0, -800);

export const lineup: Record<Species, DinoActor> = Object.fromEntries(
  SPECIES.map((s, i) => [
    s.id,
    {
      pos: new THREE.Vector3(SETUP_ORIGIN.x + (i - 1.5) * 1.62, 0.12, SETUP_ORIGIN.z),
      heading: 0,
      air: 0,
      stretch: 1,
      action: { name: 'none', t: 0, dur: 0, loop: false },
      expression: 'smile',
      look: null,
      talk: 0,
      walk: 0,
      visible: true,
      scale: 1,
      glow: 0,
      hand: new THREE.Vector3(),
    } satisfies DinoActor,
  ]),
) as Record<Species, DinoActor>;

const stageMat = new THREE.MeshPhysicalMaterial({ color: '#8fd16a', roughness: 0.8 });
const rimMat = new THREE.MeshPhysicalMaterial({ color: '#ffd43b', roughness: 0.4, clearcoat: 0.6 });
const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });

export function SetupStage() {
  const step = useGame((s) => s.setupStep);
  const species = useSave((s) => s.data.profile.species);
  const colorIdx = useSave((s) => s.data.profile.color);
  const chosenOnly = step === 'color';
  useEffect(() => {
    SPECIES.forEach((s, i) => {
      const a = lineup[s.id];
      a.visible = !chosenOnly || s.id === species;
      a.pos.set(SETUP_ORIGIN.x + (chosenOnly ? 0 : (i - 1.5) * 1.62), 0.12, SETUP_ORIGIN.z);
      a.scale = chosenOnly ? 1.5 : 1.3;
      a.heading = 0;
    });
  }, [chosenOnly, species]);
  const scenery = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; pos: [number, number, number]; s: number; r: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const a = -1.3 + i * 0.43;
      out.push({ geo: i % 2 ? palmGeometry(i % 3) : bushGeometry(i), pos: [SETUP_ORIGIN.x + Math.sin(a) * 7, 0, SETUP_ORIGIN.z - Math.cos(a) * 5 - 1], s: i % 2 ? 1 : 1.4, r: i });
    }
    for (let i = 0; i < 6; i++) out.push({ geo: fernGeometry(), pos: [SETUP_ORIGIN.x - 4.5 + i * 1.8, 0, SETUP_ORIGIN.z - 2.6], s: 0.9, r: i * 2 });
    return out;
  }, []);
  return (
    <>
      <SceneEnv background="#bfe6ff" fog={{ color: '#d8f0ff', density: 0.02 }} />
      <hemisphereLight args={['#f0faff', '#6fae4a', 1.4]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[SETUP_ORIGIN.x + 3, 8, SETUP_ORIGIN.z + 6]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <group position={SETUP_ORIGIN}>
        <mesh geometry={cachedGeo('setup-stage', () => lathe([[0, 0], [4.6, 0], [4.8, 0.06], [4.7, 0.12], [0, 0.12]], 48, 6))} material={stageMat} receiveShadow />
        <mesh material={rimMat} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[4.65, 0.08, 8, 64]} />
        </mesh>
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[40, 32]} />
          <meshStandardMaterial color="#7cc96b" roughness={1} />
        </mesh>
      </group>
      {scenery.map((s, i) => (
        <mesh key={i} geometry={s.geo} material={vc} position={s.pos} scale={s.s} rotation={[0, s.r, 0]} />
      ))}
      {SPECIES.map((s) => (
        <group key={s.id}>
          <Dino
            actor={lineup[s.id]}
            species={s.id}
            color={DINO_COLORS[chosenOnly || s.id === species ? colorIdx : 0]}
            onTap={() => {
              if (useGame.getState().setupStep !== 'dino') {
                play(lineup[s.id], 'giggle', 0.8);
                return;
              }
              setupPickSpecies(s.id);
            }}
            hit={0.9}
          />
        </group>
      ))}
      <Glow color="#fff6c2" size={4} opacity={0.35} position={[SETUP_ORIGIN.x, 1.6, SETUP_ORIGIN.z + 0.5]} />
    </>
  );
}
