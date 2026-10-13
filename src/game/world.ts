// High-level world interactions: walking where Zef taps, going to stops,
// framing stop close-ups, and gently refusing stops that are still asleep.

import * as THREE from 'three';
import { cam, pip, pipReact, zef, zefPlay } from './actors';
import { ROUTE_LENGTH, STOP_S, STOPS, nearestOnRoute } from './route';
import { STOP_DEFS, stopWorldPoints } from '../world/stopDefs';
import { pipSpot, placePip, placeZefOnRoute, setPipSide, walkRoute } from './nav';
import { useGame } from '../state/store';
import { bus } from './bus';
import { clamp } from '../three/util';

export function litStop(): number {
  return useGame.getState().litStop;
}

/** Furthest route distance Zef may walk to right now. */
export function reachableMaxS(lit = litStop()): number {
  if (lit >= STOPS) return ROUTE_LENGTH - 0.5;
  return STOP_S[lit] + 2.6;
}

/** How far from the path centre Zef may wander at route distance s. */
export function halfWidthAt(s: number): number {
  let w = 1.0;
  for (let i = 0; i <= STOPS; i++) {
    const d = Math.abs(s - STOP_S[i]);
    if (d < 3.2) w = Math.max(w, i === 0 ? 2.6 : 2.2 - d * 0.3);
  }
  if (s < STOP_S[0] + 3) w = Math.max(w, 2.6);
  return w;
}

export function focusCamera(i: number) {
  const w = stopWorldPoints(i);
  cam.mode = 'focus';
  cam.pos.copy(w.cam);
  cam.target.copy(w.look);
  cam.fitWidth = STOP_DEFS[i].fit;
  cam.lambda = 2.4;
}

export function followCamera() {
  cam.mode = 'follow';
  cam.fitWidth = 0;
  cam.lambda = 2.6;
}

export function setFocus(i: number | null) {
  const g = useGame.getState();
  if (g.focusStop !== i) g.set({ focusStop: i });
  if (i === null) {
    followCamera();
    pip.mode = 'follow';
    pipSpot.active = false;
    zef.look = null;
    pip.look = null;
  } else {
    focusCamera(i);
    const w = stopWorldPoints(i);
    zef.look = w.object.clone();
    pip.look = w.object.clone();
    pip.mode = 'stay';
    pipSpot.pos.copy(w.pip);
    pipSpot.active = true;
  }
}

export function stopSpotRoute(i: number) {
  const w = stopWorldPoints(i);
  return nearestOnRoute(w.zef.x, w.zef.z);
}

/** Walk Zef to stop i and frame it when he arrives. */
export function goToStop(i: number, onArrive?: () => void) {
  const spot = stopSpotRoute(i);
  const g = useGame.getState();
  if (g.shelfFocus) {
    g.set({ shelfFocus: false });
    followCamera();
  }
  if (g.focusStop !== null && g.focusStop !== i) setFocus(null);
  setPipSide(STOP_DEFS[i].pip[0] >= STOP_DEFS[i].zef[0] ? 1 : -1);
  walkRoute(spot.s, spot.lateral, () => {
    setFocus(i);
    onArrive?.();
  });
}

/** Instantly put Zef and Pip at a stop with the close-up framed. */
export function placeAtStop(i: number) {
  const spot = stopSpotRoute(i);
  placeZefOnRoute(spot.s, spot.lateral);
  const w = stopWorldPoints(i);
  zef.heading = Math.atan2(w.object.x - zef.pos.x, w.object.z - zef.pos.z);
  placePip(w.pip, zef.heading);
  setFocus(i);
  cam.snap = true;
}

let lastTap = 0;

export function handleGroundTap(point: THREE.Vector3) {
  const g = useGame.getState();
  if (g.cutscene || g.parentOpen || g.scene !== 'world') return;
  const now = performance.now();
  if (now - lastTap < 120) return;
  lastTap = now;
  const lit = g.litStop;
  const n = nearestOnRoute(point.x, point.z);
  // tapping near an awake stop goes there and frames it
  for (let i = 0; i <= lit; i++) {
    if (Math.abs(n.s - STOP_S[i]) < 2.8 && Math.abs(n.lateral) < 5 && g.focusStop !== i) {
      goToStop(i);
      return;
    }
  }
  const maxS = reachableMaxS(lit);
  const blocked = n.s > maxS + 0.8;
  const s = clamp(n.s, 0.4, maxS);
  const hw = halfWidthAt(s);
  const lat = clamp(n.lateral, -hw, hw);
  if (g.focusStop !== null) setFocus(null);
  if (g.shelfFocus) {
    g.set({ shelfFocus: false });
    followCamera();
  }
  walkRoute(s, blocked ? 0 : lat, () => {
    if (blocked) {
      // the next light is still sleeping: a gentle "not yet"
      zefPlay('shrug', 1.4);
      pipReact('yawn', 1.6);
      bus.emit('sleepyLight', lit + 1);
    }
  });
}

/** Tap on a path light. Awake: go to its stop. Asleep: it yawns. */
export function handleLightTap(i: number, awake: boolean) {
  const g = useGame.getState();
  if (g.cutscene || g.scene !== 'world') return;
  if (awake) {
    if (g.focusStop !== i) goToStop(i);
  } else {
    bus.emit('sleepyLight', i);
    pipReact('yawn', 1.6);
  }
}

/** Tap on a surprise object: walk there first if Zef is elsewhere. Returns true when it may react. */
export function requestStopInteraction(i: number): boolean {
  const g = useGame.getState();
  if (g.cutscene || g.scene !== 'world') return false;
  if (i > g.litStop) {
    bus.emit('sleepyLight', i);
    return false;
  }
  if (g.focusStop !== i) {
    goToStop(i);
    return false;
  }
  bus.emit('interact', i);
  return true;
}
