// The explorable candy world: sky, terrain, path, cottage, castle, path
// lights, region decorations and all fifteen surprises.

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WorldLights } from './Lighting';
import { Clouds, FarHills, Rainbow, SkyDome } from './Sky';
import { Terrain } from './Terrain';
import { CandyPath } from './Path';
import { Cottage } from './Cottage';
import { Castle } from './Castle';
import { PathLights } from './PathLights';
import { Garden } from './regions/Garden';
import { Meadow } from './regions/Meadow';
import { River } from './regions/River';
import { Woods } from './regions/Woods';
import { Mountain } from './regions/Mountain';
import { Stops } from '../stops/Stops';
import { KeepsakeShelf } from './Keepsakes';
import { Balloon } from './Balloon';
import { stopWorldPoints } from './stopDefs';
import { useGame, useJourney } from '../state/store';
import { handleGroundTap, handleLightTap } from '../game/world';
import { updatePip, updateZef, worldFloor } from '../game/nav';
import { frameDt } from '../game/actors';
import { useEffect } from 'react';
import { bus } from '../game/bus';
import { burst } from '../three/Particles';
import { CASTLE_POS } from './Castle';

function Fireworks() {
  useEffect(
    () =>
      bus.on('fireworks', (k: number) => {
        const colors = [
          ['#ffd43b', '#ff6b8b', '#fff3bf'],
          ['#74c0fc', '#b197fc', '#e5dbff'],
          ['#69db7c', '#ffd43b', '#d3f9d8'],
          ['#ff8787', '#ffa94d', '#ffe8cc'],
        ][k % 4];
        const p = CASTLE_POS.clone().add(new THREE.Vector3((Math.random() - 0.5) * 18, 20 + Math.random() * 8, (Math.random() - 0.5) * 8));
        burst('sparkle', p, { count: 46, speed: 7, up: 0.5, gravity: -1.2, life: 1.9, size: 0.42, colors, spread: 1.2 });
        burst('confetti', p, { count: 20, speed: 5, up: 1, colors });
      }),
    [],
  );
  return null;
}

function WorldMovement() {
  const focus = useGame((s) => s.focusStop);
  const faceTarget = useMemo(() => (focus === null ? null : stopWorldPoints(focus).object.clone()), [focus]);
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    updateZef(dt, faceTarget);
    updatePip(dt, worldFloor);
  });
  return null;
}

export function World({ onDoorsOpened }: { onDoorsOpened?: () => void }) {
  const lit = useGame((s) => s.litStop);
  const focus = useGame((s) => s.focusStop);
  const journey = useJourney();
  return (
    <group>
      <WorldLights />
      <SkyDome />
      <Clouds />
      <FarHills />
      <Rainbow />
      <Terrain onGroundTap={(p: THREE.Vector3) => handleGroundTap(p)} />
      <CandyPath />
      <Cottage />
      <Castle
        awake={journey.castleUnlocked || lit >= 15}
        towersActive={focus === 14 && lit >= 14}
        doorsActive={focus === 15 && lit >= 15}
        onDoorsOpened={onDoorsOpened}
      />
      <PathLights lit={lit} onTap={(i, awake) => handleLightTap(i, awake)} />
      <Garden />
      <Meadow />
      <River />
      <Woods />
      <Mountain />
      <Stops />
      <KeepsakeShelf />
      <Balloon />
      <WorldMovement />
      <Fireworks />
    </group>
  );
}
