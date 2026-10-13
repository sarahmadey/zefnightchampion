// Layout of every stop in its own local frame (x = right of the path,
// y = up from the path, -z = forward along the path).

import * as THREE from 'three';
import { stopFrame, stopLocalToWorld, STOPS } from '../game/route';

export type V3 = [number, number, number];

export interface StopDef {
  id: number;
  /** centre of the interactive surprise */
  object: V3;
  /** where Zef stands (local x, z) */
  zef: [number, number];
  /** where Pip waits (local x, z) */
  pip: [number, number];
  /** camera position and target for the close-up */
  cam: V3;
  look: V3;
  /** width that must stay visible on narrow screens */
  fit: number;
  /** path light (lamp) position (local x, z) */
  light: [number, number];
  /** wider establishing shot used when a new region is revealed */
  reveal?: { cam: V3; look: V3 };
}

export const STOP_DEFS: StopDef[] = [
  {
    id: 0,
    object: [0, 1.6, 7.5],
    zef: [0, 1.2],
    pip: [-0.9, 1.6],
    cam: [-3.6, 2.7, -6.2],
    look: [0.2, 1.6, 3.4],
    fit: 9,
    light: [2.2, 1.2],
  },
  {
    id: 1,
    object: [3.4, 0, -0.6],
    zef: [1.35, -0.3],
    pip: [1.0, -1.4],
    cam: [-1.5, 2.6, 3.4],
    look: [2.7, 1.0, -0.8],
    fit: 5.8,
    light: [-1.9, 0.8],
    reveal: { cam: [-4, 9, 10], look: [0, 0, -12] },
  },
  {
    id: 2,
    object: [-3.9, 0, -0.6],
    zef: [-1.2, -0.2],
    pip: [-0.9, -1.5],
    cam: [1.8, 2.9, 3.4],
    look: [-2.7, 0.5, -0.7],
    fit: 6.2,
    light: [1.9, 0.8],
  },
  {
    id: 3,
    object: [3.8, 0, -1.3],
    zef: [1.4, 0.2],
    pip: [1.1, -1.2],
    cam: [-1.3, 3.0, 4.6],
    look: [3.1, 1.5, -1.2],
    fit: 7,
    light: [-1.9, 0.8],
  },
  {
    id: 4,
    object: [-3.3, 0.3, -0.6],
    zef: [-1.2, 0.0],
    pip: [-0.7, -1.4],
    cam: [1.7, 2.7, 3.9],
    look: [-2.5, 1.1, -0.6],
    fit: 6.4,
    light: [1.9, 0.8],
    reveal: { cam: [6, 10, 8], look: [-1, 0, -14] },
  },
  {
    id: 5,
    object: [3.0, 1.3, -0.8],
    zef: [1.0, 0.3],
    pip: [0.6, -1.3],
    cam: [-1.3, 2.3, 4.1],
    look: [2.4, 1.3, -0.8],
    fit: 6.4,
    light: [-1.9, 0.8],
  },
  {
    id: 6,
    object: [-4.2, 0, -1.6],
    zef: [-1.3, 0.1],
    pip: [-0.8, -1.4],
    cam: [2.3, 2.9, 4.8],
    look: [-2.9, 2.0, -1.3],
    fit: 7.6,
    light: [1.9, 0.8],
  },
  {
    id: 7,
    object: [-3.4, -0.28, -5.6],
    zef: [-1.7, -2.3],
    pip: [-0.8, -1.4],
    cam: [-2.2, 3.5, 1.3],
    look: [-3.6, -0.2, -5.0],
    fit: 7.5,
    light: [1.9, 0.8],
    reveal: { cam: [9, 9, 6], look: [-4, -0.3, -8] },
  },
  {
    id: 8,
    object: [-4.0, 0, -0.6],
    zef: [-1.5, 0.0],
    pip: [-1.0, -1.4],
    cam: [0.9, 2.7, 2.1],
    look: [-3.4, 0.3, -1.0],
    fit: 6.4,
    light: [1.9, 0.8],
  },
  {
    id: 9,
    object: [6.3, -0.28, -0.6],
    zef: [2.4, 0.0],
    pip: [2.0, -1.4],
    cam: [-0.4, 3.0, 3.6],
    look: [5.6, 0.6, -0.8],
    fit: 8.2,
    light: [-1.9, 0.8],
  },
  {
    id: 10,
    object: [4.1, 0, -0.9],
    zef: [2.0, -0.5],
    pip: [1.6, -1.6],
    cam: [-0.9, 2.1, 3.3],
    look: [3.2, 0.9, -0.9],
    fit: 5.6,
    light: [-1.9, 0.8],
    reveal: { cam: [-7, 8, 7], look: [2, 1, -12] },
  },
  {
    id: 11,
    object: [-4.0, 0, -1.2],
    zef: [-1.0, 0.4],
    pip: [-0.6, -1.2],
    cam: [2.0, 5.6, 4.0],
    look: [-3.3, 0, -1.4],
    fit: 8,
    light: [1.9, 0.8],
  },
  {
    id: 12,
    object: [4.3, 0, -1.2],
    zef: [1.6, 0.2],
    pip: [1.2, -1.3],
    cam: [-1.3, 3.1, 4.3],
    look: [3.6, 1.1, -1.2],
    fit: 7.6,
    light: [-1.9, 0.8],
  },
  {
    id: 13,
    object: [-3.5, 0, -0.6],
    zef: [-1.0, 0.3],
    pip: [-0.6, -1.3],
    cam: [1.9, 2.8, 4.0],
    look: [-2.8, 1.1, -0.8],
    fit: 7.6,
    light: [1.9, 0.8],
    reveal: { cam: [8, 8, 10], look: [-1, 4, -16] },
  },
  {
    id: 14,
    object: [0, 9, -21],
    zef: [0, 0.2],
    pip: [-1.1, -0.6],
    cam: [1.4, 1.3, 6.8],
    look: [0, 5.8, -18],
    fit: 15,
    light: [-1.9, 0.8],
  },
  {
    id: 15,
    object: [0, 1.8, -4.2],
    zef: [0, -1.5],
    pip: [-1.0, -2.0],
    cam: [0.4, 2.5, 3.8],
    look: [0, 2.0, -4.0],
    fit: 7.5,
    light: [-1.9, 0.8],
  },
];

if (STOP_DEFS.length !== STOPS + 1) throw new Error('stop defs mismatch');

export function localToWorld(stop: number, local: V3, out = new THREE.Vector3()): THREE.Vector3 {
  return stopLocalToWorld(stop, local, out);
}

export function stopWorldPoints(i: number) {
  const d = STOP_DEFS[i];
  const f = stopFrame(i);
  return {
    frame: f,
    object: localToWorld(i, d.object),
    zef: localToWorld(i, [d.zef[0], 0, d.zef[1]]),
    pip: localToWorld(i, [d.pip[0], 0, d.pip[1]]),
    cam: localToWorld(i, d.cam),
    look: localToWorld(i, d.look),
    light: localToWorld(i, [d.light[0], 0, d.light[1]]),
  };
}
