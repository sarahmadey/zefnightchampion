// Zef: a little blond boy in a yellow raincoat, navy shorts, yellow boots and
// a tiny backpack. Built as a jointed hierarchy so walking, pointing, jumping
// and celebrating move real arms, legs, torso and head.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  cachedGeo,
  capsuleRadius,
  curveFrom,
  extrude,
  lathe,
  merge,
  paint,
  roundedBox,
  starShape,
  tube,
} from '../three/geometry';
import { addRim } from '../three/rim';
import { TAU, clamp, damp, dampAngle, ease, lerp, mulberry32, randRange, smoothstep } from '../three/util';
import { zef, frameDt } from '../game/actors';

// ------------------------------------------------------------ materials

function makeMaterials() {
  return {
    skin: addRim(
      new THREE.MeshPhysicalMaterial({
        color: '#ffd5b8',
        roughness: 0.62,
        sheen: 0.6,
        sheenColor: new THREE.Color('#ffb3a8'),
      }),
      '#fff0e6',
      0.25,
    ),
    hair: addRim(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color('#fff3c4'), sheenRoughness: 0.35 }), '#fff6d0', 0.4),
    coat: addRim(new THREE.MeshPhysicalMaterial({ color: '#ffcc12', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }), '#fff7c2', 0.35),
    coatDark: new THREE.MeshPhysicalMaterial({ color: '#f0ac00', roughness: 0.4, clearcoat: 0.5 }),
    navy: addRim(new THREE.MeshStandardMaterial({ color: '#22336b', roughness: 0.78 }), '#9fb4ff', 0.3),
    boot: addRim(new THREE.MeshPhysicalMaterial({ color: '#ffc70f', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }), '#fff7c2', 0.3),
    sole: new THREE.MeshStandardMaterial({ color: '#7a4a2a', roughness: 0.7 }),
    pack: addRim(new THREE.MeshPhysicalMaterial({ color: '#e6405a', roughness: 0.5, clearcoat: 0.3 }), '#ffd0d8', 0.3),
    packDark: new THREE.MeshStandardMaterial({ color: '#b82a42', roughness: 0.55 }),
    star: new THREE.MeshStandardMaterial({ color: '#ffe35a', roughness: 0.35, emissive: new THREE.Color('#5a4400') }),
    toggle: new THREE.MeshStandardMaterial({ color: '#2b3a75', roughness: 0.5 }),
    eye: new THREE.MeshPhysicalMaterial({ color: '#2a1a14', roughness: 0.1, clearcoat: 1 }),
    eyeShine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    brow: new THREE.MeshStandardMaterial({ color: '#d9a43a', roughness: 0.6 }),
    blush: new THREE.MeshBasicMaterial({ color: '#ff7f97', transparent: true, opacity: 0.38, depthWrite: false }),
    mouth: new THREE.MeshStandardMaterial({ color: '#7a2630', roughness: 0.5 }),
    tongue: new THREE.MeshStandardMaterial({ color: '#ff8a9a', roughness: 0.5 }),
    nose: new THREE.MeshPhysicalMaterial({ color: '#ffc0a0', roughness: 0.5, sheen: 0.5 }),
    crown: new THREE.MeshPhysicalMaterial({ color: '#ffcf33', roughness: 0.2, metalness: 0.6, clearcoat: 1, side: THREE.DoubleSide }),
    gemPink: new THREE.MeshPhysicalMaterial({ color: '#ff4f8a', roughness: 0.1, clearcoat: 1, emissive: new THREE.Color('#5a0f2a') }),
    gemBlue: new THREE.MeshPhysicalMaterial({ color: '#4dabf7', roughness: 0.1, clearcoat: 1, emissive: new THREE.Color('#0f2a5a') }),
  };
}

let mats: ReturnType<typeof makeMaterials> | null = null;
function zefMaterials() {
  if (!mats) mats = makeMaterials();
  return mats;
}

// ------------------------------------------------------------- geometry

const HEAD_R = 0.2;

function hairGeometry(): THREE.BufferGeometry {
  return cachedGeo('zef-hair', () => {
    const rng = mulberry32(7);
    const parts: THREE.BufferGeometry[] = [];
    const root = new THREE.Color('#e3a92f');
    const mid = new THREE.Color('#f6cf55');
    const tip = new THREE.Color('#fff0a8');
    const colorize = (g: THREE.BufferGeometry) =>
      paint(g, (_p, _n, uv) => {
        const t = uv.x;
        return new THREE.Color().copy(root).lerp(mid, smoothstep(0, 0.45, t)).lerp(tip, smoothstep(0.55, 1, t));
      });

    // cap: an offset sphere, so it covers the crown and back but leaves the face clear
    const cap = new THREE.SphereGeometry(HEAD_R * 1.07, 32, 20);
    cap.translate(0, 0.028, -0.026);
    paint(cap, (p) => new THREE.Color().copy(root).lerp(mid, smoothstep(-0.05, 0.2, p.y)));
    parts.push(cap);

    const tuft = (theta: number, phi: number, len: number, flow: THREE.Vector3, width: number, curl = 0) => {
      const n = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
      const base = n.clone().multiplyScalar(HEAD_R * 0.98).add(new THREE.Vector3(0, 0.028, -0.026));
      const f = flow.clone().normalize();
      const p1 = base.clone().addScaledVector(n, len * 0.45).addScaledVector(f, len * 0.25);
      const p2 = base.clone().addScaledVector(n, len * 0.55).addScaledVector(f, len * 0.75);
      const side = new THREE.Vector3().crossVectors(n, f).normalize().multiplyScalar(curl * len);
      p2.add(side);
      const p3 = base.clone().addScaledVector(n, len * 0.4).addScaledVector(f, len * 1.05).addScaledVector(side, 1.6);
      const g = tube(curveFrom([[base.x, base.y, base.z], [p1.x, p1.y, p1.z], [p2.x, p2.y, p2.z], [p3.x, p3.y, p3.z]]), {
        segments: 10,
        radial: 7,
        radius: (t) => width * Math.pow(1 - t, 0.85) * (t < 0.1 ? 0.75 + t * 2.5 : 1),
      });
      parts.push(colorize(g));
    };

    // soft crown tufts that curl in different directions — the tousled silhouette
    for (let i = 0; i < 11; i++) {
      const theta = (i / 11) * TAU + randRange(rng, -0.25, 0.25);
      const phi = randRange(rng, 0.25, 0.7);
      const outward = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
      const flow = outward.multiplyScalar(0.9).add(new THREE.Vector3(randRange(rng, -0.5, 0.5), 0.35, -0.35));
      tuft(theta, phi, randRange(rng, 0.075, 0.105), flow, randRange(rng, 0.058, 0.07), randRange(rng, -0.7, 0.7));
    }
    // a couple of cheeky cowlicks at the very top
    tuft(0.4, 0.08, 0.12, new THREE.Vector3(0.5, 0.8, -0.7), 0.05, 0.8);
    tuft(2.7, 0.18, 0.1, new THREE.Vector3(-0.6, 0.7, -0.2), 0.048, -0.7);
    // side and back tufts falling softly downward
    for (let i = 0; i < 12; i++) {
      const theta = Math.PI * 0.38 + (i / 11) * Math.PI * 1.24 + randRange(rng, -0.12, 0.12);
      const phi = randRange(rng, 0.85, 1.3);
      const out = new THREE.Vector3(Math.sin(theta) * 0.55, -1, Math.cos(theta) * 0.55);
      tuft(theta, phi, randRange(rng, 0.06, 0.085), out, randRange(rng, 0.05, 0.062), randRange(rng, -0.5, 0.5));
    }
    // side-swept fringe that hugs the forehead
    const fringeTuft = (theta0: number, sweep: number, width: number, reach: number) => {
      const phis = [0.3, 0.6, 0.85, reach];
      const pts: [number, number, number][] = phis.map((phi, i) => {
        const th = theta0 + sweep * (i / (phis.length - 1));
        const r = i === 0 ? 0.19 : i === phis.length - 1 ? 0.212 : 0.226;
        return [r * Math.sin(phi) * Math.sin(th), r * Math.cos(phi) + 0.012, r * Math.sin(phi) * Math.cos(th)];
      });
      const g = tube(curveFrom(pts), {
        segments: 12,
        radial: 7,
        radius: (t) => width * Math.pow(1 - t, 0.7) * (t < 0.1 ? 0.75 + t * 2.5 : 1),
      });
      parts.push(colorize(g));
    };
    fringeTuft(-0.75, 0.35, 0.05, 1.05);
    fringeTuft(-0.42, 0.38, 0.055, 1.12);
    fringeTuft(-0.1, 0.4, 0.056, 1.1);
    fringeTuft(0.22, 0.4, 0.052, 1.02);
    fringeTuft(0.52, 0.35, 0.05, 0.98);
    fringeTuft(0.82, 0.3, 0.045, 1.08);
    return merge(parts);
  });
}

function coatGeometry(): THREE.BufferGeometry {
  return cachedGeo('zef-coat', () =>
    lathe(
      [
        [0.0, 0.0],
        [0.188, -0.002],
        [0.203, 0.02],
        [0.19, 0.08],
        [0.165, 0.16],
        [0.158, 0.22],
        [0.13, 0.268],
        [0.075, 0.292],
        [0.0, 0.296],
      ],
      36,
      30,
    ),
  );
}

function backpackGeometry(): THREE.BufferGeometry {
  return cachedGeo('zef-pack', () => roundedBox(0.21, 0.21, 0.11, 0.045, 4));
}

function flapGeometry(): THREE.BufferGeometry {
  return cachedGeo('zef-flap', () => roundedBox(0.215, 0.1, 0.03, 0.014, 3));
}

function starGeo(): THREE.BufferGeometry {
  return cachedGeo('zef-star', () => extrude(starShape(5, 0.035, 0.016, 0.1), 0.012, 0.004, 4));
}

function bootGeometry(): THREE.BufferGeometry {
  return cachedGeo('zef-boot', () => {
    const shaft = new THREE.CylinderGeometry(0.058, 0.06, 0.1, 18);
    shaft.translate(0, -0.035, 0);
    const cuff = new THREE.TorusGeometry(0.058, 0.014, 8, 20);
    cuff.rotateX(Math.PI / 2);
    cuff.translate(0, 0.016, 0);
    const foot = tube(curveFrom([[0, -0.1, -0.035], [0, -0.1, 0.03], [0, -0.1, 0.085]]), {
      segments: 10,
      radial: 14,
      radius: capsuleRadius(0.055, 0.3),
    });
    foot.scale(1, 0.86, 1);
    return merge([shaft, cuff, foot]);
  });
}

function soleGeometry(): THREE.BufferGeometry {
  return cachedGeo('zef-sole', () => {
    const g = roundedBox(0.105, 0.03, 0.2, 0.014, 2);
    g.translate(0, -0.13, 0.025);
    return g;
  });
}

function limbGeometry(key: string, r: number, len: number): THREE.BufferGeometry {
  return cachedGeo(`zef-limb-${key}`, () => {
    const g = tube(curveFrom([[0, 0.0, 0], [0, -len * 0.5, 0], [0, -len, 0]]), {
      segments: 8,
      radial: 14,
      radius: capsuleRadius(r, 0.3),
    });
    return g;
  });
}

function mouthSmileGeometry(): THREE.BufferGeometry {
  return cachedGeo('zef-smile', () => {
    const g = new THREE.TorusGeometry(0.045, 0.011, 8, 20, Math.PI * 0.9);
    g.rotateZ(Math.PI + Math.PI * 0.05);
    return g;
  });
}

function mouthOpenGeometry(): THREE.BufferGeometry {
  return cachedGeo('zef-grin', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.055, 0.0);
    s.quadraticCurveTo(0, -0.002, 0.055, 0);
    s.quadraticCurveTo(0.05, -0.07, 0, -0.072);
    s.quadraticCurveTo(-0.05, -0.07, -0.055, 0);
    return extrude(s, 0.012, 0.004, 10);
  });
}

function eyeArcGeometry(): THREE.BufferGeometry {
  return cachedGeo('zef-eyearc', () => {
    const g = new THREE.TorusGeometry(0.03, 0.009, 6, 14, Math.PI * 0.85);
    g.rotateZ(Math.PI * 0.075);
    return g;
  });
}

function browGeometry(): THREE.BufferGeometry {
  return cachedGeo('zef-brow', () => {
    const g = new THREE.TorusGeometry(0.045, 0.008, 6, 12, Math.PI * 0.55);
    g.rotateZ(Math.PI * 0.22);
    return g;
  });
}

// ---------------------------------------------------------------- poses

interface Pose {
  hipL: number;
  hipR: number;
  hipLz: number;
  hipRz: number;
  kneeL: number;
  kneeR: number;
  ankleL: number;
  ankleR: number;
  armLx: number;
  armLz: number;
  armRx: number;
  armRz: number;
  armLy: number;
  armRy: number;
  foreL: number;
  foreR: number;
  torsoX: number;
  torsoY: number;
  torsoZ: number;
  headX: number;
  headY: number;
  headZ: number;
  bodyY: number;
  spin: number;
  finger: number;
}

function basePose(): Pose {
  return {
    hipL: 0,
    hipR: 0,
    hipLz: 0,
    hipRz: 0,
    kneeL: 0,
    kneeR: 0,
    ankleL: 0,
    ankleR: 0,
    armLx: 0,
    armLz: 0.26,
    armRx: 0,
    armRz: -0.26,
    armLy: 0,
    armRy: 0,
    foreL: -0.25,
    foreR: -0.25,
    torsoX: 0,
    torsoY: 0,
    torsoZ: 0,
    headX: 0,
    headY: 0,
    headZ: 0,
    bodyY: 0,
    spin: 0,
    finger: 0,
  };
}

const POSE_KEYS = Object.keys(basePose()) as (keyof Pose)[];

function mixPose(a: Pose, b: Pose, w: number, out: Pose): Pose {
  for (const k of POSE_KEYS) out[k] = lerp(a[k], b[k], w);
  return out;
}

/** Action poses as a function of normalised time u (0..1) and absolute time. */
function actionPose(name: string, u: number, time: number, p: Pose): { air: number; stretch: number } {
  let air = 0;
  let stretch = 1;
  switch (name) {
    case 'point': {
      const k = ease.outBack(Math.min(1, u * 4));
      p.armRx = -1.45 * k;
      p.armRz = -0.25 * k;
      p.foreR = -0.05;
      p.finger = k;
      p.torsoY = -0.15 * k;
      p.headY = -0.1 * k;
      p.armLz = 0.25;
      break;
    }
    case 'wave': {
      p.armRz = -2.55;
      p.armRx = -0.2;
      p.foreR = -0.2 + Math.sin(time * 14) * 0.45;
      p.armRy = Math.sin(time * 14) * 0.25;
      p.headZ = 0.1;
      break;
    }
    case 'jump':
    case 'celebrate': {
      // anticipation → take-off → air → landing squash
      const crouch = u < 0.18 ? ease.inOutSine(u / 0.18) : u < 0.28 ? 1 - (u - 0.18) / 0.1 : 0;
      const flight = u > 0.22 && u < 0.78 ? (u - 0.22) / 0.56 : -1;
      const land = u > 0.78 ? Math.sin(((u - 0.78) / 0.22) * Math.PI) : 0;
      p.bodyY = -0.08 * crouch - 0.06 * land;
      p.hipL = p.hipR = -0.7 * crouch - 0.5 * land;
      p.kneeL = p.kneeR = 1.3 * crouch + 0.9 * land;
      p.ankleL = p.ankleR = -0.6 * crouch - 0.4 * land;
      p.torsoX = 0.3 * crouch;
      if (flight >= 0) {
        air = Math.sin(flight * Math.PI) * (name === 'celebrate' ? 0.55 : 0.4);
        stretch = 1 + 0.12 * Math.sin(flight * Math.PI * 0.5 + 0.2) * (1 - flight);
        p.hipL = -0.35;
        p.hipR = 0.25;
        p.kneeL = 0.6;
        p.kneeR = 0.9;
      }
      if (u > 0.78) stretch = 1 - 0.12 * land;
      if (u < 0.2) stretch = 1 - 0.1 * crouch;
      const armsUp = name === 'celebrate' ? 1 : smoothstep(0.15, 0.3, u) * (1 - smoothstep(0.75, 0.95, u));
      p.armLz = lerp(0.12, 2.7, armsUp) + (name === 'celebrate' ? Math.sin(time * 12) * 0.15 : 0);
      p.armRz = lerp(-0.12, -2.7, armsUp) - (name === 'celebrate' ? Math.sin(time * 12 + 1) * 0.15 : 0);
      p.foreL = p.foreR = -0.15;
      if (name === 'celebrate' && flight >= 0) p.spin = ease.inOutSine(flight) * TAU;
      if (name === 'celebrate' && u >= 0.78) p.spin = TAU;
      break;
    }
    case 'cheer': {
      const pump = Math.abs(Math.sin(time * 7));
      p.armLz = 2.4 + pump * 0.3;
      p.armRz = -2.4 - pump * 0.3;
      p.foreL = p.foreR = -0.3 - pump * 0.4;
      p.bodyY = -0.02 * pump;
      p.kneeL = p.kneeR = 0.2 * pump;
      p.hipL = p.hipR = -0.1 * pump;
      p.headX = -0.15;
      break;
    }
    case 'clap': {
      const c = Math.sin(time * 16);
      p.armLx = p.armRx = -1.1;
      p.armLz = 0.35 + c * 0.25;
      p.armRz = -0.35 - c * 0.25;
      p.armLy = -0.5;
      p.armRy = 0.5;
      p.foreL = p.foreR = -0.5;
      p.headX = -0.1;
      break;
    }
    case 'knock': {
      const k = Math.max(0, Math.sin(time * 15));
      p.armRx = -1.25 - k * 0.15;
      p.armRz = -0.15;
      p.foreR = -0.9 + k * 0.7;
      p.torsoX = 0.08;
      break;
    }
    case 'push': {
      p.armLx = p.armRx = -1.4;
      p.armLz = 0.25;
      p.armRz = -0.25;
      p.foreL = p.foreR = -0.15;
      p.torsoX = 0.25;
      p.hipL = -0.4;
      p.kneeL = 0.5;
      p.hipR = 0.3;
      break;
    }
    case 'lookUp': {
      p.headX = -0.45;
      p.torsoX = -0.1;
      p.armLz = 0.3;
      p.armRz = -0.3;
      break;
    }
    case 'stretch': {
      const k = Math.sin(Math.min(1, u * 1.2) * Math.PI);
      p.armLz = 0.12 + 2.8 * k;
      p.armRz = -0.12 - 2.8 * k;
      p.foreL = p.foreR = -0.1;
      p.torsoX = -0.15 * k;
      p.headX = -0.25 * k;
      stretch = 1 + 0.06 * k;
      break;
    }
    case 'shrug': {
      const k = Math.sin(Math.min(1, u * 1.1) * Math.PI);
      p.armLz = 0.6 * k + 0.12;
      p.armRz = -0.6 * k - 0.12;
      p.foreL = p.foreR = -1.2 * k - 0.25;
      p.armLy = -0.6 * k;
      p.armRy = 0.6 * k;
      p.headZ = 0.2 * k;
      p.torsoX = -0.05 * k;
      break;
    }
    case 'sit':
    case 'ride':
    case 'swing': {
      p.hipL = p.hipR = -1.45;
      p.kneeL = p.kneeR = name === 'swing' ? 1.1 + Math.sin(time * 2.4) * 0.35 : 1.5;
      p.ankleL = p.ankleR = 0;
      p.bodyY = -0.22;
      p.torsoX = name === 'swing' ? Math.sin(time * 2.4) * 0.12 : 0;
      if (name === 'ride' || name === 'swing') {
        p.armLx = p.armRx = -0.9;
        p.armLz = 0.35;
        p.armRz = -0.35;
        p.foreL = p.foreR = -0.9;
      } else {
        p.armLz = 0.25;
        p.armRz = -0.25;
        p.armLx = p.armRx = -0.35;
        p.foreL = p.foreR = -0.6;
      }
      break;
    }
    case 'hugged': {
      p.hipL = p.hipR = -1.45;
      p.kneeL = p.kneeR = 1.5;
      p.bodyY = -0.22;
      p.armLx = p.armRx = -1.0;
      p.armLz = 0.7;
      p.armRz = -0.7;
      p.armLy = -0.6;
      p.armRy = 0.6;
      p.foreL = p.foreR = -0.9;
      p.headZ = 0.22 + Math.sin(time * 1.2) * 0.04;
      p.headX = 0.08;
      p.torsoZ = Math.sin(time * 1.2) * 0.04;
      break;
    }
  }
  return { air, stretch };
}

// --------------------------------------------------------------- component

export function Zef() {
  const m = zefMaterials();
  const g = useMemo(
    () => ({
      hair: hairGeometry(),
      coat: coatGeometry(),
      pack: backpackGeometry(),
      flap: flapGeometry(),
      star: starGeo(),
      boot: bootGeometry(),
      sole: soleGeometry(),
      thigh: limbGeometry('thigh', 0.07, 0.13),
      shin: limbGeometry('shin', 0.041, 0.12),
      upper: limbGeometry('upper', 0.048, 0.14),
      fore: limbGeometry('fore', 0.044, 0.13),
      finger: limbGeometry('finger', 0.014, 0.05),
      smile: mouthSmileGeometry(),
      grin: mouthOpenGeometry(),
      eyeArc: eyeArcGeometry(),
      brow: browGeometry(),
    }),
    [],
  );

  const root = useRef<THREE.Group>(null!);
  const spinner = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const kneeL = useRef<THREE.Group>(null!);
  const kneeR = useRef<THREE.Group>(null!);
  const ankleL = useRef<THREE.Group>(null!);
  const ankleR = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const foreL = useRef<THREE.Group>(null!);
  const foreR = useRef<THREE.Group>(null!);
  const finger = useRef<THREE.Mesh>(null!);
  const eyes = useRef<THREE.Group>(null!);
  const eyesHappy = useRef<THREE.Group>(null!);
  const smile = useRef<THREE.Mesh>(null!);
  const grin = useRef<THREE.Group>(null!);
  const ooh = useRef<THREE.Mesh>(null!);
  const hairRef = useRef<THREE.Mesh>(null!);
  const crownRef = useRef<THREE.Group>(null!);

  const st = useRef({
    phase: 0,
    blinkT: 0,
    nextBlink: 2.5,
    actionW: 0,
    lookYaw: 0,
    lookPitch: 0,
    cur: basePose(),
    tgt: basePose(),
    loco: basePose(),
    act: basePose(),
    stretch: 1,
    air: 0,
    idleLook: 0,
    idleLookT: 3,
  });

  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const s = st.current;
    const time = state.clock.elapsedTime;
    const r = root.current;
    r.visible = zef.visible;
    r.position.copy(zef.pos);
    r.rotation.y = zef.heading;

    // ---- locomotion
    const speed = zef.speed;
    const walkW = smoothstep(0.05, 0.7, speed);
    const run = clamp(zef.runFactor, 0, 1);
    s.phase += dt * (speed * 4.4 + walkW * 1.5);
    const ph = s.phase;
    const sw = Math.sin(ph);
    const cw = Math.cos(ph);
    const L = s.loco;
    Object.assign(L, basePose());
    const amp = 0.55 + run * 0.25;
    L.hipL = -sw * amp * walkW;
    L.hipR = sw * amp * walkW;
    L.kneeL = Math.max(0, cw) * (0.7 + run * 0.4) * walkW;
    L.kneeR = Math.max(0, -cw) * (0.7 + run * 0.4) * walkW;
    L.ankleL = -L.hipL * 0.4 - L.kneeL * 0.35;
    L.ankleR = -L.hipR * 0.4 - L.kneeR * 0.35;
    L.armLx = sw * (0.5 + run * 0.3) * walkW;
    L.armRx = -sw * (0.5 + run * 0.3) * walkW;
    L.foreL = -0.25 - walkW * (0.25 + run * 0.5);
    L.foreR = -0.25 - walkW * (0.25 + run * 0.5);
    L.bodyY = Math.abs(cw) * 0.03 * walkW - 0.015 * walkW;
    L.torsoX = 0.05 * walkW + 0.12 * run;
    L.torsoY = sw * 0.09 * walkW;
    L.headY = -sw * 0.05 * walkW;
    // idle: breathe, sway and glance around
    const idle = 1 - walkW;
    L.torsoZ = Math.sin(time * 0.9) * 0.025 * idle;
    L.armLz += Math.sin(time * 1.8) * 0.02 * idle;
    L.armRz -= Math.sin(time * 1.8 + 0.4) * 0.02 * idle;
    s.idleLookT -= dt;
    if (s.idleLookT <= 0) {
      s.idleLookT = 2.5 + Math.random() * 3;
      s.idleLook = (Math.random() - 0.5) * 0.9;
    }

    // ---- action overlay
    const a = zef.action;
    let air = 0;
    let stretch = 1;
    if (a.name !== 'none') {
      a.t += dt;
      if (!a.loop && a.t >= a.dur) {
        a.name = 'none';
      }
    }
    const active = a.name !== 'none';
    s.actionW = damp(s.actionW, active ? 1 : 0, active ? 14 : 7, dt);
    const A = s.act;
    Object.assign(A, L);
    if (active) {
      const res = actionPose(a.name, a.dur > 0 ? clamp(a.t / a.dur, 0, 1) : 0, time, A);
      air = res.air;
      stretch = res.stretch;
    }
    mixPose(L, A, active ? s.actionW : 0, s.tgt);
    const T = s.tgt;

    // ---- look at a target
    let wantYaw = idle * s.idleLook * (active ? 0 : 1) * 0.6;
    let wantPitch = 0;
    if (zef.look) {
      const local = r.worldToLocal(zef.look.clone());
      const headH = 0.86;
      wantYaw = clamp(Math.atan2(local.x, local.z), -1.1, 1.1);
      wantPitch = clamp(-Math.atan2(local.y - headH, Math.hypot(local.x, local.z)), -0.6, 0.45);
    }
    s.lookYaw = dampAngle(s.lookYaw, wantYaw, 6, dt);
    s.lookPitch = damp(s.lookPitch, wantPitch, 6, dt);
    T.headY += s.lookYaw * 0.7;
    T.torsoY += s.lookYaw * 0.3;
    T.headX += s.lookPitch;

    // ---- ease all joints toward the target pose
    const C = s.cur;
    const k = 16;
    for (const key of POSE_KEYS) {
      if (key === 'spin') continue;
      C[key] = damp(C[key], T[key], k, dt);
    }
    C.spin = T.spin;

    s.air = active ? air : damp(s.air, 0, 10, dt);
    s.stretch = damp(s.stretch, stretch * zef.stretch, 20, dt);

    body.current.position.y = C.bodyY + zef.air + s.air;
    const sq = s.stretch;
    body.current.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    spinner.current.rotation.y = C.spin;
    legL.current.rotation.set(C.hipL, 0, C.hipLz);
    legR.current.rotation.set(C.hipR, 0, C.hipRz);
    kneeL.current.rotation.x = C.kneeL;
    kneeR.current.rotation.x = C.kneeR;
    ankleL.current.rotation.x = C.ankleL;
    ankleR.current.rotation.x = C.ankleR;
    torso.current.rotation.set(C.torsoX, C.torsoY, C.torsoZ);
    torso.current.scale.y = 1 + Math.sin(time * 2.2) * 0.008;
    armL.current.rotation.set(C.armLx, C.armLy, C.armLz);
    armR.current.rotation.set(C.armRx, C.armRy, C.armRz);
    foreL.current.rotation.x = C.foreL;
    foreR.current.rotation.x = C.foreR;
    head.current.rotation.set(C.headX, C.headY, C.headZ);
    finger.current.scale.setScalar(Math.max(0.001, C.finger));

    // hair bounce and breeze
    const hairWobble = Math.sin(time * 9) * 0.03 * walkW + Math.sin(time * 6.5) * 0.05 * zef.breeze;
    hairRef.current.rotation.z = hairWobble;
    hairRef.current.rotation.x = Math.abs(cw) * 0.03 * walkW + zef.breeze * 0.06;

    // ---- face
    s.blinkT += dt;
    let blink = 1;
    if (s.blinkT > s.nextBlink) {
      const bt = s.blinkT - s.nextBlink;
      blink = bt < 0.14 ? Math.abs(Math.cos((bt / 0.14) * Math.PI)) : 1;
      if (bt >= 0.14) {
        s.blinkT = 0;
        s.nextBlink = 2 + Math.random() * 3.5;
      }
    }
    const ex = zef.expression;
    const happyEyes = ex === 'happy' || ex === 'cozy';
    eyes.current.visible = !happyEyes;
    eyesHappy.current.visible = happyEyes;
    eyesHappy.current.scale.y = ex === 'cozy' ? -0.7 : 1;
    const eyeOpen = ex === 'calm' ? 0.55 : ex === 'sleepy' ? 0.15 : ex === 'wow' ? 1.18 : 1;
    eyes.current.scale.set(ex === 'wow' ? 1.12 : 1, eyeOpen * blink, 1);
    crownRef.current.visible = zef.crown;
    if (zef.crown) crownRef.current.rotation.y = Math.sin(time * 1.5) * 0.05;
    smile.current.visible = ex === 'smile' || ex === 'calm' || ex === 'cozy' || ex === 'sleepy';
    grin.current.visible = ex === 'happy';
    ooh.current.visible = ex === 'wow';
  });

  const shadow = true;
  return (
    <group ref={root} dispose={null}>
      <group ref={spinner}>
        <group ref={body}>
          {/* legs */}
          {(['L', 'R'] as const).map((side) => {
            const sx = side === 'L' ? 1 : -1;
            return (
              <group key={side} ref={side === 'L' ? legL : legR} position={[0.075 * sx, 0.38, 0]}>
                <mesh geometry={g.thigh} material={m.navy} castShadow={shadow} />
                <group ref={side === 'L' ? kneeL : kneeR} position={[0, -0.12, 0]}>
                  <mesh geometry={g.shin} material={m.skin} castShadow={shadow} />
                  <group ref={side === 'L' ? ankleL : ankleR} position={[0, -0.12, 0]}>
                    <mesh geometry={g.boot} material={m.boot} castShadow={shadow} />
                    <mesh geometry={g.sole} material={m.sole} />
                  </group>
                </group>
              </group>
            );
          })}

          {/* torso */}
          <group ref={torso} position={[0, 0.38, 0]}>
            {/* shorts waistband peeking under the coat */}
            <mesh material={m.navy} position={[0, -0.02, 0]} castShadow={shadow}>
              <cylinderGeometry args={[0.15, 0.165, 0.09, 24]} />
            </mesh>
            <mesh geometry={g.coat} material={m.coat} castShadow={shadow} />
            {/* placket, toggles, pockets, collar, hood */}
            <mesh material={m.coatDark} position={[0, 0.11, 0.18]} rotation={[-0.185, 0, 0]}>
              <boxGeometry args={[0.036, 0.29, 0.012]} />
            </mesh>
            {[
              [0.03, 0.206],
              [0.11, 0.19],
              [0.19, 0.173],
            ].map(([y, z]) => (
              <mesh key={y} material={m.toggle} position={[0, y, z]} rotation={[0, 0, Math.PI / 2]}>
                <capsuleGeometry args={[0.012, 0.035, 4, 8]} />
              </mesh>
            ))}
            {[-1, 1].map((sx) => (
              <mesh key={sx} material={m.coatDark} position={[0.1 * sx, 0.025, 0.176]} rotation={[-0.18, 0.53 * sx, 0]}>
                <boxGeometry args={[0.08, 0.035, 0.015]} />
              </mesh>
            ))}
            <mesh material={m.coat} position={[0, 0.27, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.085, 0.03, 10, 24]} />
            </mesh>
            {[-1, 1].map((sx) => (
              <mesh key={`c${sx}`} material={m.coat} position={[0.05 * sx, 0.27, 0.085]} rotation={[0.5, 0, -0.6 * sx]}>
                <coneGeometry args={[0.035, 0.07, 3]} />
              </mesh>
            ))}
            <mesh material={m.coat} position={[0, 0.25, -0.11]} scale={[1.2, 0.75, 0.85]}>
              <sphereGeometry args={[0.09, 16, 12]} />
            </mesh>

            {/* backpack with straps and a star */}
            <group position={[0, 0.12, -0.2]}>
              <mesh geometry={g.pack} material={m.pack} castShadow={shadow} />
              <mesh geometry={g.flap} material={m.packDark} position={[0, 0.07, -0.05]} rotation={[0.12, 0, 0]} />
              <mesh geometry={g.star} material={m.star} position={[0, 0.0, -0.062]} rotation={[0, Math.PI, 0]} />
            </group>
            {[-1, 1].map((sx) => (
              <mesh key={`s${sx}`} material={m.packDark} position={[0.085 * sx, 0.13, 0.0]} rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[0.152, 0.012, 6, 18, Math.PI]} />
              </mesh>
            ))}

            {/* arms */}
            {(['L', 'R'] as const).map((side) => {
              const sx = side === 'L' ? 1 : -1;
              return (
                <group key={side} ref={side === 'L' ? armL : armR} position={[0.165 * sx, 0.232, 0]}>
                  <mesh geometry={g.upper} material={m.coat} castShadow={shadow} />
                  <group ref={side === 'L' ? foreL : foreR} position={[0, -0.13, 0]}>
                    <mesh geometry={g.fore} material={m.coat} castShadow={shadow} />
                    <mesh material={m.coatDark} position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
                      <torusGeometry args={[0.045, 0.013, 6, 16]} />
                    </mesh>
                    <mesh material={m.skin} position={[0, -0.168, 0.005]} scale={[0.95, 1.05, 0.85]}>
                      <sphereGeometry args={[0.048, 16, 12]} />
                    </mesh>
                    <mesh material={m.skin} position={[-0.032 * sx, -0.152, 0.03]}>
                      <sphereGeometry args={[0.019, 8, 6]} />
                    </mesh>
                    {side === 'R' && (
                      <mesh
                        ref={finger}
                        geometry={g.finger}
                        material={m.skin}
                        position={[0, -0.195, 0.02]}
                        rotation={[0.25, 0, 0]}
                      />
                    )}
                  </group>
                </group>
              );
            })}

            {/* head */}
            <group ref={head} position={[0, 0.3, 0]}>
              <group position={[0, 0.17, 0]}>
                <mesh material={m.skin} scale={[1.02, 0.96, 0.97]} castShadow={shadow}>
                  <sphereGeometry args={[HEAD_R, 36, 28]} />
                </mesh>
                <mesh ref={hairRef} geometry={g.hair} material={m.hair} castShadow={shadow} />
                {/* a little golden crown for the castle throne */}
                <group ref={crownRef} position={[0, 0.25, -0.02]} rotation={[-0.15, 0, 0.08]} visible={false}>
                  <mesh material={m.crown}>
                    <cylinderGeometry args={[0.13, 0.12, 0.09, 20, 1, true]} />
                  </mesh>
                  {Array.from({ length: 6 }, (_, i) => {
                    const a = (i / 6) * Math.PI * 2;
                    return (
                      <group key={i} position={[Math.cos(a) * 0.125, 0.07, Math.sin(a) * 0.125]}>
                        <mesh material={m.crown}>
                          <coneGeometry args={[0.03, 0.08, 6]} />
                        </mesh>
                        <mesh material={i % 2 ? m.gemPink : m.gemBlue} position={[0, 0.05, 0]}>
                          <sphereGeometry args={[0.018, 8, 6]} />
                        </mesh>
                      </group>
                    );
                  })}
                </group>
                {/* ears */}
                {[-1, 1].map((sx) => (
                  <mesh key={sx} material={m.skin} position={[0.196 * sx, -0.015, 0.0]} scale={[0.6, 1, 0.8]}>
                    <sphereGeometry args={[0.045, 12, 10]} />
                  </mesh>
                ))}
                {/* eyes */}
                <group ref={eyes}>
                  {[-1, 1].map((sx) => (
                    <group key={sx} position={[0.074 * sx, -0.01, 0.178]} rotation={[0, 0.38 * sx, 0]}>
                      <mesh material={m.eye} scale={[1, 1.32, 0.55]}>
                        <sphereGeometry args={[0.035, 16, 12]} />
                      </mesh>
                      <mesh material={m.eyeShine} position={[0.009, 0.016, 0.016]}>
                        <sphereGeometry args={[0.009, 8, 6]} />
                      </mesh>
                      <mesh material={m.eyeShine} position={[-0.01, -0.012, 0.016]}>
                        <sphereGeometry args={[0.004, 6, 4]} />
                      </mesh>
                    </group>
                  ))}
                </group>
                <group ref={eyesHappy} visible={false}>
                  {[-1, 1].map((sx) => (
                    <mesh
                      key={sx}
                      geometry={g.eyeArc}
                      material={m.eye}
                      position={[0.074 * sx, -0.018, 0.186]}
                      rotation={[0, 0.38 * sx, 0]}
                    />
                  ))}
                </group>
                {/* brows */}
                {[-1, 1].map((sx) => (
                  <mesh
                    key={`b${sx}`}
                    geometry={g.brow}
                    material={m.brow}
                    position={[0.074 * sx, 0.035, 0.18]}
                    rotation={[0, 0.38 * sx, sx > 0 ? 0 : 0.1]}
                  />
                ))}
                {/* nose, cheeks */}
                <mesh material={m.nose} position={[0, -0.045, 0.197]}>
                  <sphereGeometry args={[0.019, 10, 8]} />
                </mesh>
                {[-1, 1].map((sx) => (
                  <mesh
                    key={`k${sx}`}
                    material={m.blush}
                    position={[0.12 * sx, -0.06, 0.155]}
                    rotation={[0, 0.65 * sx, 0]}
                  >
                    <circleGeometry args={[0.03, 16]} />
                  </mesh>
                ))}
                {/* mouths */}
                <mesh ref={smile} geometry={g.smile} material={m.mouth} position={[0, -0.075, 0.19]} rotation={[-0.25, 0, 0]} />
                <group ref={grin} position={[0, -0.075, 0.186]} rotation={[-0.2, 0, 0]} visible={false}>
                  <mesh geometry={g.grin} material={m.mouth} />
                  <mesh material={m.tongue} position={[0, -0.05, 0.005]} scale={[1.4, 0.7, 0.5]}>
                    <sphereGeometry args={[0.022, 10, 8]} />
                  </mesh>
                </group>
                <mesh ref={ooh} material={m.mouth} position={[0, -0.085, 0.188]} scale={[0.8, 1, 0.4]} visible={false}>
                  <sphereGeometry args={[0.025, 12, 10]} />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
