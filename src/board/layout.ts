// Where everything on the board sits. Lands are laid out one after another
// along -z, joined by little bridges. Each land has a winding path of
// stepping stones (5 in each of the first two lands, 15 after that) ending at a prize
// chest. Positions are deterministic, so the board looks the same every day.

import * as THREE from 'three';
import { DEFAULT_RULES, landOf, landRange, scheduleKey, type QuestRules } from '../state/progress';
import { fbm2, mulberry32, smoothstep } from '../three/util';

export const BRIDGE = 9;
export const THEME_COUNT = 7;

export function landDepth(land: number, rules: QuestRules = DEFAULT_RULES): number {
  const { start, end } = landRange(land, rules);
  return (end - start) * 1.7 + 3;
}

const zCache = new Map<string, number>();

/** World z of a land's centre. */
export function landZ(land: number, rules: QuestRules = DEFAULT_RULES): number {
  if (land <= 0) return 0;
  const key = `${land}:${scheduleKey(rules)}`;
  const hit = zCache.get(key);
  if (hit !== undefined) return hit;
  const z = landZ(land - 1, rules) - (landDepth(land - 1, rules) / 2 + BRIDGE + landDepth(land, rules) / 2);
  zCache.set(key, z);
  return z;
}

export function themeOf(land: number): number {
  return ((land % THEME_COUNT) + THEME_COUNT) % THEME_COUNT;
}

const curveCache = new Map<string, THREE.CatmullRomCurve3>();

/** The winding path of a land, in world space, from where the bridge arrives to the chest. */
export function landCurve(land: number, rules: QuestRules = DEFAULT_RULES): THREE.CatmullRomCurve3 {
  const key = `${land}:${scheduleKey(rules)}`;
  const hit = curveCache.get(key);
  if (hit) return hit;
  const d = landDepth(land, rules);
  const z0 = landZ(land, rules);
  const rng = mulberry32(911 + land * 7);
  const n = Math.max(5, Math.round(d / 4.2));
  const pts: THREE.Vector3[] = [];
  const flip = land % 2 ? -1 : 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const z = z0 + d / 2 - t * (d - 1);
    let x = 0;
    if (i > 0 && i < n) x = flip * (i % 2 ? 1 : -1) * (2.4 + rng() * 1.6);
    if (i === n) x = 0;
    pts.push(new THREE.Vector3(x, 0, z));
  }
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  for (const p of pts) p.y = groundHeight(p.x, p.z);
  curveCache.set(key, c);
  return c;
}

/** Gentle ground undulation; the path area stays fairly flat. */
export function groundHeight(x: number, z: number): number {
  const h = (fbm2(x * 0.09 + 3.1, z * 0.09 - 1.7, 3) - 0.5) * 0.9;
  const edge = smoothstep(9, 15, Math.abs(x)) * 2.2;
  return h * 0.6 + edge;
}

const spaceCache = new Map<string, THREE.Vector3>();

/** World position of board space `index` (1 = first stone; 0 = the nest). */
export function spacePos(index: number, rules: QuestRules = DEFAULT_RULES): THREE.Vector3 {
  const key = `${index}:${scheduleKey(rules)}`;
  const hit = spaceCache.get(key);
  if (hit) return hit;
  let p: THREE.Vector3;
  if (index <= 0) {
    p = landCurve(0, rules).getPointAt(0).clone();
    p.z += 0.4;
  } else {
    // the land whose stones include this index
    let land = landOf(index - 1, rules);
    const r = landRange(land, rules);
    if (index > r.end) land += 1;
    const range = landRange(land, rules);
    const n = range.end - range.start;
    const k = index - range.start;
    const c = landCurve(land, rules);
    p = c.getPointAt(Math.min(1, k / n)).clone();
  }
  p.y = groundHeight(p.x, p.z) + 0.16;
  spaceCache.set(key, p);
  return p;
}

/** Where the dino rests at board position `stars`: a finished land waits at the next land's entrance. */
export function restPos(stars: number, rules: QuestRules = DEFAULT_RULES): THREE.Vector3 {
  if (stars <= 0) return spacePos(0, rules);
  const land = landOf(stars, rules);
  const r = landRange(land, rules);
  if (stars === r.start) {
    const p = landCurve(land, rules).getPointAt(0).clone();
    p.y = groundHeight(p.x, p.z) + 0.05;
    return p;
  }
  return spacePos(stars, rules);
}

/** Direction of travel along the path at board position `stars` (yaw). */
export function headingAt(stars: number, rules: QuestRules = DEFAULT_RULES): number {
  const a = restPos(stars, rules);
  const b = spacePos(stars + 1, rules);
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** The chest at the end of `land`. */
export function chestPos(land: number, rules: QuestRules = DEFAULT_RULES): THREE.Vector3 {
  return spacePos(landRange(land, rules).end, rules);
}

/** The bridge from the chest of `land` to the next land's entrance. */
export function bridgeEnds(land: number, rules: QuestRules = DEFAULT_RULES): [THREE.Vector3, THREE.Vector3] {
  const a = chestPos(land, rules).clone();
  const b = landCurve(land + 1, rules).getPointAt(0).clone();
  a.y = groundHeight(a.x, a.z);
  b.y = groundHeight(b.x, b.z);
  return [a, b];
}

/** Where the Underpants Store stands on its far-off mesa, seen from `land`. */
export function storeLandmarkPos(land: number, rules: QuestRules = DEFAULT_RULES): THREE.Vector3 {
  const z = landZ(land, rules) - landDepth(land, rules) / 2 - 46;
  return new THREE.Vector3(9, 9, z);
}
