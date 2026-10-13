// Shared bits for the castle rooms: free walking on a flat floor around round
// obstacles, Pip following, and a camera that frames Zef within the room.

import { useEffect, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { cam, frameDt, pip, zef } from '../game/actors';
import { placePip, setPipSide, updatePip, updateZef, walkFree } from '../game/nav';
import { useGame } from '../state/store';
import { clamp } from '../three/util';

export interface RoomSpec {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  obstacles: { x: number; z: number; r: number }[];
  start: THREE.Vector3;
  /** camera offset from Zef and the clamp range for its x position */
  camOffset: THREE.Vector3;
  camXRange: [number, number];
  camZRange: [number, number];
  lookAhead: number;
  fit: number;
}

function clampToRoom(p: THREE.Vector3, spec: RoomSpec) {
  const b = spec.bounds;
  p.x = clamp(p.x, b.minX, b.maxX);
  p.z = clamp(p.z, b.minZ, b.maxZ);
  for (const o of spec.obstacles) {
    const dx = p.x - o.x;
    const dz = p.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < o.r) {
      const k = (o.r + 0.05) / Math.max(d, 1e-4);
      p.x = o.x + dx * k;
      p.z = o.z + dz * k;
    }
  }
  return p;
}

/** Plan a short path from a to b that steps around round obstacles. */
export function planPath(a: THREE.Vector3, b: THREE.Vector3, spec: RoomSpec): THREE.Vector3[] {
  const target = clampToRoom(b.clone().setY(0), spec);
  for (const o of spec.obstacles) {
    const ab = new THREE.Vector3().subVectors(target, a).setY(0);
    const len = ab.length();
    if (len < 1e-3) continue;
    const dir = ab.clone().divideScalar(len);
    const ao = new THREE.Vector3(o.x - a.x, 0, o.z - a.z);
    const t = clamp(ao.dot(dir), 0, len);
    const closest = a.clone().setY(0).addScaledVector(dir, t);
    const dist = Math.hypot(closest.x - o.x, closest.z - o.z);
    if (dist < o.r && t > 0 && t < len) {
      // go around on the side the path is already leaning to
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const s = Math.sign(side.dot(new THREE.Vector3(closest.x - o.x, 0, closest.z - o.z))) || 1;
      const wp = new THREE.Vector3(o.x, 0, o.z).addScaledVector(side, s * (o.r + 0.6));
      return [clampToRoom(wp, spec), target];
    }
  }
  return [target];
}

export function useRoom(spec: RoomSpec, active: boolean) {
  const lastTap = useRef(0);
  useEffect(() => {
    if (!active) return;
    zef.scripted = false;
    zef.nav = null;
    zef.pos.copy(spec.start);
    zef.heading = Math.PI;
    zef.look = null;
    zef.expression = 'happy';
    pip.mode = 'follow';
    pip.pose = 'stand';
    pip.look = null;
    setPipSide(-1);
    placePip(spec.start.clone().add(new THREE.Vector3(-0.9, 0, 0.5)), Math.PI);
    cam.mode = 'room';
    cam.fitWidth = spec.fit;
    cam.lambda = 2.4;
    roomCamera(spec);
    cam.snap = true;
    const t = setTimeout(() => (zef.expression = 'smile'), 1500);
    return () => clearTimeout(t);
  }, [spec, active]);

  useFrame((_, rawDt) => {
    if (!active) return;
    const dt = frameDt(rawDt);
    updateZef(dt, null, () => 0);
    updatePip(dt, () => 0);
    roomCamera(spec);
  });

  const onFloor = (e: ThreeEvent<PointerEvent>) => {
    const g = useGame.getState();
    if (g.cutscene || g.parentOpen) return;
    const now = performance.now();
    if (now - lastTap.current < 120) return;
    lastTap.current = now;
    e.stopPropagation();
    if (zef.scripted) return;
    walkFree(planPath(zef.pos.clone(), e.point, spec));
  };
  return { onFloor };
}

export function roomCamera(spec: RoomSpec) {
  const x = clamp(zef.pos.x * 0.7, spec.camXRange[0], spec.camXRange[1]);
  const z = clamp(zef.pos.z, spec.camZRange[0], spec.camZRange[1]);
  cam.pos.set(x + spec.camOffset.x, spec.camOffset.y, z + spec.camOffset.z);
  cam.target.set(x * 0.9, 1.3, z - spec.lookAhead);
}

/** Walk Zef next to something, then run a callback. */
export function walkToThen(spec: RoomSpec, to: THREE.Vector3, then: () => void) {
  walkFree(planPath(zef.pos.clone(), to, spec), then);
}
