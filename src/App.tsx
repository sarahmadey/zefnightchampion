// Root: the full-screen 3D game plus a thin HTML overlay for grown-ups.

import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { Zef } from './characters/Zef';
import { Pip, nextPipReaction } from './characters/Pip';
import { World } from './world/World';
import { HugNook } from './scenes/HugNook';
import { CastleInterior } from './scenes/CastleInterior';
import { CameraRig } from './game/CameraRig';
import { Particles, burst } from './three/Particles';
import { cam, clock, pip, pipReact, frameDt, zef, zefPlay } from './game/actors';
import { currentJourney, useGame, useSave } from './state/store';
import { placeAtStop, setFocus } from './game/world';
import { checkProgress, notifyDoorsOpened, enterCastleFromDoors } from './game/director';
import { sharedTime } from './three/shaders';
import { Overlay } from './ui/Overlay';
import { sfx } from './audio/sfx';
import { applyMotionSetting } from './game/settings';
import { computeStreak } from './state/progress';
import { installDebug } from './debug';
import { SceneEnv } from './three/SceneEnv';
import { QualityGovernor, quality } from './game/quality';

function Ticker() {
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    sharedTime.value += dt;
    clock.tick(dt);
  });
  return null;
}

/** Place Zef where the child last saw him, then let the director play anything new. */
function Boot() {
  useEffect(() => {
    const data = useSave.getState().data;
    const info = computeStreak(data.records);
    const j = currentJourney();
    let lit = Math.min(data.seen.stop, info.activeStop);
    if (info.latest?.result === 'wet' && info.latest.date !== data.seen.hugDate) lit = Math.min(data.seen.stop, 15);
    lit = Math.max(0, lit);
    const q = new URLSearchParams(location.search);
    const debug = q.has('debug');
    if (debug && q.has('lit')) lit = Number(q.get('lit'));
    useGame.getState().set({ litStop: lit });
    placeAtStop(debug && q.has('at') ? Number(q.get('at')) : lit);
    if (debug && q.get('cam') === 'follow') setFocus(null);
    const fly = debug ? q.get('fly') : null;
    if (fly) {
      const [x, y, z, tx, ty, tz] = fly.split(',').map(Number);
      cam.mode = 'shot';
      cam.pos.set(x, y, z);
      cam.target.set(tx, ty, tz);
      cam.fitWidth = 0;
      cam.snap = true;
    }
    void j;
    if (debug && q.has('noevents')) return;
    const t = setTimeout(() => useGame.getState().set({ ready: true }), 600);
    return () => clearTimeout(t);
  }, []);
  return null;
}

function DirectorHooks() {
  const ready = useGame((s) => s.ready);
  const parentOpen = useGame((s) => s.parentOpen);
  const preview = useGame((s) => s.preview);
  const records = useSave((s) => s.data.records);
  const token = useGame((s) => s.checkToken);
  // re-check when a cutscene ends too, so a night recorded mid-cutscene still plays
  const busy = useGame((s) => s.cutscene !== null);
  useEffect(() => {
    if (ready && !parentOpen && !preview && !busy) {
      const t = setTimeout(() => checkProgress(), 250);
      return () => clearTimeout(t);
    }
  }, [ready, parentOpen, preview, records, token, busy]);
  return null;
}

function SettingsSync() {
  const sound = useSave((s) => s.data.settings.sound);
  const reduced = useSave((s) => s.data.settings.reducedMotion);
  useEffect(() => sfx.setEnabled(sound), [sound]);
  useEffect(() => applyMotionSetting(reduced), [reduced]);
  return null;
}

function Scenes() {
  const scene = useGame((s) => s.scene);
  return (
    <>
      {scene === 'world' && (
        <World
          onDoorsOpened={() => {
            notifyDoorsOpened();
            const g = useGame.getState();
            if (g.cutscene === null) void enterCastleFromDoors();
          }}
        />
      )}
      {scene === 'castle' && <CastleInterior />}
      {scene === 'hug' && <HugNook />}
    </>
  );
}

function CharView({ pose }: { pose: string }) {
  useEffect(() => {
    zef.scripted = true;
    zef.pos.set(0, 0, 0);
    zef.heading = 0.35;
    zef.expression = pose === 'hugged' ? 'cozy' : 'smile';
    if (pose !== 'idle') zefPlay(pose as never, 999, true);
    pip.mode = 'scripted';
    pip.pos.set(0.9, 0, -0.4);
    pip.heading = -0.4;
    cam.mode = 'shot';
    cam.pos.set(0.3, 0.95, 1.9);
    cam.target.set(0.2, 0.6, 0);
    cam.fitWidth = 0;
    cam.snap = true;
  }, [pose]);
  return (
    <>
      <SceneEnv background="#ffe7d6" />
      <hemisphereLight args={['#fff3ea', '#c4a3d9', 1.4]} />
      <directionalLight position={[2, 4, 3]} intensity={2.2} />
    </>
  );
}

export function App() {
  useEffect(() => installDebug(), []);
  const charView = new URLSearchParams(location.search).get('charview');
  return (
    <div className="game">
      <Canvas
        shadows="percentage"
        dpr={[1, quality.maxDpr]}
        camera={{ position: [0, 4, 14], fov: 50, near: 0.1, far: 900 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, powerPreference: 'high-performance' }}
        aria-label="Zef's Dry Night Quest: a 3D candy world. Tap to walk, tap things to play."
      >
        <Suspense fallback={null}>
          <Ticker />
          <Boot />
          <DirectorHooks />
          <CameraRig />
          {charView ? <CharView pose={charView} /> : <Scenes />}
          <Zef />
          <Pip
            onTap={(e) => {
              const r = nextPipReaction();
              pipReact(r);
              sfx.play(r === 'puff' ? 'whoosh' : 'giggle');
              burst(r === 'love' ? 'heart' : 'sparkle', e.point, { count: r === 'love' ? 6 : 12 });
              if (r === 'puff') {
                const mouth = pip.pos.clone().add(new THREE.Vector3(Math.sin(pip.heading) * 0.4, 0.6, Math.cos(pip.heading) * 0.4));
                setTimeout(() => burst('sparkle', mouth, { count: 20, speed: 2.5, dir: new THREE.Vector3(Math.sin(pip.heading), 0.2, Math.cos(pip.heading)), colors: ['#ffd6f0', '#fff6a8', '#c9f2ff'] }), 450);
              }
              void cam;
            }}
          />
          <Particles />
          <SettingsSync />
          <QualityGovernor enabled={!new URLSearchParams(location.search).has('debug')} />
        </Suspense>
      </Canvas>
      <Overlay />
    </div>
  );
}
