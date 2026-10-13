// Procedural dinosaur rigs. Each species is a hierarchy of pivots (hips,
// legs, torso, neck, head, jaw, tail chain, tiny arms) built from lathed,
// tubed and rounded shapes, so the animator can walk, hop, dance, roar,
// high-five and hug. Chibi proportions: big heads, big shiny eyes, short legs.

import * as THREE from 'three';
import { cachedGeo, curveFrom, extrude, lathe, merge, roundedBox, tube } from '../three/geometry';
import { addRim } from '../three/rim';
import type { DinoColor, Species } from '../game/rewards';

export interface Leg {
  hip: THREE.Group;
  knee: THREE.Group;
  ankle: THREE.Group;
  side: number;
  front: boolean;
  /** rest hip pitch */
  rest: number;
}

export interface Eye {
  open: THREE.Group;
  happy: THREE.Mesh;
}

export interface Anchors {
  head: THREE.Group;
  face: THREE.Group;
  neck: THREE.Group;
  body: THREE.Group;
  waist: THREE.Group;
  feet: THREE.Group[];
  prop: THREE.Group;
}

export interface Rig {
  species: Species;
  biped: boolean;
  root: THREE.Group;
  bob: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  neck: THREE.Group;
  neck2: THREE.Group | null;
  head: THREE.Group;
  jaw: THREE.Group;
  eyes: Eye[];
  brows: THREE.Mesh[];
  smile: THREE.Mesh;
  blush: THREE.Mesh[];
  legs: Leg[];
  arms: { shoulder: THREE.Group; side: number }[];
  tail: THREE.Group[];
  tailRest: number[];
  anchors: Anchors;
  hipHeight: number;
  /** approximate standing height, for framing */
  height: number;
  /** where the high-five hand is, in root space, when raised */
  handTop: THREE.Vector3;
  /** rest pitches applied before animation */
  neckRest: number;
  neck2Rest: number;
  headRest: number;
  torsoRest: number;
  materials: THREE.Material[];
}

// ------------------------------------------------------------ materials

const matCache = new Map<string, THREE.Material>();

function skin(color: string, sheen = '#ffffff'): THREE.MeshPhysicalMaterial {
  const key = `skin:${color}`;
  let m = matCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (!m) {
    m = addRim(
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.55,
        sheen: 0.5,
        sheenColor: new THREE.Color(sheen),
        sheenRoughness: 0.5,
        clearcoat: 0.15,
        clearcoatRoughness: 0.5,
      }),
      '#fff6e0',
      0.3,
    );
    m.name = key;
    matCache.set(key, m);
  }
  return m;
}

function shared<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) {
    m = make();
    m.name = key;
    matCache.set(key, m);
  }
  return m;
}

function eyeMats() {
  return {
    white: shared('eye-white', () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.15, clearcoat: 1 })),
    iris: shared('eye-iris', () => new THREE.MeshPhysicalMaterial({ color: '#1d1430', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 })),
    shine: shared('eye-shine', () => new THREE.MeshBasicMaterial({ color: '#ffffff' })),
    line: shared('eye-line', () => new THREE.MeshStandardMaterial({ color: '#2a1a2e', roughness: 0.5 })),
    blush: shared(
      'blush',
      () => new THREE.MeshBasicMaterial({ color: '#ff7f9e', transparent: true, opacity: 0.42, depthWrite: false }),
    ),
    mouth: shared('mouth', () => new THREE.MeshStandardMaterial({ color: '#6b1f33', roughness: 0.6 })),
    tongue: shared('tongue', () => new THREE.MeshStandardMaterial({ color: '#ff7f9e', roughness: 0.5 })),
    tooth: shared('tooth', () => new THREE.MeshPhysicalMaterial({ color: '#fffdf2', roughness: 0.25, clearcoat: 0.6 })),
    horn: shared('horn', () => new THREE.MeshPhysicalMaterial({ color: '#fff1cf', roughness: 0.35, clearcoat: 0.5 })),
    nail: shared('nail', () => new THREE.MeshStandardMaterial({ color: '#fff4d6', roughness: 0.5 })),
    nostril: shared('nostril', () => new THREE.MeshStandardMaterial({ color: '#2a1a2e', roughness: 0.6 })),
  };
}

function darker(hex: string, k = 0.72): string {
  return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
}

// ------------------------------------------------------------ helpers

function grp(name: string, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
}

function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number] = [0, 0, 0],
  rot: [number, number, number] = [0, 0, 0],
  scale: number | [number, number, number] = 1,
  shadow = false,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  if (typeof scale === 'number') m.scale.setScalar(scale);
  else m.scale.set(...scale);
  m.castShadow = shadow;
  return m;
}

const SPH = () => cachedGeo('d-sph', () => new THREE.SphereGeometry(1, 24, 18));
const SPH_LO = () => cachedGeo('d-sph-lo', () => new THREE.SphereGeometry(1, 14, 10));
const CONE = () => cachedGeo('d-cone', () => new THREE.ConeGeometry(1, 1, 14, 1).translate(0, 0.5, 0));
const RCONE = () =>
  cachedGeo('d-rcone', () =>
    lathe(
      [
        [0.0, 0],
        [1.0, 0.02],
        [0.9, 0.35],
        [0.5, 0.75],
        [0.12, 0.98],
        [0, 1],
      ],
      14,
      12,
    ),
  );
const DISC = () => cachedGeo('d-disc', () => new THREE.CircleGeometry(1, 20));
const ARC = () => cachedGeo('d-arc', () => new THREE.TorusGeometry(1, 0.22, 6, 18, Math.PI));
const CAPS = (r: number, len: number) => cachedGeo(`d-caps-${r}-${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14));

/** A tapered tail/neck piece along -z (or a custom direction). */
function taper(key: string, from: [number, number, number], to: [number, number, number], r0: number, r1: number) {
  return cachedGeo(`d-taper-${key}`, () =>
    tube(curveFrom([from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], to]), {
      segments: 8,
      radial: 14,
      radius: (t) => {
        const r = r0 + (r1 - r0) * t;
        // round the far end closed
        const end = t > 0.85 ? Math.sqrt(Math.max(0.05, 1 - Math.pow((t - 0.85) / 0.15, 2))) : 1;
        return r * end;
      },
    }),
  );
}

function plateShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0);
  s.quadraticCurveTo(-0.55, 0.45, 0, 1);
  s.quadraticCurveTo(0.55, 0.45, 0.5, 0);
  s.quadraticCurveTo(0, -0.08, -0.5, 0);
  return s;
}

// ------------------------------------------------------------ shared parts

interface FaceOpts {
  eyeX: number;
  eyeY: number;
  eyeZ: number;
  eyeR: number;
  eyeYaw: number;
  smileZ: number;
  smileY: number;
  smileR: number;
  cheekX: number;
  cheekY: number;
  cheekZ: number;
  browY: number;
}

function addFace(head: THREE.Group, body: string, o: FaceOpts) {
  const em = eyeMats();
  const eyes: Eye[] = [];
  const brows: THREE.Mesh[] = [];
  const blush: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const pivot = grp('eye', o.eyeX * side, o.eyeY, o.eyeZ);
    pivot.rotation.y = o.eyeYaw * side;
    const open = grp('eye-open');
    open.add(mesh(SPH(), em.white, [0, 0, 0], [0, 0, 0], [o.eyeR, o.eyeR * 1.1, o.eyeR * 0.72]));
    open.add(mesh(SPH(), em.iris, [0, -o.eyeR * 0.04, o.eyeR * 0.36], [0, 0, 0], [o.eyeR * 0.72, o.eyeR * 0.8, o.eyeR * 0.5]));
    open.add(mesh(SPH_LO(), em.shine, [o.eyeR * 0.24 * -side, o.eyeR * 0.32, o.eyeR * 0.78], [0, 0, 0], o.eyeR * 0.24));
    open.add(mesh(SPH_LO(), em.shine, [o.eyeR * -0.18 * -side, o.eyeR * -0.22, o.eyeR * 0.8], [0, 0, 0], o.eyeR * 0.11));
    pivot.add(open);
    const happy = mesh(ARC(), em.line, [0, -o.eyeR * 0.1, o.eyeR * 0.55], [0, 0, 0], o.eyeR * 0.62);
    happy.visible = false;
    pivot.add(happy);
    head.add(pivot);
    eyes.push({ open, happy });
    const brow = mesh(CAPS(0.2, 0.9), skin(darker(body, 0.62)), [o.eyeX * side * 0.95, o.browY, o.eyeZ + o.eyeR * 0.3], [0, 0, Math.PI / 2 + side * 0.12], o.eyeR * 0.42);
    head.add(brow);
    brows.push(brow);
    const b = mesh(DISC(), em.blush, [o.cheekX * side, o.cheekY, o.cheekZ], [0, side * 0.9, 0], o.eyeR * 0.75);
    head.add(b);
    blush.push(b);
  }
  const smile = mesh(ARC(), em.line, [0, o.smileY, o.smileZ], [0, 0, Math.PI], [o.smileR, o.smileR * 0.8, o.smileR]);
  head.add(smile);
  return { eyes, brows, smile, blush };
}

function toes(parent: THREE.Group, n: number, spread: number, z: number, y: number, r: number) {
  const em = eyeMats();
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * spread;
    parent.add(mesh(SPH_LO(), em.nail, [x, y, z], [0, 0, 0], [r, r * 0.8, r]));
  }
}

function quadLeg(
  hips: THREE.Group,
  bodyMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  len: number,
  thick: number,
  front: boolean,
  side: number,
): Leg {
  const hip = grp('hip', x, y, z);
  hip.add(mesh(SPH(), bodyMat, [0, -len * 0.18, 0], [0, 0, 0], [thick * 1.25, thick * 1.55, thick * 1.35], true));
  const knee = grp('knee', 0, -len * 0.5, 0);
  knee.add(mesh(CAPS(1, 1), bodyMat, [0, -len * 0.22, 0], [0, 0, 0], [thick * 0.92, len * 0.32, thick * 0.92], true));
  const ankle = grp('ankle', 0, -len * 0.5 + thick * 0.4, 0);
  ankle.add(mesh(SPH(), bodyMat, [0, -thick * 0.2, thick * 0.12], [0, 0, 0], [thick * 1.05, thick * 0.6, thick * 1.25], true));
  toes(ankle, 3, thick * 0.55, thick * 1.05, -thick * 0.38, thick * 0.32);
  const foot = grp('foot-anchor', 0, -thick * 0.25, thick * 0.1);
  ankle.add(foot);
  knee.add(ankle);
  hip.add(knee);
  hips.add(hip);
  return { hip, knee, ankle, side, front, rest: 0 };
}

// ------------------------------------------------------------ species

export function buildRig(species: Species, color: DinoColor, opts: { coach?: boolean } = {}): Rig {
  switch (species) {
    case 'trex':
      return buildTrex(color, !!opts.coach);
    case 'trike':
      return buildTrike(color);
    case 'stego':
      return buildStego(color);
    case 'longneck':
      return buildLongneck(color);
  }
}

function base(species: Species, biped: boolean, hipHeight: number) {
  const root = grp(`dino-${species}`);
  const bob = grp('bob');
  const hips = grp('hips', 0, hipHeight, 0);
  bob.add(hips);
  root.add(bob);
  return { root, bob, hips, biped };
}

function buildTrex(c: DinoColor, coach: boolean): Rig {
  const { root, bob, hips } = base('trex', true, 0.4);
  const bodyMat = skin(c.body);
  const bellyMat = skin(c.belly);
  const accentMat = skin(c.accent);
  const em = eyeMats();

  // legs
  const legs: Leg[] = [];
  for (const side of [-1, 1]) {
    const hip = grp('hip', 0.15 * side, 0, 0);
    hip.add(mesh(SPH(), bodyMat, [0, -0.05, 0], [0, 0, 0], [0.13, 0.16, 0.14], true));
    const knee = grp('knee', 0, -0.17, 0.02);
    knee.add(mesh(CAPS(1, 1), bodyMat, [0, -0.07, 0], [0, 0, 0], [0.068, 0.07, 0.068], true));
    const ankle = grp('ankle', 0, -0.17, 0);
    ankle.add(mesh(roundedBox(0.15, 0.07, 0.22, 0.03), bodyMat, [0, -0.025, 0.04], [0, 0, 0], 1, true));
    toes(ankle, 3, 0.045, 0.145, -0.035, 0.028);
    const foot = grp('foot-anchor', 0, -0.03, 0.04);
    ankle.add(foot);
    knee.add(ankle);
    hip.add(knee);
    hips.add(hip);
    legs.push({ hip, knee, ankle, side, front: false, rest: 0 });
  }

  // torso
  const torso = grp('torso', 0, 0.02, 0);
  const torsoRest = 0.14;
  const bodyGeo = cachedGeo('trex-body', () =>
    lathe(
      [
        [0, 0],
        [0.18, 0.03],
        [0.27, 0.16],
        [0.28, 0.3],
        [0.23, 0.45],
        [0.15, 0.55],
        [0, 0.6],
      ],
      28,
      24,
    ),
  );
  torso.add(mesh(bodyGeo, bodyMat, [0, -0.06, 0], [0, 0, 0], 1, true));
  torso.add(mesh(SPH(), bellyMat, [0, 0.21, 0.13], [0.1, 0, 0], [0.205, 0.25, 0.14]));
  // back spikes
  const spikeGeo = RCONE();
  [
    [0.5, -0.1, 0.07],
    [0.36, -0.2, 0.08],
    [0.2, -0.25, 0.075],
  ].forEach(([y, z, s]) => torso.add(mesh(spikeGeo, accentMat, [0, y, z], [-0.5, 0, 0], [s * 0.7, s, s * 0.7])));
  hips.add(torso);

  // arms (tiny!)
  const arms: Rig['arms'] = [];
  for (const side of [-1, 1]) {
    const shoulder = grp('shoulder', 0.19 * side, 0.36, 0.13);
    shoulder.add(mesh(CAPS(1, 1), bodyMat, [0, -0.05, 0], [0, 0, 0], [0.04, 0.05, 0.04]));
    shoulder.add(mesh(SPH(), bodyMat, [0, -0.11, 0.01], [0, 0, 0], 0.045));
    const claw = CONE();
    shoulder.add(mesh(claw, em.nail, [0.015, -0.15, 0.02], [Math.PI, 0, 0.2], [0.012, 0.035, 0.012]));
    shoulder.add(mesh(claw, em.nail, [-0.015, -0.15, 0.02], [Math.PI, 0, -0.2], [0.012, 0.035, 0.012]));
    torso.add(shoulder);
    arms.push({ shoulder, side });
  }

  // neck + head
  const neck = grp('neck', 0, 0.5, 0.06);
  torso.add(neck);
  const head = grp('head', 0, 0.08, 0.04);
  neck.add(head);
  const upper = cachedGeo('trex-head', () => {
    const skull = new THREE.SphereGeometry(0.27, 28, 20);
    skull.scale(1, 0.9, 1);
    skull.translate(0, 0.14, 0);
    const snout = new THREE.SphereGeometry(0.21, 26, 18);
    snout.scale(0.92, 0.72, 1.0);
    snout.translate(0, 0.07, 0.2);
    return merge([skull, snout]);
  });
  head.add(mesh(upper, bodyMat, [0, 0, 0], [0, 0, 0], 1, true));
  // mouth inside (visible when the jaw drops)
  head.add(mesh(SPH(), em.mouth, [0, -0.02, 0.18], [0, 0, 0], [0.15, 0.06, 0.18]));
  // teeth
  const tooth = CONE();
  [
    [0.06, 0.34],
    [-0.06, 0.34],
    [0.12, 0.27],
    [-0.12, 0.27],
  ].forEach(([x, z]) => head.add(mesh(tooth, em.tooth, [x, -0.035, z], [Math.PI, 0, 0], [0.022, 0.05, 0.022])));
  const jaw = grp('jaw', 0, -0.0, 0.04);
  jaw.add(mesh(SPH(), bodyMat, [0, -0.035, 0.15], [0, 0, 0], [0.17, 0.07, 0.19], true));
  jaw.add(mesh(SPH(), bellyMat, [0, -0.045, 0.16], [0, 0, 0], [0.15, 0.055, 0.17]));
  jaw.add(mesh(SPH(), em.tongue, [0, -0.012, 0.15], [0, 0, 0], [0.085, 0.03, 0.11]));
  head.add(jaw);
  // nostrils
  for (const s of [-1, 1]) head.add(mesh(SPH_LO(), em.nostril, [0.05 * s, 0.135, 0.39], [0, 0, 0], [0.018, 0.012, 0.012]));
  // head bumps
  [
    [0.38, -0.02, 0.06],
    [0.35, -0.14, 0.055],
    [0.28, -0.24, 0.05],
  ].forEach(([y, z, s]) => head.add(mesh(spikeGeo, accentMat, [0, y, z], [-0.3, 0, 0], [s * 0.8, s, s * 0.8])));
  const face = addFace(head, c.body, {
    eyeX: 0.145,
    eyeY: 0.2,
    eyeZ: 0.2,
    eyeR: 0.078,
    eyeYaw: 0.38,
    smileZ: 0.385,
    smileY: 0.0,
    smileR: 0.07,
    cheekX: 0.2,
    cheekY: 0.08,
    cheekZ: 0.27,
    browY: 0.31,
  });

  // tail
  const tail: THREE.Group[] = [];
  const tailRest = [-0.12, 0.05, 0.09, 0.12];
  const radii = [0.15, 0.115, 0.085, 0.058, 0.03];
  let parent: THREE.Object3D = hips;
  let at: [number, number, number] = [0, 0.13, -0.17];
  for (let i = 0; i < 4; i++) {
    const seg = grp(`tail${i}`, ...at);
    seg.add(mesh(taper(`trex-t${i}`, [0, 0, 0.04], [0, 0, -0.21], radii[i], radii[i + 1]), bodyMat, [0, 0, 0], [0, 0, 0], 1, true));
    if (i < 3) seg.add(mesh(spikeGeo, accentMat, [0, radii[i] * 0.85, -0.08], [-0.4, 0, 0], [0.045 - i * 0.008, 0.06 - i * 0.01, 0.045 - i * 0.008]));
    parent.add(seg);
    tail.push(seg);
    parent = seg;
    at = [0, 0, -0.17];
  }

  // accessory anchors
  const anchors: Anchors = {
    head: grp('a-head', 0, 0.37, -0.02),
    face: grp('a-face', 0, 0.2, 0.3),
    neck: grp('a-neck', 0, 0.44, 0.2),
    body: grp('a-body', 0, 0.24, 0.0),
    waist: grp('a-waist', 0, 0.06, 0),
    feet: legs.map((l) => l.ankle.getObjectByName('foot-anchor') as THREE.Group),
    prop: grp('a-prop', 0, 0.2, 0.33),
  };
  head.add(anchors.head, anchors.face);
  torso.add(anchors.neck, anchors.body, anchors.prop);
  hips.add(anchors.waist);
  anchors.neck.rotation.x = -0.25;

  if (coach) {
    // a coach's whistle on a cord
    const cord = mesh(cachedGeo('whistle-cord', () => new THREE.TorusGeometry(0.2, 0.008, 6, 32)), shared('cord', () => new THREE.MeshStandardMaterial({ color: '#e63946', roughness: 0.6 })), [0, 0.47, 0.06], [1.25, 0, 0], [1, 1.1, 1]);
    torso.add(cord);
    const whistle = grp('whistle', 0, 0.3, 0.27);
    const metal = shared('whistle-metal', () => new THREE.MeshPhysicalMaterial({ color: '#d9dde6', metalness: 0.9, roughness: 0.25 }));
    whistle.add(mesh(cachedGeo('whistle-body', () => new THREE.CylinderGeometry(0.035, 0.035, 0.05, 16).rotateZ(Math.PI / 2)), metal));
    whistle.add(mesh(roundedBox(0.03, 0.025, 0.06, 0.008), metal, [0.03, 0.01, 0.03]));
    torso.add(whistle);
  }

  return {
    species: 'trex',
    biped: true,
    root,
    bob,
    hips,
    torso,
    neck,
    neck2: null,
    head,
    jaw,
    eyes: face.eyes,
    brows: face.brows,
    smile: face.smile,
    blush: face.blush,
    legs,
    arms,
    tail,
    tailRest,
    anchors,
    hipHeight: 0.4,
    height: 1.35,
    handTop: new THREE.Vector3(-0.22, 1.05, 0.25),
    neckRest: 0,
    neck2Rest: 0,
    headRest: -0.08,
    torsoRest,
    materials: [bodyMat, bellyMat, accentMat],
  };
}

function buildTrike(c: DinoColor): Rig {
  const { root, bob, hips } = base('trike', false, 0.33);
  const bodyMat = skin(c.body);
  const bellyMat = skin(c.belly);
  const accentMat = skin(c.accent);
  const em = eyeMats();
  const torso = grp('torso', 0, 0.1, 0);
  const bodyGeo = cachedGeo('trike-body', () => {
    const g = lathe(
      [
        [0, 0],
        [0.2, 0.04],
        [0.31, 0.2],
        [0.335, 0.42],
        [0.3, 0.62],
        [0.21, 0.76],
        [0, 0.84],
      ],
      28,
      24,
    );
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, 0.42);
    return g;
  });
  torso.add(mesh(bodyGeo, bodyMat, [0, 0, 0], [0, 0, 0], [1, 0.92, 1], true));
  torso.add(mesh(SPH(), bellyMat, [0, -0.1, 0.02], [0, 0, 0], [0.27, 0.2, 0.36]));
  // back spots
  [
    [0.12, 0.27, 0.12],
    [-0.1, 0.28, -0.05],
    [0.08, 0.26, -0.22],
    [-0.13, 0.22, 0.22],
  ].forEach(([x, y, z]) => torso.add(mesh(SPH_LO(), accentMat, [x, y, z], [0, 0, 0], [0.07, 0.03, 0.07])));
  hips.add(torso);

  const legs = [
    quadLeg(hips, bodyMat, -0.17, 0.0, 0.24, 0.33, 0.085, true, -1),
    quadLeg(hips, bodyMat, 0.17, 0.0, 0.24, 0.33, 0.085, true, 1),
    quadLeg(hips, bodyMat, -0.18, 0.0, -0.24, 0.33, 0.095, false, -1),
    quadLeg(hips, bodyMat, 0.18, 0.0, -0.24, 0.33, 0.095, false, 1),
  ];

  const neck = grp('neck', 0, 0.08, 0.38);
  torso.add(neck);
  const head = grp('head', 0, 0.04, 0.12);
  neck.add(head);
  head.add(mesh(SPH(), bodyMat, [0, 0.04, 0.05], [0, 0, 0], [0.21, 0.19, 0.23], true));
  // beak
  head.add(mesh(SPH(), em.horn, [0, -0.0, 0.25], [0.15, 0, 0], [0.1, 0.1, 0.12]));
  head.add(mesh(CONE(), em.horn, [0, -0.02, 0.33], [1.9, 0, 0], [0.05, 0.08, 0.05]));
  // frill
  const frill = cachedGeo('trike-frill', () => {
    const g = new THREE.CylinderGeometry(0.34, 0.34, 0.035, 28, 1, false, -Math.PI / 2 - 0.35, Math.PI + 0.7);
    g.rotateX(-Math.PI / 2);
    return g;
  });
  const frillMesh = mesh(frill, accentMat, [0, 0.1, -0.1], [-0.45, 0, 0], 1, true);
  head.add(frillMesh);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 - 0.3 + (i / 8) * (Math.PI + 0.6);
    frillMesh.add(mesh(SPH_LO(), bodyMat, [Math.sin(a) * 0.33, Math.cos(a) * 0.33, 0], [0, 0, 0], [0.045, 0.045, 0.03]));
  }
  // horns
  for (const s of [-1, 1]) head.add(mesh(RCONE(), em.horn, [0.09 * s, 0.2, 0.07], [0.95, 0, -0.18 * s], [0.04, 0.24, 0.04]));
  head.add(mesh(RCONE(), em.horn, [0, 0.07, 0.27], [0.6, 0, 0], [0.032, 0.09, 0.032]));
  const jaw = grp('jaw', 0, -0.06, 0.1);
  jaw.add(mesh(SPH(), bellyMat, [0, -0.03, 0.08], [0, 0, 0], [0.13, 0.055, 0.15], true));
  jaw.add(mesh(SPH(), em.tongue, [0, -0.01, 0.08], [0, 0, 0], [0.07, 0.025, 0.09]));
  head.add(jaw);
  head.add(mesh(SPH(), em.mouth, [0, -0.06, 0.18], [0, 0, 0], [0.1, 0.04, 0.12]));
  for (const s of [-1, 1]) head.add(mesh(SPH_LO(), em.nostril, [0.035 * s, 0.05, 0.33], [0, 0, 0], [0.013, 0.009, 0.009]));
  const face = addFace(head, c.body, {
    eyeX: 0.12,
    eyeY: 0.08,
    eyeZ: 0.17,
    eyeR: 0.07,
    eyeYaw: 0.45,
    smileZ: 0.26,
    smileY: -0.075,
    smileR: 0.05,
    cheekX: 0.16,
    cheekY: -0.01,
    cheekZ: 0.18,
    browY: 0.17,
  });

  const tail: THREE.Group[] = [];
  const tailRest = [-0.25, -0.1, 0.05];
  const radii = [0.13, 0.095, 0.06, 0.03];
  let parent: THREE.Object3D = hips;
  let at: [number, number, number] = [0, 0.13, -0.38];
  for (let i = 0; i < 3; i++) {
    const seg = grp(`tail${i}`, ...at);
    seg.add(mesh(taper(`trike-t${i}`, [0, 0, 0.03], [0, 0, -0.18], radii[i], radii[i + 1]), bodyMat, [0, 0, 0], [0, 0, 0], 1, true));
    parent.add(seg);
    tail.push(seg);
    parent = seg;
    at = [0, 0, -0.15];
  }

  const anchors: Anchors = {
    head: grp('a-head', 0, 0.21, 0.02),
    face: grp('a-face', 0, 0.08, 0.24),
    neck: grp('a-neck', 0, 0.12, 0.36),
    body: grp('a-body', 0, 0.06, 0),
    waist: grp('a-waist', 0, 0.1, -0.05),
    feet: legs.map((l) => l.ankle.getObjectByName('foot-anchor') as THREE.Group),
    prop: grp('a-prop', 0, 0.0, 0.2),
  };
  head.add(anchors.head, anchors.face);
  torso.add(anchors.neck, anchors.body);
  hips.add(anchors.waist);
  jaw.add(anchors.prop);
  anchors.head.scale.setScalar(0.82);
  anchors.face.scale.setScalar(0.82);
  anchors.neck.rotation.x = -0.6;

  return {
    species: 'trike',
    biped: false,
    root,
    bob,
    hips,
    torso,
    neck,
    neck2: null,
    head,
    jaw,
    eyes: face.eyes,
    brows: face.brows,
    smile: face.smile,
    blush: face.blush,
    legs,
    arms: [],
    tail,
    tailRest,
    anchors,
    hipHeight: 0.33,
    height: 0.95,
    handTop: new THREE.Vector3(-0.18, 0.75, 0.42),
    neckRest: -0.1,
    neck2Rest: 0,
    headRest: 0.05,
    torsoRest: 0,
    materials: [bodyMat, bellyMat, accentMat],
  };
}

function buildStego(c: DinoColor): Rig {
  const { root, bob, hips } = base('stego', false, 0.36);
  const bodyMat = skin(c.body);
  const bellyMat = skin(c.belly);
  const accentMat = skin(c.accent);
  const em = eyeMats();
  const torso = grp('torso', 0, 0.1, 0);
  const torsoRest = 0.08;
  const bodyGeo = cachedGeo('stego-body', () => {
    const g = lathe(
      [
        [0, 0],
        [0.17, 0.05],
        [0.29, 0.22],
        [0.33, 0.45],
        [0.28, 0.66],
        [0.18, 0.82],
        [0, 0.9],
      ],
      28,
      24,
    );
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, 0.45);
    g.scale(1, 1.12, 1);
    return g;
  });
  torso.add(mesh(bodyGeo, bodyMat, [0, 0, 0], [0, 0, 0], 1, true));
  torso.add(mesh(SPH(), bellyMat, [0, -0.12, 0.02], [0, 0, 0], [0.24, 0.18, 0.38]));
  // plates along the back
  const plate = cachedGeo('stego-plate', () => extrude(plateShape(), 0.035, 0.012, 10).translate(0, 0, -0.0175));
  const plates: [number, number, number][] = [
    [0.33, 0.3, 0.12],
    [0.37, 0.18, 0.16],
    [0.39, 0.04, 0.2],
    [0.38, -0.1, 0.21],
    [0.35, -0.24, 0.18],
    [0.29, -0.36, 0.14],
    [0.21, -0.46, 0.1],
  ];
  plates.forEach(([y, z, s], i) => {
    const side = i % 2 ? 1 : -1;
    torso.add(mesh(plate, accentMat, [0.035 * side, y - 0.03, z], [0, Math.PI / 2, side * 0.12], [s * 1.1, s * 1.15, s], true));
  });
  hips.add(torso);

  const legs = [
    quadLeg(hips, bodyMat, -0.16, -0.06, 0.27, 0.28, 0.08, true, -1),
    quadLeg(hips, bodyMat, 0.16, -0.06, 0.27, 0.28, 0.08, true, 1),
    quadLeg(hips, bodyMat, -0.17, 0.0, -0.25, 0.36, 0.095, false, -1),
    quadLeg(hips, bodyMat, 0.17, 0.0, -0.25, 0.36, 0.095, false, 1),
  ];

  const neck = grp('neck', 0, 0.0, 0.42);
  torso.add(neck);
  neck.add(mesh(taper('stego-neck', [0, 0, -0.05], [0, -0.02, 0.14], 0.13, 0.11), bodyMat, [0, 0, 0], [0, 0, 0], 1, true));
  const head = grp('head', 0, -0.02, 0.15);
  neck.add(head);
  head.add(mesh(SPH(), bodyMat, [0, 0.02, 0.1], [0, 0, 0], [0.15, 0.13, 0.19], true));
  head.add(mesh(SPH(), bodyMat, [0, -0.01, 0.22], [0, 0, 0], [0.1, 0.08, 0.1], true));
  const jaw = grp('jaw', 0, -0.05, 0.08);
  jaw.add(mesh(SPH(), bellyMat, [0, -0.02, 0.1], [0, 0, 0], [0.09, 0.04, 0.12], true));
  jaw.add(mesh(SPH(), em.tongue, [0, 0.0, 0.1], [0, 0, 0], [0.05, 0.02, 0.07]));
  head.add(jaw);
  head.add(mesh(SPH(), em.mouth, [0, -0.05, 0.16], [0, 0, 0], [0.07, 0.03, 0.09]));
  for (const s of [-1, 1]) head.add(mesh(SPH_LO(), em.nostril, [0.03 * s, 0.03, 0.31], [0, 0, 0], [0.011, 0.008, 0.008]));
  const face = addFace(head, c.body, {
    eyeX: 0.085,
    eyeY: 0.07,
    eyeZ: 0.17,
    eyeR: 0.058,
    eyeYaw: 0.5,
    smileZ: 0.3,
    smileY: -0.05,
    smileR: 0.04,
    cheekX: 0.11,
    cheekY: 0.0,
    cheekZ: 0.2,
    browY: 0.14,
  });

  const tail: THREE.Group[] = [];
  const tailRest = [-0.2, 0.0, 0.1, 0.15];
  const radii = [0.14, 0.105, 0.075, 0.05, 0.025];
  let parent: THREE.Object3D = hips;
  let at: [number, number, number] = [0, 0.12, -0.42];
  for (let i = 0; i < 4; i++) {
    const seg = grp(`tail${i}`, ...at);
    seg.add(mesh(taper(`stego-t${i}`, [0, 0, 0.03], [0, 0, -0.19], radii[i], radii[i + 1]), bodyMat, [0, 0, 0], [0, 0, 0], 1, true));
    if (i === 3) {
      for (const s of [-1, 1]) {
        seg.add(mesh(RCONE(), em.horn, [0.03 * s, 0.03, -0.06], [-0.9, 0, -0.9 * s], [0.025, 0.14, 0.025]));
        seg.add(mesh(RCONE(), em.horn, [0.025 * s, 0.03, -0.14], [-1.1, 0, -0.8 * s], [0.022, 0.12, 0.022]));
      }
    }
    parent.add(seg);
    tail.push(seg);
    parent = seg;
    at = [0, 0, -0.17];
  }

  const anchors: Anchors = {
    head: grp('a-head', 0, 0.14, 0.08),
    face: grp('a-face', 0, 0.07, 0.2),
    neck: grp('a-neck', 0, 0.02, 0.36),
    body: grp('a-body', 0, 0.1, 0),
    waist: grp('a-waist', 0, 0.1, -0.05),
    feet: legs.map((l) => l.ankle.getObjectByName('foot-anchor') as THREE.Group),
    prop: grp('a-prop', 0, 0.0, 0.16),
  };
  head.add(anchors.head, anchors.face);
  torso.add(anchors.neck, anchors.body);
  hips.add(anchors.waist);
  jaw.add(anchors.prop);
  anchors.head.scale.setScalar(0.56);
  anchors.face.scale.setScalar(0.62);
  anchors.neck.rotation.x = -0.75;
  anchors.neck.scale.setScalar(0.9);

  return {
    species: 'stego',
    biped: false,
    root,
    bob,
    hips,
    torso,
    neck,
    neck2: null,
    head,
    jaw,
    eyes: face.eyes,
    brows: face.brows,
    smile: face.smile,
    blush: face.blush,
    legs,
    arms: [],
    tail,
    tailRest,
    anchors,
    hipHeight: 0.36,
    height: 1.0,
    handTop: new THREE.Vector3(-0.16, 0.7, 0.45),
    neckRest: 0.15,
    neck2Rest: 0,
    headRest: -0.1,
    torsoRest,
    materials: [bodyMat, bellyMat, accentMat],
  };
}

function buildLongneck(c: DinoColor): Rig {
  const { root, bob, hips } = base('longneck', false, 0.36);
  const bodyMat = skin(c.body);
  const bellyMat = skin(c.belly);
  const accentMat = skin(c.accent);
  const em = eyeMats();
  const torso = grp('torso', 0, 0.1, 0);
  const torsoRest = -0.05;
  const bodyGeo = cachedGeo('longneck-body', () => {
    const g = lathe(
      [
        [0, 0],
        [0.2, 0.05],
        [0.33, 0.24],
        [0.36, 0.42],
        [0.31, 0.62],
        [0.2, 0.76],
        [0, 0.82],
      ],
      28,
      24,
    );
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, 0.41);
    return g;
  });
  torso.add(mesh(bodyGeo, bodyMat, [0, 0, 0], [0, 0, 0], 1, true));
  torso.add(mesh(SPH(), bellyMat, [0, -0.12, 0.03], [0, 0, 0], [0.28, 0.2, 0.34]));
  [
    [0.15, 0.24, 0.1, 0.07],
    [-0.12, 0.27, -0.06, 0.08],
    [0.06, 0.3, -0.22, 0.06],
    [-0.16, 0.2, 0.2, 0.05],
    [0.18, 0.16, -0.3, 0.05],
  ].forEach(([x, y, z, s]) => torso.add(mesh(SPH_LO(), accentMat, [x, y, z], [0, 0, 0], [s, s * 0.4, s])));
  hips.add(torso);

  const legs = [
    quadLeg(hips, bodyMat, -0.17, 0.0, 0.24, 0.36, 0.09, true, -1),
    quadLeg(hips, bodyMat, 0.17, 0.0, 0.24, 0.36, 0.09, true, 1),
    quadLeg(hips, bodyMat, -0.18, 0.0, -0.24, 0.34, 0.095, false, -1),
    quadLeg(hips, bodyMat, 0.18, 0.0, -0.24, 0.34, 0.095, false, 1),
  ];

  const neck = grp('neck', 0, 0.16, 0.3);
  torso.add(neck);
  neck.add(mesh(taper('ln-neck1', [0, -0.05, -0.04], [0, 0.34, 0.08], 0.14, 0.105), bodyMat, [0, 0, 0], [0, 0, 0], 1, true));
  neck.add(mesh(SPH_LO(), accentMat, [0, 0.16, 0.1], [0.3, 0, 0], [0.05, 0.02, 0.05]));
  const neck2 = grp('neck2', 0, 0.32, 0.075);
  neck.add(neck2);
  neck2.add(mesh(taper('ln-neck2', [0, -0.04, -0.01], [0, 0.3, 0.05], 0.105, 0.085), bodyMat, [0, 0, 0], [0, 0, 0], 1, true));
  neck2.add(mesh(SPH_LO(), accentMat, [0, 0.12, 0.08], [0.3, 0, 0], [0.04, 0.016, 0.04]));
  const head = grp('head', 0, 0.3, 0.05);
  neck2.add(head);
  head.add(mesh(SPH(), bodyMat, [0, 0.03, 0.06], [0, 0, 0], [0.15, 0.13, 0.17], true));
  head.add(mesh(SPH(), bodyMat, [0, -0.0, 0.17], [0, 0, 0], [0.11, 0.09, 0.11], true));
  head.add(mesh(SPH(), bodyMat, [0, 0.13, 0.08], [0, 0, 0], [0.07, 0.05, 0.08]));
  const jaw = grp('jaw', 0, -0.05, 0.06);
  jaw.add(mesh(SPH(), bellyMat, [0, -0.02, 0.1], [0, 0, 0], [0.09, 0.04, 0.11], true));
  jaw.add(mesh(SPH(), em.tongue, [0, 0.0, 0.1], [0, 0, 0], [0.05, 0.02, 0.07]));
  head.add(jaw);
  head.add(mesh(SPH(), em.mouth, [0, -0.045, 0.14], [0, 0, 0], [0.07, 0.03, 0.08]));
  for (const s of [-1, 1]) head.add(mesh(SPH_LO(), em.nostril, [0.03 * s, 0.16, 0.13], [0, 0, 0], [0.012, 0.009, 0.009]));
  const face = addFace(head, c.body, {
    eyeX: 0.09,
    eyeY: 0.07,
    eyeZ: 0.13,
    eyeR: 0.058,
    eyeYaw: 0.5,
    smileZ: 0.27,
    smileY: -0.04,
    smileR: 0.045,
    cheekX: 0.115,
    cheekY: 0.0,
    cheekZ: 0.16,
    browY: 0.14,
  });

  const tail: THREE.Group[] = [];
  const tailRest = [-0.25, -0.05, 0.05, 0.1, 0.12];
  const radii = [0.13, 0.1, 0.075, 0.052, 0.034, 0.018];
  let parent: THREE.Object3D = hips;
  let at: [number, number, number] = [0, 0.12, -0.38];
  for (let i = 0; i < 5; i++) {
    const seg = grp(`tail${i}`, ...at);
    seg.add(mesh(taper(`ln-t${i}`, [0, 0, 0.03], [0, 0, -0.19], radii[i], radii[i + 1]), bodyMat, [0, 0, 0], [0, 0, 0], 1, true));
    parent.add(seg);
    tail.push(seg);
    parent = seg;
    at = [0, 0, -0.16];
  }

  const anchors: Anchors = {
    head: grp('a-head', 0, 0.17, 0.05),
    face: grp('a-face', 0, 0.07, 0.17),
    neck: grp('a-neck', 0, 0.05, 0.02),
    body: grp('a-body', 0, 0.08, 0),
    waist: grp('a-waist', 0, 0.1, -0.05),
    feet: legs.map((l) => l.ankle.getObjectByName('foot-anchor') as THREE.Group),
    prop: grp('a-prop', 0, 0.0, 0.15),
  };
  head.add(anchors.head, anchors.face);
  neck.add(anchors.neck);
  torso.add(anchors.body);
  hips.add(anchors.waist);
  jaw.add(anchors.prop);
  anchors.head.scale.setScalar(0.56);
  anchors.face.scale.setScalar(0.62);
  anchors.neck.scale.setScalar(0.6);
  anchors.neck.rotation.x = -0.2;

  return {
    species: 'longneck',
    biped: false,
    root,
    bob,
    hips,
    torso,
    neck,
    neck2,
    head,
    jaw,
    eyes: face.eyes,
    brows: face.brows,
    smile: face.smile,
    blush: face.blush,
    legs,
    arms: [],
    tail,
    tailRest,
    anchors,
    hipHeight: 0.36,
    height: 1.55,
    handTop: new THREE.Vector3(-0.18, 0.8, 0.42),
    neckRest: -0.15,
    neck2Rest: 0.1,
    headRest: 0.15,
    torsoRest,
    materials: [bodyMat, bellyMat, accentMat],
  };
}
