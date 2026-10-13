// Test hooks, only installed when the page URL has ?debug. They let automated
// checks drive the game (record nights, project objects to the screen).

import * as THREE from 'three';
import { cam, pip, timeScale, zef } from './game/actors';
import { useGame, useSave } from './state/store';
import { addDays, todayKey } from './state/progress';
import { stopWorldPoints } from './world/stopDefs';
import { startPreview, endPreview } from './game/director';
import { placeAtStop } from './game/world';

export function installDebug() {
  if (typeof window === 'undefined' || !new URLSearchParams(location.search).has('debug')) return;
  const q = new URLSearchParams(location.search);
  const speed = Number(q.get('speed') ?? '1');
  if (speed > 0) timeScale.value = speed;
  // software-rendered test browsers run at a few fps: let game time keep up
  timeScale.maxDt = Number(q.get('maxdt') ?? '0.25');
  const api = {
    zef,
    pip,
    cam,
    game: () => useGame.getState(),
    save: () => useSave.getState().data,
    record(dateOffset: number, result: 'dry' | 'wet' | null) {
      useSave.getState().record(addDays(todayKey(), dateOffset), result);
    },
    recordRun(n: number, endOffset = 0) {
      for (let i = n - 1; i >= 0; i--) useSave.getState().record(addDays(todayKey(), endOffset - i), 'dry');
    },
    setParentOpen(v: boolean) {
      useGame.getState().set({ parentOpen: v });
    },
    preview(stop: number) {
      startPreview(stop === 0 ? { kind: 'hug', stop: 0 } : { kind: 'stop', stop });
    },
    endPreview,
    castle(room: 'hall' | 'garden' = 'hall') {
      useGame.getState().set({ scene: 'castle', room, cutscene: null });
    },
    goto(i: number, lit = 15) {
      useGame.getState().set({ litStop: lit, cutscene: null });
      placeAtStop(i);
    },
    stopScreen(i: number, which: 'object' | 'zef' | 'light' = 'object') {
      const w = stopWorldPoints(i);
      return api.project(w[which]);
    },
    project(p: THREE.Vector3) {
      const camera = (window as unknown as { __camera?: THREE.Camera }).__camera;
      if (!camera) return null;
      const v = p.clone().project(camera);
      return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
    },
  };
  (window as unknown as { __zef: typeof api }).__zef = api;
}
