// Smooth cinematic camera. In "follow" mode it trails Zef along the path,
// looking ahead toward the castle; other modes ease toward goals set by the
// game (stop close-ups, cutscene shots, room views). On narrow phone screens
// the field of view widens and close-ups pull back so subjects still fit.

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cam, zef, frameDt } from './actors';
import { tangentAt, terrainHeight, WATER_Y } from './route';
import { motion } from './settings';
import { clamp, damp, lerp, smoothstep } from '../three/util';
import { useGame } from '../state/store';

const DEG = Math.PI / 180;

export function viewFov(aspect: number): number {
  const minH = 54 * DEG;
  const v = 2 * Math.atan(Math.tan(minH / 2) / aspect);
  return clamp(v / DEG, 44, 74);
}

const tmpF = new THREE.Vector3();
const toCastle = new THREE.Vector3();
const goalPos = new THREE.Vector3();
const goalTarget = new THREE.Vector3();
const dir = new THREE.Vector3();

/** Compute the follow-mode goal behind Zef. */
export function followGoal(aspect: number, outPos: THREE.Vector3, outTarget: THREE.Vector3) {
  tangentAt(zef.s + 3, tmpF);
  tmpF.y = 0;
  tmpF.normalize();
  // lean the view toward the castle so it stays on screen (more so on narrow phones)
  const k = smoothstep(0.5, 1.6, aspect);
  toCastle.set(0 - zef.pos.x, 0, -153 - zef.pos.z).normalize();
  tmpF.lerp(toCastle, lerp(0.72, 0.45, k)).normalize();
  // near the start the cottage sits right behind Zef: stay in front of it
  const dist = Math.min(lerp(5.6, 6.4, k), Math.max(2.8, zef.s - 0.6));
  const height = dist * lerp(0.56, 0.48, k);
  outPos.copy(zef.pos).addScaledVector(tmpF, -dist);
  outPos.y = zef.pos.y + height;
  outTarget.copy(zef.pos).addScaledVector(tmpF, 3.0);
  outTarget.y = zef.pos.y + 0.95;
}

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const scene = useGame((s) => s.scene);
  const cur = useRef({ pos: new THREE.Vector3(0, 4, 14), target: new THREE.Vector3(0, 1, 0), init: false, t: 0 });
  const gl = useThree((s) => s.gl);
  const sceneObj = useThree((s) => s.scene);
  (window as unknown as { __scene?: THREE.Scene }).__scene = sceneObj;
  (window as unknown as { __camera?: THREE.Camera; __renderer?: THREE.WebGLRenderer }).__camera = camera;
  (window as unknown as { __renderer?: THREE.WebGLRenderer }).__renderer = gl;

  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    const c = cur.current;
    c.t += dt;
    const aspect = size.width / Math.max(1, size.height);
    const fov = viewFov(aspect) * cam.fovBoost;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = damp(camera.fov, fov, 5, dt);
      camera.updateProjectionMatrix();
    }

    if (cam.mode === 'follow' && scene === 'world') {
      followGoal(aspect, goalPos, goalTarget);
    } else {
      goalPos.copy(cam.pos);
      goalTarget.copy(cam.target);
    }

    // on tall phone screens, centre the surprise itself and frame it tighter
    const portrait = aspect < 0.8;
    let fit = cam.fitWidth;
    if (portrait && cam.mode === 'focus' && cam.focusObject) {
      const shift = goalTarget.clone().lerp(cam.focusObject, 0.55);
      shift.y = Math.max(shift.y, cam.focusObject.y + 0.6);
      goalPos.add(shift.clone().sub(goalTarget).multiplyScalar(0.6));
      goalTarget.copy(shift);
      fit *= 0.62;
    }
    // pull back so a subject of width `fit` fits a narrow screen
    if (fit > 0) {
      const hfov = 2 * Math.atan(Math.tan((camera.fov * DEG) / 2) * aspect);
      const need = fit / 2 / Math.tan(hfov / 2);
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
      const lp = cam.lambda;
      c.pos.set(damp(c.pos.x, goalPos.x, lp, dt), damp(c.pos.y, goalPos.y, lp, dt), damp(c.pos.z, goalPos.z, lp, dt));
      const lt = cam.lambda * 1.4;
      c.target.set(
        damp(c.target.x, goalTarget.x, lt, dt),
        damp(c.target.y, goalTarget.y, lt, dt),
        damp(c.target.z, goalTarget.z, lt, dt),
      );
    }

    camera.position.copy(c.pos);
    // gentle handheld drift for life (off in reduced motion)
    const drift = motion.reduced ? 0 : 0.035;
    camera.position.x += Math.sin(c.t * 0.5) * drift;
    camera.position.y += Math.sin(c.t * 0.37 + 1) * drift;
    if (cam.shake > 0 && !motion.reduced) {
      camera.position.x += (Math.random() - 0.5) * cam.shake;
      camera.position.y += (Math.random() - 0.5) * cam.shake;
      cam.shake = Math.max(0, cam.shake - dt * 0.6);
    }
    if (scene === 'world') {
      const floor = Math.max(terrainHeight(camera.position.x, camera.position.z), WATER_Y) + 0.9;
      if (camera.position.y < floor) camera.position.y = floor;
    }
    camera.lookAt(c.target);
  });
  return null;
}
