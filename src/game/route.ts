// The single connected route from Zef's cottage to the candy castle, the
// regions along it, the lemonade river and the terrain height function.

import * as THREE from 'three';
import { clamp, fbm2, lerp, noise2, smoothstep } from '../three/util';

export const STOPS = 15;

export type RegionId = 'home' | 'garden' | 'meadow' | 'river' | 'woods' | 'mountain';

export interface RegionDef {
  id: RegionId;
  name: string;
  stops: number[];
}

export const REGIONS: RegionDef[] = [
  { id: 'home', name: 'Candy Cottage', stops: [0] },
  { id: 'garden', name: 'Strawberry Garden', stops: [1, 2, 3] },
  { id: 'meadow', name: 'Marshmallow Cloud Meadow', stops: [4, 5, 6] },
  { id: 'river', name: 'Lemonade River', stops: [7, 8, 9] },
  { id: 'woods', name: 'Waffle Woodland', stops: [10, 11, 12] },
  { id: 'mountain', name: 'Gumdrop Mountain', stops: [13, 14, 15] },
];

export function regionOfStop(i: number): RegionDef {
  return REGIONS.find((r) => r.stops.includes(i)) ?? REGIONS[0];
}

export const STOP_NAMES = [
  'Candy Cottage',
  'Strawberry-flower gate',
  'Jellybean beetle parade',
  'Jam slide',
  'Bouncy marshmallow cloud',
  'Bubble sheep',
  'Peppermint windmill',
  'Lemon-slice boat',
  'Licorice braid bridge',
  'Bubble whale',
  'Waffle tree door',
  'Syrup fireflies',
  'Cookie carousel',
  'Gumdrop lanterns',
  'Castle towers',
  'Castle doors',
];

/** Stop anchor points on the path (x, y, z). Index 0 is the cottage yard. */
export const STOP_POINTS: [number, number, number][] = [
  [0, 0, 4],
  [-3, 0, -6],
  [2.5, 0, -15.5],
  [-1.5, 0, -25],
  [3, 0.9, -35.5],
  [-2, 1.15, -45],
  [2.5, 0.95, -54.5],
  [-1.2, 0.12, -64],
  [1.5, 0.12, -75],
  [2.5, 0.12, -85],
  [-1, 0.08, -95],
  [-3, 0.08, -104.5],
  [1.5, 0.08, -114],
  [-1.5, 1.3, -123.5],
  [1.5, 3.8, -132],
  [0, 6.5, -141],
];

/** Every control point, stops plus gentle in-between bends. */
const CONTROL: [number, number, number][] = [
  [0.4, 0, 9],
  STOP_POINTS[0],
  [-1.6, 0, -1],
  STOP_POINTS[1],
  [0.2, 0, -10.5],
  STOP_POINTS[2],
  [1.4, 0, -20.5],
  STOP_POINTS[3],
  [0.4, 0.35, -30.5],
  STOP_POINTS[4],
  [1, 1.1, -40.5],
  STOP_POINTS[5],
  [0.2, 1.15, -50],
  STOP_POINTS[6],
  [1.6, 0.55, -59.5],
  STOP_POINTS[7],
  [0, 0.75, -69.5],
  STOP_POINTS[8],
  [2.6, 0.12, -80],
  STOP_POINTS[9],
  [0.6, 0.1, -90],
  STOP_POINTS[10],
  [-2.6, 0.08, -100],
  STOP_POINTS[11],
  [-0.8, 0.08, -109.5],
  STOP_POINTS[12],
  [0.6, 0.4, -119],
  STOP_POINTS[13],
  [0.2, 2.5, -128],
  STOP_POINTS[14],
  [0.8, 5.4, -137],
  STOP_POINTS[15],
  [0, 6.5, -145],
];

const curve = new THREE.CatmullRomCurve3(
  CONTROL.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  false,
  'centripetal',
);
curve.arcLengthDivisions = 3000;

const N = 3000;
export const ROUTE_LENGTH = curve.getLength();
const lutX = new Float32Array(N + 1);
const lutY = new Float32Array(N + 1);
const lutZ = new Float32Array(N + 1);
{
  const p = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    curve.getPointAt(i / N, p);
    lutX[i] = p.x;
    lutY[i] = p.y;
    lutZ[i] = p.z;
  }
}

export function pointAt(s: number, out = new THREE.Vector3()): THREE.Vector3 {
  const f = (clamp(s, 0, ROUTE_LENGTH) / ROUTE_LENGTH) * N;
  const i = Math.min(N - 1, Math.floor(f));
  const t = f - i;
  return out.set(lerp(lutX[i], lutX[i + 1], t), lerp(lutY[i], lutY[i + 1], t), lerp(lutZ[i], lutZ[i + 1], t));
}

export function tangentAt(s: number, out = new THREE.Vector3()): THREE.Vector3 {
  const a = pointAt(s - 0.6, new THREE.Vector3());
  const b = pointAt(s + 0.6, out);
  return b.sub(a).normalize();
}

/** Horizontal unit vector pointing to the right of the direction of travel. */
export function rightAt(s: number, out = new THREE.Vector3()): THREE.Vector3 {
  tangentAt(s, out);
  out.y = 0;
  out.normalize();
  return out.set(-out.z, 0, out.x);
}

/** Path yaw such that a group with rotation.y = yaw has local -Z along the path. */
export function yawAt(s: number): number {
  const t = tangentAt(s);
  return Math.atan2(-t.x, -t.z);
}

function nearestIndex(x: number, z: number): number {
  // The route is monotonic in z, so search a window around the z match.
  let lo = 0;
  let hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lutZ[mid] > z) lo = mid;
    else hi = mid;
  }
  let best = lo;
  let bestD = Infinity;
  const from = Math.max(0, lo - 220);
  const to = Math.min(N, lo + 220);
  for (let i = from; i <= to; i++) {
    const dx = lutX[i] - x;
    const dz = lutZ[i] - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Closest route distance `s` and signed lateral offset for a ground point. */
export function nearestOnRoute(x: number, z: number): { s: number; lateral: number; dist: number } {
  const i = nearestIndex(x, z);
  const s = (i / N) * ROUTE_LENGTH;
  const p = pointAt(s);
  const r = rightAt(s);
  const dx = x - p.x;
  const dz = z - p.z;
  return { s, lateral: dx * r.x + dz * r.z, dist: Math.hypot(dx, dz) };
}

export const STOP_S: number[] = STOP_POINTS.map(([x, , z]) => nearestOnRoute(x, z).s);
export const ROUTE_END_S = ROUTE_LENGTH;

function pathAtZ(z: number): { x: number; y: number } {
  if (z >= lutZ[0]) return { x: lutX[0], y: lutY[0] };
  if (z <= lutZ[N]) return { x: lutX[N], y: lutY[N] };
  let lo = 0;
  let hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lutZ[mid] > z) lo = mid;
    else hi = mid;
  }
  const t = (z - lutZ[lo]) / (lutZ[hi] - lutZ[lo] || 1);
  return { x: lerp(lutX[lo], lutX[hi], t), y: lerp(lutY[lo], lutY[hi], t) };
}

/** Fast approximate lateral distance from the path centre (good away from sharp bends). */
export function pathLateralApprox(x: number, z: number): number {
  return x - pathAtZ(z).x;
}

export function pathXAtZ(z: number): number {
  return pathAtZ(z).x;
}

export function pathYAtZ(z: number): number {
  return pathAtZ(z).y;
}

export interface StopFrame {
  origin: THREE.Vector3;
  yaw: number;
  right: THREE.Vector3;
  forward: THREE.Vector3;
}

export function stopFrame(i: number): StopFrame {
  const s = STOP_S[i];
  const origin = pointAt(s);
  const forward = tangentAt(s);
  forward.y = 0;
  forward.normalize();
  return { origin, yaw: yawAt(s), right: rightAt(s), forward };
}

/** Convert a point in a stop's local frame (x right, y up, -z forward) to world. */
export function stopLocalToWorld(i: number, local: [number, number, number], out = new THREE.Vector3()): THREE.Vector3 {
  const f = stopFrame(i);
  const [lx, ly, lz] = local;
  return out
    .copy(f.origin)
    .addScaledVector(f.right, lx)
    .addScaledVector(f.forward, -lz)
    .setY(f.origin.y + ly);
}

// ---------------------------------------------------------------- regions

/** Region weights blend smoothly by z so ground colours fade between areas. */
export const REGION_Z = {
  gardenStart: -1,
  meadowStart: -30,
  riverStart: -59.5,
  woodsStart: -90,
  mountainStart: -118.5,
};

export function regionAtZ(z: number): RegionId {
  if (z > REGION_Z.gardenStart) return 'home';
  if (z > REGION_Z.meadowStart) return 'garden';
  if (z > REGION_Z.riverStart) return 'meadow';
  if (z > REGION_Z.woodsStart) return 'river';
  if (z > REGION_Z.mountainStart) return 'woods';
  return 'mountain';
}

// ------------------------------------------------------------------ river

const RIVER_POINTS: [number, number][] = [
  [-80, -60],
  [-46, -63],
  [-24, -66.5],
  [-8, -69],
  [3, -70.2],
  [9, -73],
  [12, -78.5],
  [12.8, -85],
  [13.5, -91],
  [22, -95.5],
  [46, -98.5],
  [80, -100],
];

export const riverCurve = new THREE.CatmullRomCurve3(
  RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  'centripetal',
);
riverCurve.arcLengthDivisions = 600;
const RIVER_N = 600;
const rX = new Float32Array(RIVER_N + 1);
const rZ = new Float32Array(RIVER_N + 1);
export const RIVER_LENGTH = riverCurve.getLength();
{
  const p = new THREE.Vector3();
  for (let i = 0; i <= RIVER_N; i++) {
    riverCurve.getPointAt(i / RIVER_N, p);
    rX[i] = p.x;
    rZ[i] = p.z;
  }
}

export const LAGOON = new THREE.Vector2(12.8, -85);
export const WATER_Y = -0.28;

/** Half-width of the river at arc length `s`. */
export function riverHalfWidth(s: number): number {
  const p = riverCurve.getPointAt(clamp(s / RIVER_LENGTH, 0, 1));
  const lag = Math.hypot(p.x - LAGOON.x, p.z - LAGOON.y);
  return 3.1 + 2.6 * (1 - smoothstep(0, 9, lag)) + 0.3 * Math.sin(s * 0.21);
}

export function riverInfo(x: number, z: number): { dist: number; s: number; half: number } {
  if (z > -52 || z < -108) return { dist: 99, s: 0, half: 3 };
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= RIVER_N; i += 3) {
    const dx = rX[i] - x;
    const dz = rZ[i] - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  for (let i = Math.max(0, best - 3); i <= Math.min(RIVER_N, best + 3); i++) {
    const dx = rX[i] - x;
    const dz = rZ[i] - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const s = (best / RIVER_N) * RIVER_LENGTH;
  return { dist: Math.sqrt(bestD), s, half: riverHalfWidth(s) };
}

// ---------------------------------------------------------------- terrain

const CASTLE_PLATEAU = new THREE.Vector2(0, -152);
export const CASTLE_BASE_Y = 6.5;

/** Raw terrain without the path corridor. */
function naturalHeight(x: number, z: number): number {
  const p = pathAtZ(z);
  const d = Math.abs(x - p.x);
  const hills = fbm2(x * 0.045 + 3.1, z * 0.045 - 1.7, 3);
  const rolling = (hills - 0.4) * 3.2 * smoothstep(5, 24, d);
  const rim = smoothstep(26, 60, d) * 9 * (0.7 + 0.6 * noise2(x * 0.03, z * 0.03));
  let h = p.y + rolling + rim;

  // marshmallow meadow: puffy little mounds
  const meadow = smoothstep(-27, -34, z) * (1 - smoothstep(-55, -62, z));
  if (meadow > 0) {
    const puff = Math.pow(noise2(x * 0.32, z * 0.32), 2.2) * 1.4 + noise2(x * 0.9, z * 0.9) * 0.25;
    h += meadow * puff * smoothstep(3.5, 7, d);
  }

  // gumdrop mountain rising toward the castle
  const mountain = smoothstep(-110, -140, z);
  if (mountain > 0) {
    h += mountain * smoothstep(5, 26, d) * (7 + 9 * fbm2(x * 0.06, z * 0.06, 2));
  }
  // the summit behind the castle
  h += smoothstep(-162, -186, z) * (12 + 10 * fbm2(x * 0.05 + 7, z * 0.05, 2));
  // castle plateau
  const plateau = Math.hypot(x - CASTLE_PLATEAU.x, z - CASTLE_PLATEAU.y);
  if (plateau < 22) {
    const k = smoothstep(22, 15, plateau);
    h = lerp(h, CASTLE_BASE_Y - 0.05, k);
  }
  // behind the cottage the world rolls up into hills
  h += smoothstep(14, 40, z) * 6;
  return h;
}

export function terrainHeight(x: number, z: number): number {
  const p = pathAtZ(z);
  const d = Math.abs(x - p.x);
  let h = naturalHeight(x, z);

  // flatten a corridor for the path and round plazas at stops
  let flat = 1 - smoothstep(2.6, 6.5, d);
  for (let i = 0; i < STOP_POINTS.length; i++) {
    const [sx, , sz] = STOP_POINTS[i];
    const dd = Math.hypot(x - sx, z - sz);
    flat = Math.max(flat, 1 - smoothstep(4.2, 8, dd));
  }
  h = lerp(h, p.y - 0.06, flat);

  // carve the river channel (but keep path and plazas dry except at the bridge)
  const r = riverInfo(x, z);
  if (r.dist < r.half + 4) {
    const bed = WATER_Y - 1.1;
    const bridgeZone = smoothstep(-75, -72, z) * (1 - smoothstep(-67, -64, z));
    const protect = flat * (1 - bridgeZone);
    const k = (1 - smoothstep(r.half - 1.2, r.half + 2.2, r.dist)) * (1 - protect * 0.85);
    h = lerp(h, bed, k);
  }
  return h;
}

/** Height Zef and Pip stand at: the path surface (bridges included) or terrain. */
export function groundY(x: number, z: number): number {
  const n = nearestOnRoute(x, z);
  const routeY = pointAt(n.s).y;
  const t = terrainHeight(x, z);
  const onPath = 1 - smoothstep(1.4, 2.4, Math.abs(n.lateral));
  // on the bridge over the river, stay on the deck
  const r = riverInfo(x, z);
  if (r.dist < r.half + 1.5 && Math.abs(n.lateral) < 1.6) return routeY;
  return Math.max(t, lerp(t, routeY, onPath));
}

export const WORLD_BOUNDS = { minX: -90, maxX: 90, minZ: -215, maxZ: 45 };
