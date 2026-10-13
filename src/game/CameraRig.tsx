// Smooth camera. In "board" mode it sits behind and above Zef's dino and
// looks ahead along the path toward the chest (higher and further back on
// tall phone screens). Events take over with "shot" mode. Subjects of a
// given width always fit the screen, however narrow.

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cam, frameDt } from './actors';
import { motion } from './settings';
import { clamp, damp, lerp, smoothstep } from '../three/util';

const DEG = Math.PI / 180;

export function viewFov(aspect: number): number {
  const minH = 56 * DEG;
  const v = 2 * Math.atan(Math.tan(minH / 2) / aspect);
  return clamp(v / DEG, 42, 70);
}

/** Where the board camera is looking from/at. Updated by the board each frame. */
export const boardView = {
  anchor: new THREE.Vector3(),
  ahead: new THREE.Vector3(0, 0, -6),
};

const goalPos = new THREE.Vector3();
const goalTarget = new THREE.Vector3();
const dir = new THREE.Vector3();
const fwd = new THREE.Vector3();

export function boardGoal(aspect: number, outPos: THREE.Vector3, outTarget: THREE.Vector3) {
  const k = smoothstep(0.55, 1.5, aspect);
  fwd.copy(boardView.ahead).sub(boardView.anchor).setY(0);
  if (fwd.lengthSq() < 0.01) fwd.set(0, 0, -1);
  fwd.normalize();
  // keep the view mostly pointing down the board so it doesn't swing about
  fwd.lerp(new THREE.Vector3(0, 0, -1), 0.55).normalize();
  const dist = lerp(6.2, 6.2, k);
  const height = lerp(7.6, 4.8, k);
  outTarget.copy(boardView.anchor).addScaledVector(fwd, lerp(1.0, 1.8, k));
  outTarget.y = boardView.anchor.y + lerp(-0.6, 0.1, k);
  outPos.copy(boardView.anchor).addScaledVector(fwd, -dist);
  outPos.y = boardView.anchor.y + height;
}

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const cur = useRef({ pos: new THREE.Vector3(0, 6, 12), target: new THREE.Vector3(0, 0.6, 0), init: false, t: 0 });
  const gl = useThree((s) => s.gl);
  const sceneObj = useThree((s) => s.scene);
  const w = window as unknown as { __scene?: THREE.Scene; __camera?: THREE.Camera; __renderer?: THREE.WebGLRenderer };
  w.__scene = sceneObj;
  w.__camera = camera;
  w.__renderer = gl;

  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    const c = cur.current;
    c.t += dt;
    const aspect = size.width / Math.max(1, size.height);
    const fov = viewFov(aspect);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = damp(camera.fov, fov, 5, dt);
      camera.updateProjectionMatrix();
    }

    if (cam.mode === 'board') boardGoal(aspect, goalPos, goalTarget);
    else {
      goalPos.copy(cam.pos);
      goalTarget.copy(cam.target);
    }

    // pull back so a subject of width `fitWidth` fits a narrow screen
    if (cam.mode === 'shot' && cam.fitWidth > 0) {
      const hfov = 2 * Math.atan(Math.tan((camera.fov * DEG) / 2) * aspect);
      const need = cam.fitWidth / 2 / Math.tan(hfov / 2);
      dir.copy(goalPos).sub(goalTarget);
      const d = dir.length();
      if (d < need) goalPos.copy(goalTarget).addScaledVector(dir.normalize(), need);
    }

    if (!c.init || cam.snap) {
      c.pos.copy(goalPos);
      c.target.copy(goalTarget);
      c.init = true;
      cam.snap = false;
    } else {
      const lp = motion.reduced ? Math.max(cam.lambda, 4) : cam.lambda;
      c.pos.set(damp(c.pos.x, goalPos.x, lp, dt), damp(c.pos.y, goalPos.y, lp, dt), damp(c.pos.z, goalPos.z, lp, dt));
      const lt = lp * 1.4;
      c.target.set(damp(c.target.x, goalTarget.x, lt, dt), damp(c.target.y, goalTarget.y, lt, dt), damp(c.target.z, goalTarget.z, lt, dt));
    }

    camera.position.copy(c.pos);
    const drift = motion.reduced ? 0 : 0.03;
    camera.position.x += Math.sin(c.t * 0.5) * drift;
    camera.position.y += Math.sin(c.t * 0.37 + 1) * drift;
    if (cam.shake > 0 && !motion.reduced) {
      camera.position.x += (Math.random() - 0.5) * cam.shake;
      camera.position.y += (Math.random() - 0.5) * cam.shake;
      cam.shake = Math.max(0, cam.shake - dt * 0.9);
    } else cam.shake = 0;
    camera.lookAt(c.target);
  });
  return null;
}
