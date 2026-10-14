// Root: the full-screen 3D board (or the store, or the first-time stage)
// plus the HTML overlay with the big morning buttons and the parent corner.

import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { Board } from './board/Board';
import { StoreScene } from './store/StoreScene';
import { SetupStage } from './setup/SetupStage';
import { TitleStage } from './setup/TitleStage';
import { CameraRig } from './game/CameraRig';
import { Particles } from './three/Particles';
import { clock, frameDt } from './game/actors';
import { useGame, useSave } from './state/store';
import { boot, checkProgress, showTitle, updateTalk } from './game/director';
import { sharedTime } from './three/shaders';
import { Overlay } from './ui/Overlay';
import { applyMotionSetting } from './game/settings';
import { installDebug } from './debug';
import { QualityGovernor, quality } from './game/quality';
import { setMusicOn, setSoundOn } from './audio/core';

function Ticker() {
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    sharedTime.value += dt;
    clock.tick(dt);
    updateTalk(dt);
  });
  return null;
}

/** Put everything where the child last saw it, then let the director take over. */
function Boot() {
  useEffect(() => {
    boot();
    const t = setTimeout(() => useGame.getState().set({ ready: true }), 500);
    return () => clearTimeout(t);
  }, []);
  return null;
}

function DirectorHooks() {
  const ready = useGame((s) => s.ready);
  const parentOpen = useGame((s) => s.parentOpen);
  const preview = useGame((s) => s.preview);
  const records = useSave((s) => s.data.records);
  const rules = useSave((s) => s.data.rules);
  const token = useGame((s) => s.checkToken);
  // re-check when an event ends too, so a night recorded mid-event still plays
  const busy = useGame((s) => s.cutscene !== null);
  useEffect(() => {
    if (ready && !parentOpen && !preview && !busy) {
      const t = setTimeout(() => checkProgress(), 250);
      return () => clearTimeout(t);
    }
  }, [ready, parentOpen, preview, records, rules, token, busy]);
  // a grown-up on another device removed this child: back to the title screen
  const current = useSave((s) => s.library.current);
  const phase = useGame((s) => s.phase);
  useEffect(() => {
    if (!current && phase !== 'title' && phase !== 'boot') showTitle();
  }, [current, phase]);
  return null;
}

function SettingsSync() {
  const sound = useSave((s) => s.data.settings.sound);
  const musicOn = useSave((s) => s.data.settings.music);
  const reduced = useSave((s) => s.data.settings.reducedMotion);
  useEffect(() => setSoundOn(sound), [sound]);
  useEffect(() => setMusicOn(musicOn), [musicOn]);
  useEffect(() => applyMotionSetting(reduced), [reduced]);
  return null;
}

function Scenes() {
  const scene = useGame((s) => s.scene);
  if (scene === 'store') return <StoreScene />;
  if (scene === 'setup') return <SetupStage />;
  if (scene === 'title') return <TitleStage />;
  return <Board />;
}

export function App() {
  useEffect(() => installDebug(), []);
  return (
    <div className="game">
      <Canvas
        shadows="percentage"
        dpr={[1, quality.maxDpr]}
        camera={{ position: [0, 6, 12], fov: 50, near: 0.1, far: 900 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, powerPreference: 'high-performance' }}
        aria-label="Dino Underwear Quest: a 3D dinosaur board game"
      >
        <Suspense fallback={null}>
          <Ticker />
          <Boot />
          <DirectorHooks />
          <CameraRig />
          <Scenes />
          <Particles />
          <SettingsSync />
          <QualityGovernor enabled={!new URLSearchParams(location.search).has('debug')} />
        </Suspense>
      </Canvas>
      <Overlay />
    </div>
  );
}
