// Movement for Zef (along the route in the world, free-roaming in rooms) and
// Pip (follows Zef, waits at spots, or is driven by scripts).

import * as THREE from 'three';
import { pip, zef } from './actors';
import { groundY, nearestOnRoute, pointAt, rightAt, ROUTE_LENGTH } from './route';
import { clamp, damp, dampAngle, smoothstep } from '../three/util';

const P = new THREE.Vector3();
const R = new THREE.Vector3();
const prev = new THREE.Vector3();

export const ZEF_FOOT = 0.05;

export function routePosition(s: number, lateral: number, out: THREE.Vector3): THREE.Vector3 {
  pointAt(s, P);
  rightAt(s, R);
  return out.set(P.x + R.x * lateral, P.y + ZEF_FOOT, P.z + R.z * lateral);
}

export function placeZefOnRoute(s: number, lateral: number) {
  zef.s = clamp(s, 0, ROUTE_LENGTH);
  zef.lateral = lateral;
  zef.nav = null;
  zef.speed = 0;
  routePosition(zef.s, zef.lateral, zef.pos);
}

export function walkRoute(targetS: number, targetLat: number, onArrive?: () => void) {
  zef.nav = { mode: 'route', targetS: clamp(targetS, 0, ROUTE_LENGTH), targetLat, onArrive };
}

export function walkFree(points: THREE.Vector3[], onArrive?: () => void) {
  zef.nav = { mode: 'free', points: points.map((p) => p.clone()), onArrive };
}

export function stopNav() {
  zef.nav = null;
}

/** Route coordinates for a world point near the path. */
export function toRoute(p: THREE.Vector3) {
  return nearestOnRoute(p.x, p.z);
}

/** Per-frame Zef movement. `faceTarget` turns him toward something when idle. */
export function updateZef(dt: number, faceTarget: THREE.Vector3 | null, floorY?: (x: number, z: number) => number) {
  if (zef.scripted) return;
  const nav = zef.nav;
  prev.copy(zef.pos);
  if (nav && nav.mode === 'route') {
    const ds = nav.targetS - zef.s;
    const dLat = nav.targetLat - zef.lateral;
    const remaining = Math.abs(ds) + Math.abs(dLat);
    const cruise = clamp(Math.abs(ds) * 0.55, 2.3, 6.2);
    zef.speed = damp(zef.speed, remaining > 0.03 ? cruise : 0, 6, dt);
    const step = Math.min(Math.abs(ds), Math.max(zef.speed, 0.6) * dt);
    zef.s += Math.sign(ds) * step;
    // drift toward the centre while travelling, then out to the target spot
    const near = 1 - smoothstep(1.2, 3.5, Math.abs(ds));
    const latGoal = near > 0 ? nav.targetLat : clamp(zef.lateral, -0.5, 0.5);
    const latStep = Math.min(Math.abs(latGoal - zef.lateral), Math.max(1.4, zef.speed * 0.8) * dt);
    zef.lateral += Math.sign(latGoal - zef.lateral) * latStep;
    routePosition(zef.s, zef.lateral, zef.pos);
    if (Math.abs(nav.targetS - zef.s) < 0.01 && Math.abs(nav.targetLat - zef.lateral) < 0.01) {
      const cb = nav.onArrive;
      zef.nav = null;
      cb?.();
    }
  } else if (nav && nav.mode === 'free') {
    const target = nav.points[0];
    if (target) {
      const dx = target.x - zef.pos.x;
      const dz = target.z - zef.pos.z;
      const d = Math.hypot(dx, dz);
      const total = nav.points.reduce((acc, p, i) => acc + (i === 0 ? d : p.distanceTo(nav.points[i - 1])), 0);
      const cruise = clamp(total * 0.8, 1.8, 4.5);
      zef.speed = damp(zef.speed, cruise, 6, dt);
      const step = Math.min(d, Math.max(zef.speed, 0.6) * dt);
      if (d > 1e-4) {
        zef.pos.x += (dx / d) * step;
        zef.pos.z += (dz / d) * step;
      }
      if (d - step < 0.01) nav.points.shift();
    }
    if (floorY) zef.pos.y = floorY(zef.pos.x, zef.pos.z);
    if (!nav.points.length) {
      const cb = nav.onArrive;
      zef.nav = null;
      cb?.();
    }
  } else {
    zef.speed = damp(zef.speed, 0, 8, dt);
  }
  zef.runFactor = smoothstep(3.2, 5.5, zef.speed);

  const mx = zef.pos.x - prev.x;
  const mz = zef.pos.z - prev.z;
  if (mx * mx + mz * mz > 1e-7) {
    zef.heading = dampAngle(zef.heading, Math.atan2(mx, mz), 12, dt);
  } else if (faceTarget) {
    const want = Math.atan2(faceTarget.x - zef.pos.x, faceTarget.z - zef.pos.z);
    zef.heading = dampAngle(zef.heading, want, 5, dt);
  }
}

// ------------------------------------------------------------------- Pip

const pipPrev = new THREE.Vector3();
const desired = new THREE.Vector3();
let pipSide = -1;

export const pipSpot = { pos: new THREE.Vector3(), active: false };

export function setPipSide(side: number) {
  pipSide = side >= 0 ? 1 : -1;
}

export function placePip(p: THREE.Vector3, heading = zef.heading) {
  pip.pos.copy(p);
  pip.heading = heading;
  pip.speed = 0;
}

export function updatePip(dt: number, floorY: (x: number, z: number) => number) {
  if (pip.mode === 'scripted' || pip.mode === 'hug') return;
  pipPrev.copy(pip.pos);
  if (pip.mode === 'stay' && pipSpot.active) {
    desired.copy(pipSpot.pos);
  } else {
    // trail just behind and beside Zef
    const fx = Math.sin(zef.heading);
    const fz = Math.cos(zef.heading);
    const rx = -fz;
    const rz = fx;
    const lag = 0.55 + Math.min(zef.speed, 5) * 0.12;
    desired.set(zef.pos.x - fx * lag + rx * pipSide * 0.72, 0, zef.pos.z - fz * lag + rz * pipSide * 0.72);
  }
  const dx = desired.x - pip.pos.x;
  const dz = desired.z - pip.pos.z;
  const d = Math.hypot(dx, dz);
  const want = d > 0.12 ? clamp(d * 2.4, 0.8, zef.speed + 3.2) : 0;
  pip.speed = damp(pip.speed, want, 7, dt);
  const step = Math.min(d, pip.speed * dt);
  if (d > 1e-4) {
    pip.pos.x += (dx / d) * step;
    pip.pos.z += (dz / d) * step;
  }
  pip.fly = damp(pip.fly, d > 3.2 || zef.speed > 4.6 ? 1 : 0, 3, dt);
  pip.pos.y = floorY(pip.pos.x, pip.pos.z);
  const mx = pip.pos.x - pipPrev.x;
  const mz = pip.pos.z - pipPrev.z;
  if (mx * mx + mz * mz > 1e-6) {
    pip.heading = dampAngle(pip.heading, Math.atan2(mx, mz), 10, dt);
  } else {
    const look = pip.look ?? zef.pos;
    pip.heading = dampAngle(pip.heading, Math.atan2(look.x - pip.pos.x, look.z - pip.pos.z), 4, dt);
  }
}

export function worldFloor(x: number, z: number): number {
  return groundY(x, z) + ZEF_FOOT;
}
