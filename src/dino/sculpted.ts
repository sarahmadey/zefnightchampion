// Sculpted dinosaurs. Each species is a skeleton of bones (the same joints the
// animator drives: hips, torso, neck, head, jaw, legs, arms, tail) wrapped in
// one smooth skin sculpted from blended primitives, plus separate pieces for
// eyes and lids, teeth, claws, horns, spikes and plates. Inspired by vinyl toy
// dinosaurs: real anatomy (snout, jaw, muscled legs, clawed toes, a long tail)
// with big friendly eyes.

import * as THREE from 'three';
import { Below, Ellipsoid, RoundBox, RoundCone, Sculpt, meshSculpt, type Region, type V3 } from './sdf';
export type { V3 };
import { part, skinMaterial } from './skin';
import type { DinoColor, Species } from '../game/rewards';

export interface Leg {
  hip: THREE.Object3D;
  knee: THREE.Object3D;
  ankle: THREE.Object3D;
  side: number;
  front: boolean;
  rest: number;
}

export interface Eye {
  open: THREE.Object3D;
  happy: THREE.Mesh;
  /** upper and lower lids, rotated to blink and squint */
  lid?: THREE.Object3D;
  lower?: THREE.Object3D;
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
  hips: THREE.Object3D;
  torso: THREE.Object3D;
  neck: THREE.Object3D;
  neck2: THREE.Object3D | null;
  head: THREE.Object3D;
  jaw: THREE.Object3D;
  eyes: Eye[];
  brows: THREE.Mesh[];
  smile: THREE.Mesh;
  blush: THREE.Mesh[];
  legs: Leg[];
  arms: { shoulder: THREE.Object3D; side: number }[];
  tail: THREE.Object3D[];
  tailRest: number[];
  anchors: Anchors;
  hipHeight: number;
  height: number;
  handTop: THREE.Vector3;
  /** the high-five hand's palm in the first arm's own space */
  hand?: THREE.Vector3;
  neckRest: number;
  neck2Rest: number;
  headRest: number;
  torsoRest: number;
  materials: THREE.Material[];
}

// ------------------------------------------------------------ materials

export function mats(c: DinoColor, markStyle = 0) {
  const marks = '#' + new THREE.Color(c.body).multiplyScalar(0.62).getHexString();
  return {
    skin: skinMaterial({ body: c.body, belly: c.belly, marks }, { marks: markStyle }),
    accent: part(`acc:${c.accent}`, () => new THREE.MeshPhysicalMaterial({ color: c.accent, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.35 })),
    spike: part(`spike:${c.accent}:${c.body}`, () => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(c.accent).lerp(new THREE.Color(c.body), 0.45).multiplyScalar(0.9), roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 })),
    lid: part(`lid:${c.body}`, () => new THREE.MeshPhysicalMaterial({ color: c.body, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4, side: THREE.DoubleSide })),
    brow: part(`brow:${c.body}`, () => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(c.body).multiplyScalar(0.78), roughness: 0.55, clearcoat: 0.3 })),
    white: part('eye-white', () => new THREE.MeshPhysicalMaterial({ color: '#fbf7ee', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 })),
    iris: part('eye-iris', () => new THREE.MeshPhysicalMaterial({ color: '#b5761f', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02 })),
    pupil: part('eye-pupil', () => new THREE.MeshPhysicalMaterial({ color: '#120c0a', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02 })),
    shine: part('eye-shine', () => new THREE.MeshBasicMaterial({ color: '#ffffff' })),
    line: part('eye-line', () => new THREE.MeshStandardMaterial({ color: '#2a1a1e', roughness: 0.5 })),
    tooth: part('tooth', () => new THREE.MeshPhysicalMaterial({ color: '#fbf6e6', roughness: 0.3, clearcoat: 0.6 })),
    claw: part('claw', () => new THREE.MeshPhysicalMaterial({ color: '#e9dfc8', roughness: 0.35, clearcoat: 0.6 })),
    horn: part('horn', () => new THREE.MeshPhysicalMaterial({ color: '#efe3c4', roughness: 0.4, clearcoat: 0.5 })),
    mouth: part('mouth', () => new THREE.MeshStandardMaterial({ color: '#5b1a26', roughness: 0.7 })),
    tongue: part('tongue', () => new THREE.MeshPhysicalMaterial({ color: '#e8707f', roughness: 0.45, clearcoat: 0.3 })),
    hidden: part('hidden', () => new THREE.MeshBasicMaterial({ visible: false })),
  };
}

// ------------------------------------------------------------ building blocks

const geoCache = new Map<string, THREE.BufferGeometry>();
export function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

export function bone(name: string, parent: THREE.Object3D, x: number, y: number, z: number, rx = 0): THREE.Bone {
  const b = new THREE.Bone();
  b.name = name;
  b.position.set(x, y, z);
  b.rotation.x = rx;
  parent.add(b);
  return b;
}

export function grp(name: string, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
}

/**
 * A rigid piece modelled in bind (root) space, re-expressed in its bone's
 * space and attached to that bone.
 */
export function rigid(key: string, b: THREE.Object3D, make: () => THREE.BufferGeometry, mat: THREE.Material, shadow = true) {
  const geo = cached(key, () => {
    const g = make();
    g.applyMatrix4(new THREE.Matrix4().copy(b.matrixWorld).invert());
    g.computeBoundingSphere();
    return g;
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  b.add(m);
  return m;
}

/** A cone from a to b (base radius r at a), with a rounded tip. */
export function spikeGeo(a: V3, b: V3, r: number, segs = 10, flat = 1, blunt = 0): THREE.BufferGeometry {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    // convex flank; a blunt spike ends in a rounded cap
    const cone = r * Math.pow(1 - t, 0.85);
    const cap = blunt > 0 ? r * blunt * Math.sqrt(Math.max(0, 1 - Math.pow((t - (1 - blunt)) / blunt, 2))) : 0;
    pts.push(new THREE.Vector2(Math.max(cone, t > 1 - blunt ? cap : 0), t * len));
  }
  pts.push(new THREE.Vector2(0, len));
  const g = new THREE.LatheGeometry(pts, segs);
  if (flat !== 1) g.scale(flat, 1, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q);
  g.translate(A.x, A.y, A.z);
  return g;
}

/** A gently curved horn or claw from a, along dir, curling towards `curl`. */
export function hornGeo(a: V3, dir: V3, len: number, r: number, curl: V3, bend = 0.25, segs = 10): THREE.BufferGeometry {
  const A = new THREE.Vector3(...a);
  const D = new THREE.Vector3(...dir).normalize();
  const C = new THREE.Vector3(...curl).normalize();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(A.clone().addScaledVector(D, t * len).addScaledVector(C, bend * len * t * t));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 10, 1, segs, false);
  // taper the tube to a point
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / (segs + 1));
    const t = ring / 10;
    const c = curve.getPointAt(t);
    p.fromBufferAttribute(pos, i).sub(c);
    const rad = r * Math.pow(1 - t, 0.9) + 0.0015;
    p.setLength(rad).add(c);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  // close the base
  const cap = new THREE.CircleGeometry(r, segs);
  cap.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), D.clone().negate()));
  cap.translate(A.x, A.y, A.z);
  g.computeVertexNormals();
  const merged = new THREE.BufferGeometry();
  const geos = [g.toNonIndexed(), cap.toNonIndexed()];
  const total = geos.reduce((n, x) => n + x.getAttribute('position').count, 0);
  const P = new Float32Array(total * 3), N = new Float32Array(total * 3);
  let o = 0;
  for (const x of geos) {
    P.set(x.getAttribute('position').array as Float32Array, o * 3);
    N.set(x.getAttribute('normal').array as Float32Array, o * 3);
    o += x.getAttribute('position').count;
  }
  merged.setAttribute('position', new THREE.BufferAttribute(P, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return merged;
}

export function ellipsoidGeo(c: V3, r: V3, rot: V3 = [0, 0, 0], w = 20, h = 14): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(...r);
  g.rotateX(rot[0]);
  g.rotateY(rot[1]);
  g.rotateZ(rot[2]);
  g.translate(...c);
  return g;
}

interface EyeSpec {
  c: V3;
  r: number;
  yaw: number;
  pitch: number;
}

/** A big friendly eye with lids, set into the head. */
export function buildEye(head: THREE.Object3D, side: number, e: EyeSpec, m: ReturnType<typeof mats>): Eye {
  const pivot = grp('eye', e.c[0] * side, e.c[1], e.c[2]);
  // eye-space: pivot sits at the eyeball centre in head space
  const headInv = new THREE.Matrix4().copy(head.matrixWorld).invert();
  pivot.position.applyMatrix4(headInv);
  const look = new THREE.Euler(-e.pitch, e.yaw * side, 0, 'YXZ');
  pivot.quaternion.setFromEuler(look);
  // undo the head's bind rotation so "forward" is the dino's forward
  const hq = new THREE.Quaternion();
  head.matrixWorld.decompose(new THREE.Vector3(), hq, new THREE.Vector3());
  pivot.quaternion.premultiply(hq.invert());
  head.add(pivot);
  const r = e.r;
  const open = grp('eye-open');
  const ball = new THREE.Mesh(cached('eye-ball', () => new THREE.SphereGeometry(1, 28, 20)), m.white);
  ball.scale.setScalar(r);
  open.add(ball);
  const iris = new THREE.Mesh(cached('eye-iris', () => new THREE.SphereGeometry(1, 24, 16)), m.iris);
  iris.scale.set(r * 0.62, r * 0.62, r * 0.3);
  iris.position.z = r * 0.78;
  open.add(iris);
  const pupil = new THREE.Mesh(cached('eye-iris', () => new THREE.SphereGeometry(1, 24, 16)), m.pupil);
  pupil.scale.set(r * 0.36, r * 0.4, r * 0.2);
  pupil.position.z = r * 0.9;
  open.add(pupil);
  for (const [x, y, s] of [
    [-0.28, 0.3, 0.17],
    [0.18, -0.2, 0.08],
  ] as const) {
    const sh = new THREE.Mesh(cached('eye-shine', () => new THREE.SphereGeometry(1, 10, 8)), m.shine);
    sh.scale.setScalar(r * s);
    sh.position.set(r * x * side, r * y, r * 1.0);
    open.add(sh);
  }
  pivot.add(open);
  // lids: hemispherical caps a touch bigger than the eyeball
  const capGeo = cached('eye-lid', () => new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.5));
  const lid = grp('lid');
  const upper = new THREE.Mesh(capGeo, m.lid);
  upper.scale.setScalar(r * 1.09);
  lid.add(upper);
  lid.rotation.x = -0.75;
  pivot.add(lid);
  const lower = grp('lower-lid');
  const low = new THREE.Mesh(capGeo, m.lid);
  low.scale.setScalar(r * 1.07);
  low.rotation.x = Math.PI;
  lower.add(low);
  lower.rotation.x = 0.85;
  pivot.add(lower);
  // the old squint arc, kept hidden (lids do the squinting now)
  const happy = new THREE.Mesh(cached('eye-arc', () => new THREE.TorusGeometry(1, 0.22, 6, 18, Math.PI)), m.hidden);
  happy.visible = false;
  pivot.add(happy);
  return { open, happy, lid, lower };
}

/**
 * A heavy brow lying along the brow ridge. The animator tilts it about the
 * pivot's outward axis and lifts it, so the pivot lines up with the ridge.
 */
export function brow(head: THREE.Object3D, side: number, at: V3, len: number, thick: number, m: ReturnType<typeof mats>) {
  const pivot = grp('brow-pivot');
  place(pivot, head, [at[0] * side, at[1], at[2]]);
  // x along the ridge (forward and a little inward), z outward, y up
  const along = new THREE.Vector3(-0.28 * side, -0.08, 1).normalize();
  const out = new THREE.Vector3(side, 0.35, 0.1).normalize();
  const up = new THREE.Vector3().crossVectors(out, along).normalize();
  const fix = new THREE.Matrix4().makeBasis(along, up, new THREE.Vector3().crossVectors(along, up));
  pivot.quaternion.multiply(new THREE.Quaternion().setFromRotationMatrix(fix));
  const b = new THREE.Mesh(cached(`brow-${len}-${thick}`, () => new THREE.CapsuleGeometry(thick, len, 4, 12)), m.brow);
  b.rotation.set(0, 0, Math.PI / 2);
  b.scale.set(1, 1, 0.55);
  pivot.add(b);
  return b;
}

export function finishSkin(key: string, root: THREE.Group, sculpt: () => Sculpt, cell: number, bones: THREE.Bone[], material: THREE.Material) {
  const geo = cached(key, () => {
    const t = performance.now();
    const g = meshSculpt(sculpt(), { cell, ao: true });
    if (import.meta.env.DEV) console.info(`sculpt ${key}: ${g.getAttribute('position').count} verts, ${g.index!.count / 3} tris in ${Math.round(performance.now() - t)}ms`);
    return g;
  });
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.name = `${key}-skin`;
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  root.add(mesh);
  mesh.bind(new THREE.Skeleton(bones), new THREE.Matrix4());
  return mesh;
}

// ------------------------------------------------------------ T. rex

const TREX_EYE = { c: [0.126, 1.218, 0.36] as V3, r: 0.056, yaw: 0.6, pitch: 0.05 };

/** toe spread and reach: [sideways offset, how far forward the tip is] */
const TREX_TOES: [number, number][] = [
  [-0.058, 0.185],
  [0, 0.235],
  [0.058, 0.185],
];

export function buildTrex(c: DinoColor, coach: boolean): Rig {
  const m = mats(c);
  const root = grp('dino-trex');
  const bob = grp('bob');
  root.add(bob);
  const H = 0.5;
  const hips = bone('hips', bob, 0, H, 0);
  const torsoRest = 0.12;
  const torso = bone('torso', hips, 0, 0.02, 0, torsoRest);
  const neck = bone('neck', torso, 0, 0.42, 0.05);
  const headRest = -0.12;
  const head = bone('head', neck, 0, 0.12, 0.03, headRest);
  const jaw = bone('jaw', head, 0, -0.035, 0.07);
  const tailRest = [0, 0, 0, 0];
  const tail: THREE.Bone[] = [];
  const tailPts: V3[] = [
    [0, 0.56, -0.18],
    [0, 0.5, -0.46],
    [0, 0.4, -0.72],
    [0, 0.27, -0.96],
    [0, 0.13, -1.18],
  ];
  let tp: THREE.Object3D = hips;
  let prev: V3 = [0, H, 0];
  for (let i = 0; i < 4; i++) {
    const t = bone(`tail${i}`, tp, tailPts[i][0] - prev[0], tailPts[i][1] - prev[1], tailPts[i][2] - prev[2]);
    tail.push(t);
    tp = t;
    prev = tailPts[i];
  }
  const legs: Leg[] = [];
  const legBones: THREE.Bone[] = [];
  for (const side of [-1, 1]) {
    const hip = bone('hip', hips, 0.15 * side, 0, 0.02);
    const knee = bone('knee', hip, 0.01 * side, -0.21, 0.07);
    const ankle = bone('ankle', knee, 0, -0.2, -0.1);
    legs.push({ hip, knee, ankle, side, front: false, rest: 0 });
    legBones.push(hip, knee, ankle);
  }
  const arms: Rig['arms'] = [];
  const armBones: THREE.Bone[] = [];
  for (const side of [-1, 1]) {
    const shoulder = bone('shoulder', torso, 0.17 * side, 0.36, 0.14);
    arms.push({ shoulder, side });
    armBones.push(shoulder);
  }
  root.updateMatrixWorld(true);

  const bones = [hips, torso, neck, head, jaw, ...tail, ...legBones, ...armBones];
  const B = (b: THREE.Object3D) => bones.indexOf(b as THREE.Bone);
  const back: V3 = [0, 0.42, -0.91];

  const body = () => {
    const s = new Sculpt();
    const rTorso: Region = { bone: B(torso), belly: 1, dorsal: back, band: [0, 0.93, 0.37] };
    const rHips: Region = { bone: B(hips), belly: 1, dorsal: back, band: [0, 0.93, 0.37] };
    // pelvis and belly
    s.add(new Ellipsoid([0, 0.56, -0.05], [0.235, 0.21, 0.26], rHips));
    s.add(new Ellipsoid([0, 0.68, 0.05], [0.26, 0.27, 0.28], rTorso, [0.45, 0, 0]), 0.12);
    // chest, tucked under the neck
    s.add(new Ellipsoid([0, 0.84, 0.13], [0.2, 0.18, 0.2], rTorso, [0.5, 0, 0]), 0.1);
    // neck
    s.add(new RoundCone([0, 0.9, 0.11], [0, 1.05, 0.19], 0.15, 0.13, { bone: B(neck), belly: 1, dorsal: [0, 0.3, -0.95], band: [0, 0.97, 0.24] }), 0.08);
    // head: cranium, boxy muzzle, brow ridges, cheek muscles
    const rHead: Region = { bone: B(head), belly: 0, dorsal: [0, 1, 0], band: [0, 0, 1] };
    s.add(new Ellipsoid([0, 1.19, 0.2], [0.17, 0.16, 0.2], rHead), 0.07);
    s.add(new RoundCone([0, 1.18, 0.28], [0, 1.15, 0.62], 0.15, 0.105, rHead), 0.08);
    s.add(new RoundBox([0, 1.15, 0.45], [0.125, 0.08, 0.21], 0.07, rHead, [-0.04, 0, 0]), 0.06);
    for (const side of [-1, 1]) {
      s.add(new Ellipsoid([0.1 * side, 1.29, 0.33], [0.055, 0.03, 0.085], rHead, [0.2, 0, 0.3 * side]), 0.035);
      s.add(new Ellipsoid([0.13 * side, 1.12, 0.2], [0.075, 0.085, 0.11], rHead), 0.05);
    }
    // eye sockets, nostrils
    for (const side of [-1, 1]) {
      s.sub(new Ellipsoid([0.126 * side, 1.215, 0.355], [0.05, 0.05, 0.05], rHead), 0.02);
      s.sub(new Ellipsoid([0.04 * side, 1.205, 0.685], [0.015, 0.013, 0.017], rHead, [0, 0.3 * side, 0]), 0.008);
    }
    // the mouth: carve the underside of the upper jaw into a lip line
    s.sub(new Ellipsoid([0, 1.04, 0.43], [0.12, 0.06, 0.3], rHead, [-0.05, 0, 0]), 0.025);
    // arms: upper arm, forearm, hand
    for (const side of [-1, 1]) {
      const rArm: Region = { bone: B(arms[side < 0 ? 0 : 1].shoulder), belly: 0.6, dorsal: [0.6 * side, 0.4, -0.6] };
      s.add(new RoundCone([0.17 * side, 0.89, 0.15], [0.205 * side, 0.81, 0.22], 0.05, 0.036, rArm), 0.04);
      s.add(new RoundCone([0.205 * side, 0.81, 0.22], [0.2 * side, 0.79, 0.31], 0.034, 0.027, rArm), 0.015);
      s.add(new Ellipsoid([0.198 * side, 0.787, 0.33], [0.03, 0.024, 0.032], rArm), 0.015);
      for (const f of [-1, 0, 1]) s.add(new RoundCone([(0.198 + f * 0.014) * side, 0.785, 0.34], [(0.2 + f * 0.022) * side, 0.765, 0.375], 0.012, 0.009, rArm), 0.01);
    }
    // legs: drumstick thigh, shin, foot, three toes
    for (const leg of legs) {
      const sd = leg.side;
      const rThigh: Region = { bone: B(leg.hip), belly: 0.2, dorsal: [0.4 * sd, 0.3, -0.85] };
      const rShin: Region = { bone: B(leg.knee), belly: 0.2, dorsal: [0.3 * sd, 0, -0.95] };
      const rFoot: Region = { bone: B(leg.ankle), belly: 0, dorsal: [0, 1, 0] };
      s.add(new Ellipsoid([0.17 * sd, 0.45, 0.03], [0.125, 0.19, 0.17], rThigh, [-0.35, 0, 0.08 * sd]), 0.08);
      s.add(new RoundCone([0.18 * sd, 0.31, 0.1], [0.167 * sd, 0.115, -0.02], 0.09, 0.056, rShin), 0.04);
      s.add(new RoundCone([0.165 * sd, 0.11, -0.02], [0.165 * sd, 0.045, 0.08], 0.05, 0.046, rFoot), 0.03);
      s.add(new Ellipsoid([0.165 * sd, 0.042, 0.1], [0.085, 0.042, 0.1], rFoot), 0.04);
      for (const [dx, tz] of TREX_TOES) s.add(new RoundCone([(0.165 + dx * 0.5) * sd, 0.046, 0.12], [(0.165 + dx * 1.35) * sd, 0.031, tz + 0.02], 0.038, 0.027, rFoot), 0.025);
    }
    // tail
    const radii = [0.18, 0.14, 0.1, 0.065, 0.022];
    for (let i = 0; i < 4; i++) {
      const r: Region = { bone: B(tail[i]), belly: 0.8, dorsal: [0, 1, 0], band: [0, -0.3, -0.95] };
      s.add(new RoundCone(tailPts[i], tailPts[i + 1], radii[i], radii[i + 1], r), i === 0 ? 0.1 : 0.06);
    }
    // flat soles
    s.sub(new Below(0.002, { bone: B(hips) }), 0.012);
    return s;
  };
  finishSkin('trex', root, body, 0.015, bones, m.skin);

  // lower jaw (its own piece, so the mouth opens cleanly)
  const jawSculpt = () => {
    const s = new Sculpt();
    const r: Region = { bone: 0, belly: 1, dorsal: [0, 1, 0], band: [0, 0, 1] };
    s.add(new RoundCone([0, 1.06, 0.2], [0, 1.06, 0.63], 0.09, 0.07, r));
    s.add(new Ellipsoid([0, 1.055, 0.42], [0.115, 0.045, 0.23], r), 0.05);
    s.sub(new Ellipsoid([0, 1.112, 0.44], [0.092, 0.035, 0.24], r), 0.02);
    return s;
  };
  const jawGeo = cached('trex-jaw', () => {
    const g = meshSculpt(jawSculpt(), { cell: 0.009, ao: true });
    g.deleteAttribute('skinIndex');
    g.deleteAttribute('skinWeight');
    g.applyMatrix4(new THREE.Matrix4().copy(jaw.matrixWorld).invert());
    return g;
  });
  const jawMesh = new THREE.Mesh(jawGeo, m.skin);
  jawMesh.castShadow = true;
  jaw.add(jawMesh);
  // inside of the mouth, tongue, teeth
  rigid('trex-mouth', head, () => ellipsoidGeo([0, 1.07, 0.43], [0.1, 0.035, 0.26]), m.mouth, false);
  rigid('trex-tongue', jaw, () => ellipsoidGeo([0, 1.083, 0.42], [0.065, 0.018, 0.16]), m.tongue, false);
  rigid('trex-teeth-top', head, () => teethRow([0, 1.082, 0.43], 0.105, 0.235, 1, 7, 0.02), m.tooth, false);
  rigid('trex-teeth-low', jaw, () => teethRow([0, 1.088, 0.43], 0.09, 0.21, -1, 6, 0.016), m.tooth, false);

  // claws
  for (const leg of legs) {
    const sd = leg.side;
    rigid(`trex-claws-${sd}`, leg.ankle, () => {
      const geos: THREE.BufferGeometry[] = [];
      for (const [dx, tz] of TREX_TOES) {
        const a: V3 = [(0.165 + dx * 1.42) * sd, 0.034, tz + 0.036];
        geos.push(hornGeo(a, [dx * 0.5 * sd, -0.15, 1], 0.05, 0.02, [0, -1, 0], 0.35, 8));
      }
      return mergeAll(geos);
    }, m.claw);
  }
  for (const arm of arms) {
    const sd = arm.side;
    rigid(`trex-hclaws-${sd}`, arm.shoulder, () => {
      const geos: THREE.BufferGeometry[] = [];
      for (const f of [-1, 0, 1]) geos.push(hornGeo([(0.2 + f * 0.022) * sd, 0.762, 0.378], [f * 0.2 * sd, -0.6, 1], 0.022, 0.008, [0, -1, 0], 0.3, 6));
      return mergeAll(geos);
    }, m.claw, false);
  }
  // a ridge of soft spikes from the head down the back and tail
  const ridge: [THREE.Object3D, V3, number, number][] = [
    [head, [0, 1.335, 0.14], 0.032, 0.042],
    [head, [0, 1.31, 0.05], 0.038, 0.05],
    [neck, [0, 1.1, -0.0], 0.045, 0.06],
    [torso, [0, 0.98, -0.06], 0.05, 0.068],
    [torso, [0, 0.83, -0.17], 0.052, 0.07],
    [hips, [0, 0.7, -0.22], 0.05, 0.068],
    [tail[0], [0, 0.69, -0.36], 0.046, 0.062],
    [tail[1], [0, 0.6, -0.56], 0.04, 0.054],
    [tail[1], [0, 0.55, -0.7], 0.034, 0.046],
    [tail[2], [0, 0.45, -0.86], 0.028, 0.038],
    [tail[3], [0, 0.34, -1.02], 0.02, 0.028],
  ];
  ridge.forEach(([b, at, r, h], i) => {
    const up = new THREE.Vector3(0, 1, i < 3 ? 0.35 : -0.25).normalize();
    rigid(`trex-spike-${i}`, b, () => spikeGeo(at, [at[0] + up.x * h, at[1] + up.y * h, at[2] + up.z * h], r, 12, 0.55, 0.35), m.spike);
  });

  // face
  const eyes = [-1, 1].map((sd) => buildEye(head, sd, TREX_EYE, m));
  const brows = [-1, 1].map((sd) => brow(head, sd, [0.112, 1.282, 0.355], 0.06, 0.02, m));
  const smile = new THREE.Mesh(cached('none', () => new THREE.BufferGeometry()), m.hidden);
  smile.visible = false;
  head.add(smile);

  // accessory anchors (in their bone's space)
  const anchors: Anchors = {
    head: grp('a-head'),
    face: grp('a-face'),
    neck: grp('a-neck'),
    body: grp('a-body'),
    waist: grp('a-waist'),
    feet: [],
    prop: grp('a-prop'),
  };
  const fit = body();
  place(anchors.head, head, [0, 1.3, 0.2]);
  fitFace(anchors.face, head, TREX_EYE);
  place(anchors.neck, torso, [0, 0.97, 0.12 + reach(fit, [0, 0.97, 0.12], [0, 0, 1]) + 0.004]);
  {
    // the jersey wraps the torso at chest height
    const y = 0.76, c: V3 = [0, y, 0.05];
    const wx = reach(fit, c, [1, 0, 0]);
    const zf = c[2] + reach(fit, c, [0, 0, 1]), zb = c[2] - reach(fit, c, [0, 0, -1]);
    place(anchors.body, torso, [0, y, (zf + zb) / 2]);
    anchors.body.scale.set((wx / 0.285) * 1.02, 1.15, ((zf - zb) / 2 / 0.285) * 1.02);
  }
  place(anchors.waist, hips, [0, 0.52, -0.02]);
  place(anchors.prop, torso, [0, 0.76, 0.42]);
  anchors.neck.rotation.x = -0.25;
  for (const leg of legs) {
    const f = grp('foot-anchor');
    place(f, leg.ankle, [0.165 * leg.side, 0.03, 0.06]);
    anchors.feet.push(f);
  }
  anchors.head.scale.setScalar(1.05);
  anchors.waist.scale.set(1.15, 1.2, 1.15);

  if (coach) {
    // a whistle on a cord, draped over the skin
    const cordMat = part('cord', () => new THREE.MeshStandardMaterial({ color: '#e63946', roughness: 0.6 }));
    const metal = part('whistle-metal', () => new THREE.MeshPhysicalMaterial({ color: '#cfd5df', metalness: 0.35, roughness: 0.3, clearcoat: 0.8 }));
    const sc = body();
    rigid('coach-cord', torso, () => {
      const pts = ([
        [0, 1.02, -0.03],
        [0.15, 0.98, 0.07],
        [0.13, 0.88, 0.27],
        [0.04, 0.8, 0.36],
        [-0.04, 0.8, 0.36],
        [-0.13, 0.88, 0.27],
        [-0.15, 0.98, 0.07],
      ] as V3[]).map((q) => onSurface(sc, q, 0.01));
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 48, 0.0075, 6, true);
    }, cordMat, false);
    rigid('coach-whistle', torso, () => {
      const at = onSurface(sc, [0, 0.77, 0.37], 0.03);
      const g = new THREE.CylinderGeometry(0.024, 0.024, 0.06, 18);
      g.rotateZ(Math.PI / 2);
      g.translate(at.x, at.y, at.z);
      const mouth = new THREE.BoxGeometry(0.03, 0.022, 0.03);
      mouth.translate(at.x + 0.035, at.y + 0.004, at.z);
      return mergeAll([g, mouth]);
    }, metal, false);
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
    eyes,
    brows,
    smile,
    blush: [],
    legs,
    arms,
    tail,
    tailRest,
    anchors,
    hipHeight: H,
    height: 1.42,
    handTop: new THREE.Vector3(-0.22, 1.1, 0.3),
    hand: arms[0].shoulder.worldToLocal(new THREE.Vector3(-0.2, 0.785, 0.35)),
    neckRest: 0,
    neck2Rest: 0,
    headRest,
    torsoRest,
    materials: [m.skin, m.accent],
  };
}

/** How far it is from a point inside the body to the skin, along a direction. */
export function reach(s: Sculpt, from: V3, dir: V3, max = 1.5): number {
  const d = new THREE.Vector3(...dir).normalize();
  const f = (t: number) => s.d(from[0] + d.x * t, from[1] + d.y * t, from[2] + d.z * t);
  // blended fields overestimate depth inside, so walk in small fixed steps
  let lo = 0;
  for (let t = 0.008; t < max; t += 0.008) {
    if (f(t) > 0) {
      let hi = t;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (f(mid) > 0) hi = mid;
        else lo = mid;
      }
      return (lo + hi) / 2;
    }
    lo = t;
  }
  return max;
}

/**
 * Fit the face anchor so sunglasses sit in front of the eyes, wherever the
 * species' eyes are: the lenses are 0.085 either side of the anchor.
 */
export function fitFace(a: THREE.Group, head: THREE.Object3D, eye: { c: V3; r: number; yaw: number }) {
  place(a, head, [0, eye.c[1], eye.c[2] + eye.r * Math.cos(eye.yaw) + 0.012]);
  a.scale.set(eye.c[0] / 0.085, Math.max(0.75, eye.r / 0.05), 1);
}

/** Push a point out of (or onto) the sculpted skin, `off` above it. */
export function onSurface(s: Sculpt, q: V3, off: number): THREE.Vector3 {
  const p = new THREE.Vector3(...q);
  const e = 0.002;
  for (let i = 0; i < 6; i++) {
    const d = s.d(p.x, p.y, p.z) - off;
    const g = new THREE.Vector3(
      s.d(p.x + e, p.y, p.z) - s.d(p.x - e, p.y, p.z),
      s.d(p.x, p.y + e, p.z) - s.d(p.x, p.y - e, p.z),
      s.d(p.x, p.y, p.z + e) - s.d(p.x, p.y, p.z - e),
    ).normalize();
    p.addScaledVector(g, -d);
  }
  return p;
}

export function place(g: THREE.Group, b: THREE.Object3D, at: V3) {
  g.position.set(...at).applyMatrix4(new THREE.Matrix4().copy(b.matrixWorld).invert());
  const q = new THREE.Quaternion();
  b.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
  g.quaternion.copy(q.invert());
  b.add(g);
}

/** A row of little rounded teeth along a jaw's U-shaped edge. */
export function teethRow(c: V3, halfW: number, len: number, dir: number, n: number, size: number): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  for (const sd of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      // from the front of the snout back along the side
      const z = c[2] + len * (0.95 - t * 1.25);
      const x = sd * halfW * Math.min(1, 0.25 + t * 1.1);
      const sz = size * (1 - t * 0.35) * (i === 1 ? 1.25 : 1);
      geos.push(spikeGeo([x, c[1], z], [x * 1.02, c[1] - dir * sz * 1.5, z + 0.004], sz * 0.55, 7));
    }
  }
  return mergeAll(geos);
}

export function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = geos.map((g) => {
    const x = g.index ? g.toNonIndexed() : g;
    if (!x.getAttribute('normal')) x.computeVertexNormals();
    return x;
  });
  const total = flat.reduce((n, x) => n + x.getAttribute('position').count, 0);
  const P = new Float32Array(total * 3), N = new Float32Array(total * 3);
  let o = 0;
  for (const x of flat) {
    P.set(x.getAttribute('position').array as Float32Array, o * 3);
    N.set(x.getAttribute('normal').array as Float32Array, o * 3);
    o += x.getAttribute('position').count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return g;
}

