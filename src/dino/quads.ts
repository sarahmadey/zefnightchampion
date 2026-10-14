// The four-legged dinosaurs, sculpted the same way as the T. rex: a
// triceratops with a knobbly frill, three horns and a beak; a stegosaurus with
// two rows of back plates and a spiky tail; and a long-neck with a gently
// curving neck and a little crested head.

import * as THREE from 'three';
import { Below, Ellipsoid, RoundCone, Sculpt, meshSculpt, type Region } from './sdf';
import {
  bone,
  brow,
  fitFace,
  reach,
  buildEye,
  cached,
  ellipsoidGeo,
  finishSkin,
  grp,
  hornGeo,
  mats,
  mergeAll,
  place,
  rigid,
  spikeGeo,
  teethRow,
  type Anchors,
  type Leg,
  type Rig,
  type V3,
} from './sculpted';
import type { DinoColor, Species } from '../game/rewards';

interface LegSpec {
  /** hip, knee and ankle in bind space, for the right-hand leg (x > 0) */
  hip: V3;
  knee: V3;
  ankle: V3;
  front: boolean;
}

interface QuadSpec {
  species: Species;
  hipY: number;
  torso: V3;
  torsoRest: number;
  neck: V3;
  neckRest: number;
  neck2?: V3;
  neck2Rest?: number;
  head: V3;
  headRest: number;
  jaw: V3;
  legs: LegSpec[];
  /** tail points in bind space; a bone at every point but the tip */
  tail: V3[];
}

const W = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const add = (a: THREE.Vector3, x: number, y: number, z: number): V3 => [a.x + x, a.y + y, a.z + z];

/** Bones for a four-legged dino, placed from bind-space joint positions. */
function skeleton(q: QuadSpec) {
  const root = grp(`dino-${q.species}`);
  const bob = grp('bob');
  root.add(bob);
  const hips = bone('hips', bob, 0, q.hipY, 0);
  const torso = bone('torso', hips, ...q.torso, q.torsoRest);
  const neck = bone('neck', torso, ...q.neck, q.neckRest);
  const neck2 = q.neck2 ? bone('neck2', neck, ...q.neck2, q.neck2Rest ?? 0) : null;
  const head = bone('head', neck2 ?? neck, ...q.head, q.headRest);
  const jaw = bone('jaw', head, ...q.jaw);
  root.updateMatrixWorld(true);
  const local = (parent: THREE.Object3D, p: V3) => parent.worldToLocal(new THREE.Vector3(...p));
  const legs: Leg[] = [];
  const legBones: THREE.Bone[] = [];
  for (const spec of [...q.legs.filter((l) => l.front), ...q.legs.filter((l) => !l.front)]) {
    for (const side of [-1, 1]) {
      const m = (p: V3): V3 => [p[0] * side, p[1], p[2]];
      const hp = local(hips, m(spec.hip));
      const hip = bone('hip', hips, hp.x, hp.y, hp.z);
      hip.updateMatrixWorld(true);
      const kp = local(hip, m(spec.knee));
      const knee = bone('knee', hip, kp.x, kp.y, kp.z);
      knee.updateMatrixWorld(true);
      const ap = local(knee, m(spec.ankle));
      const ankle = bone('ankle', knee, ap.x, ap.y, ap.z);
      ankle.updateMatrixWorld(true);
      legs.push({ hip, knee, ankle, side, front: spec.front, rest: 0 });
      legBones.push(hip, knee, ankle);
    }
  }
  const tail: THREE.Bone[] = [];
  let parent: THREE.Object3D = hips;
  for (let i = 0; i < q.tail.length - 1; i++) {
    const p = local(parent, q.tail[i]);
    const t = bone(`tail${i}`, parent, p.x, p.y, p.z);
    t.updateMatrixWorld(true);
    tail.push(t);
    parent = t;
  }
  root.updateMatrixWorld(true);
  const bones = [hips, torso, neck, ...(neck2 ? [neck2] : []), head, jaw, ...tail, ...legBones];
  return { root, bob, hips, torso, neck, neck2, head, jaw, legs, tail, bones };
}

type Sk = ReturnType<typeof skeleton>;

/** Legs: a muscled upper leg, a lower leg and a round, nailed foot. */
function sculptLegs(s: Sculpt, sk: Sk, q: QuadSpec, thick: number) {
  const B = (b: THREE.Object3D) => sk.bones.indexOf(b as THREE.Bone);
  for (const leg of sk.legs) {
    const spec = q.legs.find((l) => l.front === leg.front)!;
    const sd = leg.side;
    const m = (p: V3): V3 => [p[0] * sd, p[1], p[2]];
    const hip = m(spec.hip), knee = m(spec.knee), ankle = m(spec.ankle);
    const t = thick * (leg.front ? 0.92 : 1.08);
    const upper: Region = { bone: B(leg.hip), belly: 0.25, dorsal: [0.7 * sd, 0.2, 0] };
    const lower: Region = { bone: B(leg.knee), belly: 0.25, dorsal: [0.7 * sd, 0, 0] };
    const foot: Region = { bone: B(leg.ankle), belly: 0, dorsal: [0, 1, 0] };
    const mid: V3 = [(hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2 + 0.02, (hip[2] + knee[2]) / 2];
    s.add(new Ellipsoid(mid, [t * 1.15, (hip[1] - knee[1]) * 0.75, t * 1.45], upper), 0.07);
    s.add(new RoundCone(knee, [ankle[0], ankle[1] + 0.01, ankle[2]], t * 0.9, t * 0.8, lower), 0.04);
    s.add(new Ellipsoid([ankle[0], 0.045, ankle[2] + 0.015], [t * 1.05, 0.05, t * 1.15], foot), 0.04);
  }
}

/** Three blunt toenails at the front of each foot. */
function nails(sk: Sk, q: QuadSpec, thick: number, mat: THREE.Material) {
  for (const leg of sk.legs) {
    const spec = q.legs.find((l) => l.front === leg.front)!;
    const sd = leg.side;
    const t = thick * (leg.front ? 0.92 : 1.08);
    const a: V3 = [spec.ankle[0] * sd, 0.03, spec.ankle[2] + 0.015];
    rigid(`${q.species}-nails-${leg.front ? 'f' : 'b'}${sd}`, leg.ankle, () =>
      mergeAll(
        [-1, 0, 1].map((k) => {
          const ang = k * 0.55;
          return ellipsoidGeo([a[0] + Math.sin(ang) * t * 1.02, 0.028, a[2] + Math.cos(ang) * t * 1.08], [0.022, 0.02, 0.016], [0, ang, 0], 10, 8);
        }),
      ),
      mat,
      false,
    );
  }
}

function tailSculpt(s: Sculpt, sk: Sk, q: QuadSpec, radii: number[]) {
  const B = (b: THREE.Object3D) => sk.bones.indexOf(b as THREE.Bone);
  for (let i = 0; i < q.tail.length - 1; i++) {
    const r: Region = { bone: B(sk.tail[Math.min(i, sk.tail.length - 1)]), belly: 0.7, dorsal: [0, 1, 0], band: [0, 0, -1] };
    s.add(new RoundCone(q.tail[i], q.tail[i + 1], radii[i], radii[i + 1], r), i === 0 ? 0.09 : 0.05);
  }
}

function jawPiece(key: string, sk: Sk, make: () => Sculpt, mat: THREE.Material) {
  const g = cached(key, () => {
    const geo = meshSculpt(make(), { cell: 0.009, ao: true });
    geo.deleteAttribute('skinIndex');
    geo.deleteAttribute('skinWeight');
    geo.applyMatrix4(new THREE.Matrix4().copy(sk.jaw.matrixWorld).invert());
    return geo;
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true;
  sk.jaw.add(mesh);
}

function anchorsFor(sk: Sk, at: { head: V3; face: V3; neck: V3; body: V3; waist: V3; prop: V3 }, propOnJaw: boolean): Anchors {
  const a: Anchors = {
    head: grp('a-head'),
    face: grp('a-face'),
    neck: grp('a-neck'),
    body: grp('a-body'),
    waist: grp('a-waist'),
    feet: [],
    prop: grp('a-prop'),
  };
  place(a.head, sk.head, at.head);
  place(a.face, sk.head, at.face);
  place(a.neck, sk.neck, at.neck);
  place(a.body, sk.torso, at.body);
  place(a.waist, sk.hips, at.waist);
  place(a.prop, propOnJaw ? sk.jaw : sk.torso, at.prop);
  for (const leg of sk.legs) {
    const f = grp('foot-anchor');
    const p = W(leg.ankle);
    place(f, leg.ankle, [p.x, 0.035, p.z + 0.02]);
    a.feet.push(f);
  }
  return a;
}

/**
 * Size the body-slot blanket, the worn underpants and the bow tie to this
 * sculpt: blanket over the middle of the back, underpants round the rump.
 */
function fitBody(a: Anchors, sk: Sk, s: Sculpt, o: { midY: number; rumpZ: number; rumpY: number; neck: V3; neckDir: V3 }) {
  const c: V3 = [0, o.midY, 0];
  const top = reach(s, c, [0, 1, 0]), bot = reach(s, c, [0, -1, 0]), wx = reach(s, c, [1, 0, 0]);
  const cy = o.midY + (top - bot) / 2;
  place(a.body, sk.torso, [0, cy, 0]);
  a.body.scale.set((wx / 0.345) * 1.04, (((top + bot) / 2) / 0.345) * 1.04, 1.4);
  const r: V3 = [0, o.rumpY, o.rumpZ];
  const rt = reach(s, r, [0, 1, 0]), rb = reach(s, r, [0, -1, 0]), rx = reach(s, r, [1, 0, 0]);
  // Dino.tsx sets quad underpants 0.2 behind the waist anchor
  place(a.waist, sk.hips, [0, o.rumpY + (rt - rb) / 2, o.rumpZ + 0.2]);
  a.waist.scale.set((rx / 0.37) * 1.07, (((rt + rb) / 2) / 0.33) * 1.07, 1);
  const d = new THREE.Vector3(...o.neckDir).normalize();
  const k = reach(s, o.neck, o.neckDir);
  place(a.neck, sk.neck, [o.neck[0] + d.x * (k + 0.004), o.neck[1] + d.y * (k + 0.004), o.neck[2] + d.z * (k + 0.004)]);
}

function rig(sk: Sk, q: QuadSpec, parts: { eyes: Rig['eyes']; brows: THREE.Mesh[]; anchors: Anchors; height: number; materials: THREE.Material[] }): Rig {
  const smile = new THREE.Mesh(cached('none', () => new THREE.BufferGeometry()), new THREE.MeshBasicMaterial({ visible: false }));
  smile.visible = false;
  sk.head.add(smile);
  return {
    species: q.species,
    biped: false,
    root: sk.root,
    bob: sk.bob,
    hips: sk.hips,
    torso: sk.torso,
    neck: sk.neck,
    neck2: sk.neck2,
    head: sk.head,
    jaw: sk.jaw,
    eyes: parts.eyes,
    brows: parts.brows,
    smile,
    blush: [],
    legs: sk.legs,
    arms: [],
    tail: sk.tail,
    tailRest: sk.tail.map(() => 0),
    anchors: parts.anchors,
    hipHeight: q.hipY,
    height: parts.height,
    handTop: new THREE.Vector3(-0.2, 0.8, 0.45),
    neckRest: q.neckRest,
    neck2Rest: q.neck2Rest ?? 0,
    headRest: q.headRest,
    torsoRest: q.torsoRest,
    materials: parts.materials,
  };
}

// ------------------------------------------------------------ triceratops

const TRIKE: QuadSpec = {
  species: 'trike',
  hipY: 0.46,
  torso: [0, 0.08, 0],
  torsoRest: 0,
  neck: [0, 0.06, 0.4],
  neckRest: -0.1,
  head: [0, 0.03, 0.12],
  headRest: 0.05,
  jaw: [0, -0.07, 0.07],
  legs: [
    { hip: [0.19, 0.46, 0.27], knee: [0.2, 0.28, 0.29], ankle: [0.2, 0.1, 0.28], front: true },
    { hip: [0.2, 0.47, -0.27], knee: [0.21, 0.28, -0.23], ankle: [0.21, 0.1, -0.29], front: false },
  ],
  tail: [
    [0, 0.55, -0.48],
    [0, 0.48, -0.68],
    [0, 0.4, -0.84],
    [0, 0.32, -0.98],
  ],
};

export function buildTrike(c: DinoColor): Rig {
  const q = TRIKE;
  const m = mats(c, 1);
  const sk = skeleton(q);
  const B = (b: THREE.Object3D) => sk.bones.indexOf(b as THREE.Bone);
  const Hd = W(sk.head);
  const frillC: V3 = add(Hd, 0, 0.22, -0.07);
  const frillRot = -0.62;
  const body = () => {
    const s = new Sculpt();
    const rT: Region = { bone: B(sk.torso), belly: 1, dorsal: [0, 1, 0], band: [0, 0, 1] };
    const rH: Region = { bone: B(sk.hips), belly: 1, dorsal: [0, 1, 0], band: [0, 0, 1] };
    s.add(new Ellipsoid([0, 0.57, -0.02], [0.3, 0.27, 0.5], rT));
    s.add(new Ellipsoid([0, 0.6, 0.24], [0.26, 0.245, 0.25], rT), 0.1);
    s.add(new Ellipsoid([0, 0.61, -0.26], [0.265, 0.26, 0.27], rH), 0.1);
    s.add(new RoundCone([0, 0.6, 0.32], add(Hd, 0, 0, 0), 0.21, 0.165, { bone: B(sk.neck), belly: 1, dorsal: [0, 1, 0], band: [0, 0, 1] }), 0.08);
    const rHd: Region = { bone: B(sk.head), belly: 0, dorsal: [0, 1, 0], band: [0, 0, 1] };
    s.add(new Ellipsoid(add(Hd, 0, 0.03, 0.06), [0.16, 0.15, 0.17], rHd), 0.06);
    s.add(new RoundCone(add(Hd, 0, 0.01, 0.12), add(Hd, 0, -0.05, 0.3), 0.125, 0.055, rHd), 0.07);
    for (const sd of [-1, 1]) s.add(new Ellipsoid(add(Hd, 0.14 * sd, -0.03, 0.05), [0.06, 0.06, 0.07], rHd), 0.05);
    // the frill, tilted back behind the head
    s.add(new Ellipsoid(frillC, [0.36, 0.27, 0.045], rHd, [frillRot, 0, 0]), 0.08);
    for (const sd of [-1, 1]) {
      s.sub(new Ellipsoid(add(Hd, 0.122 * sd, 0.068, 0.135), [0.045, 0.045, 0.045], rHd), 0.015);
      s.sub(new Ellipsoid(add(Hd, 0.03 * sd, 0.0, 0.305), [0.012, 0.01, 0.014], rHd), 0.006);
    }
    s.sub(new Ellipsoid(add(Hd, 0, -0.075, 0.2), [0.085, 0.035, 0.13], rHd), 0.02);
    sculptLegs(s, sk, q, 0.078);
    tailSculpt(s, sk, q, [0.16, 0.11, 0.07, 0.025]);
    s.sub(new Below(0.002, { bone: 0 }), 0.012);
    return s;
  };
  finishSkin('trike', sk.root, body, 0.0155, sk.bones, m.skin);
  jawPiece('trike-jaw', sk, () => {
    const s = new Sculpt();
    const r: Region = { bone: 0, belly: 1, dorsal: [0, 1, 0], band: [0, 0, 1] };
    s.add(new RoundCone(add(Hd, 0, -0.08, 0.05), add(Hd, 0, -0.09, 0.25), 0.075, 0.04, r));
    s.sub(new Ellipsoid(add(Hd, 0, -0.045, 0.16), [0.06, 0.03, 0.12], r), 0.015);
    return s;
  }, m.skin);
  rigid('trike-mouth', sk.head, () => ellipsoidGeo(add(Hd, 0, -0.07, 0.18), [0.065, 0.025, 0.11]), m.mouth, false);
  rigid('trike-tongue', sk.jaw, () => ellipsoidGeo(add(Hd, 0, -0.075, 0.17), [0.045, 0.014, 0.08]), m.tongue, false);
  // beak, horns and the knobbly frill edge
  rigid('trike-beak', sk.head, () => hornGeo(add(Hd, 0, -0.025, 0.29), [0, -0.45, 1], 0.075, 0.045, [0, -1, 0], 0.5, 12), m.horn);
  rigid('trike-beak-low', sk.jaw, () => hornGeo(add(Hd, 0, -0.09, 0.245), [0, 0.2, 1], 0.05, 0.03, [0, 1, 0], 0.3, 10), m.horn);
  rigid('trike-horns', sk.head, () =>
    mergeAll([
      hornGeo(add(Hd, -0.08, 0.15, 0.12), [-0.18, 0.75, 0.75], 0.27, 0.038, [0, -0.15, 1], 0.28, 12),
      hornGeo(add(Hd, 0.08, 0.15, 0.12), [0.18, 0.75, 0.75], 0.27, 0.038, [0, -0.15, 1], 0.28, 12),
      hornGeo(add(Hd, 0, 0.055, 0.265), [0, 1, 0.45], 0.1, 0.032, [0, 0, 1], 0.25, 12),
    ]),
    m.horn,
  );
  rigid('trike-frill-knobs', sk.head, () => {
    const rot = new THREE.Matrix4().makeRotationX(frillRot);
    const c0 = new THREE.Vector3(...frillC);
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 11; i++) {
      const a = -1.75 + (i / 10) * 3.5;
      const p = new THREE.Vector3(Math.sin(a) * 0.36, Math.cos(a) * 0.27, 0).applyMatrix4(rot).add(c0);
      geos.push(ellipsoidGeo([p.x, p.y, p.z], [0.032, 0.032, 0.026], [frillRot, 0, 0], 12, 10));
    }
    return mergeAll(geos);
  }, m.spike);
  nails(sk, q, 0.078, m.claw);
  const eye = { c: [0.122, Hd.y + 0.07, Hd.z + 0.14] as V3, r: 0.05, yaw: 0.75, pitch: 0.05 };
  const eyes = [-1, 1].map((sd) => buildEye(sk.head, sd, eye, m));
  const brows = [-1, 1].map((sd) => brow(sk.head, sd, [0.108, Hd.y + 0.12, Hd.z + 0.135], 0.052, 0.017, m));
  const anchors = anchorsFor(sk, {
    head: add(Hd, 0, 0.17, 0.06),
    face: add(Hd, 0, 0.065, 0.2),
    neck: [0, 0.6, 0.45],
    body: [0, 0.63, 0],
    waist: [0, 0.58, -0.05],
    prop: add(Hd, 0, -0.09, 0.32),
  }, true);
  anchors.head.scale.setScalar(0.8);
  fitFace(anchors.face, sk.head, eye);
  fitBody(anchors, sk, body(), { midY: 0.57, rumpZ: -0.44, rumpY: 0.58, neck: [0, 0.58, 0.36], neckDir: [0, -0.35, 1] });
  anchors.neck.rotation.x = -0.6;
  return rig(sk, q, { eyes, brows, anchors, height: 1.05, materials: [m.skin, m.accent] });
}

// ------------------------------------------------------------ stegosaurus

const STEGO: QuadSpec = {
  species: 'stego',
  hipY: 0.48,
  torso: [0, 0.08, 0],
  torsoRest: 0,
  neck: [0, -0.02, 0.4],
  neckRest: 0.15,
  head: [0, -0.04, 0.15],
  headRest: -0.1,
  jaw: [0, -0.045, 0.06],
  legs: [
    { hip: [0.17, 0.42, 0.29], knee: [0.18, 0.26, 0.3], ankle: [0.18, 0.1, 0.29], front: true },
    { hip: [0.18, 0.5, -0.25], knee: [0.19, 0.3, -0.2], ankle: [0.19, 0.1, -0.27], front: false },
  ],
  tail: [
    [0, 0.62, -0.46],
    [0, 0.57, -0.66],
    [0, 0.49, -0.84],
    [0, 0.4, -1.0],
    [0, 0.32, -1.14],
  ],
};

export function buildStego(c: DinoColor): Rig {
  const q = STEGO;
  const m = mats(c, 0);
  const sk = skeleton(q);
  const B = (b: THREE.Object3D) => sk.bones.indexOf(b as THREE.Bone);
  const Hd = W(sk.head);
  const body = () => {
    const s = new Sculpt();
    const rT: Region = { bone: B(sk.torso), belly: 1, dorsal: [0, 1, 0], band: [0, 0, 1] };
    const rH: Region = { bone: B(sk.hips), belly: 1, dorsal: [0, 1, 0], band: [0, 0, 1] };
    s.add(new Ellipsoid([0, 0.6, -0.03], [0.27, 0.27, 0.46], rT, [-0.12, 0, 0]));
    s.add(new Ellipsoid([0, 0.7, -0.17], [0.245, 0.24, 0.29], rH), 0.12);
    s.add(new Ellipsoid([0, 0.55, 0.24], [0.215, 0.21, 0.23], rT), 0.1);
    s.add(new RoundCone([0, 0.55, 0.36], add(Hd, 0, 0.02, -0.02), 0.15, 0.1, { bone: B(sk.neck), belly: 1, dorsal: [0, 1, 0], band: [0, 0, 1] }), 0.07);
    const rHd: Region = { bone: B(sk.head), belly: 0, dorsal: [0, 1, 0], band: [0, 0, 1] };
    s.add(new Ellipsoid(add(Hd, 0, 0.015, 0.07), [0.115, 0.1, 0.15], rHd), 0.05);
    s.add(new RoundCone(add(Hd, 0, 0.0, 0.1), add(Hd, 0, -0.035, 0.235), 0.09, 0.055, rHd), 0.05);
    for (const sd of [-1, 1]) {
      s.sub(new Ellipsoid(add(Hd, 0.088 * sd, 0.038, 0.095), [0.04, 0.04, 0.04], rHd), 0.012);
      s.sub(new Ellipsoid(add(Hd, 0.024 * sd, -0.01, 0.228), [0.01, 0.008, 0.012], rHd), 0.005);
    }
    s.sub(new Ellipsoid(add(Hd, 0, -0.06, 0.14), [0.06, 0.028, 0.1], rHd), 0.015);
    sculptLegs(s, sk, q, 0.072);
    tailSculpt(s, sk, q, [0.15, 0.115, 0.085, 0.055, 0.025]);
    s.sub(new Below(0.002, { bone: 0 }), 0.012);
    return s;
  };
  finishSkin('stego', sk.root, body, 0.0155, sk.bones, m.skin);
  jawPiece('stego-jaw', sk, () => {
    const s = new Sculpt();
    const r: Region = { bone: 0, belly: 1, dorsal: [0, 1, 0], band: [0, 0, 1] };
    s.add(new RoundCone(add(Hd, 0, -0.06, 0.04), add(Hd, 0, -0.065, 0.2), 0.055, 0.035, r));
    s.sub(new Ellipsoid(add(Hd, 0, -0.035, 0.12), [0.042, 0.022, 0.09], r), 0.012);
    return s;
  }, m.skin);
  rigid('stego-mouth', sk.head, () => ellipsoidGeo(add(Hd, 0, -0.055, 0.13), [0.045, 0.02, 0.08]), m.mouth, false);
  rigid('stego-tongue', sk.jaw, () => ellipsoidGeo(add(Hd, 0, -0.058, 0.12), [0.03, 0.01, 0.06]), m.tongue, false);
  // two staggered rows of plates, biggest over the hips
  const plates: [number, number][] = [
    [0.32, 0.55],
    [0.2, 0.75],
    [0.07, 0.9],
    [-0.06, 1.0],
    [-0.19, 1.0],
    [-0.32, 0.92],
    [-0.45, 0.8],
    [-0.58, 0.66],
    [-0.71, 0.52],
  ];
  const plateShape = new THREE.Shape();
  plateShape.moveTo(-0.5, 0);
  plateShape.bezierCurveTo(-0.62, 0.42, -0.22, 0.86, 0, 1);
  plateShape.bezierCurveTo(0.22, 0.86, 0.62, 0.42, 0.5, 0);
  plateShape.quadraticCurveTo(0, -0.1, -0.5, 0);
  const plateGeo = (h: number) => {
    const g = new THREE.ExtrudeGeometry(plateShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 14 });
    g.translate(0, 0, -0.02);
    g.scale(h * 0.95, h, 0.55);
    g.rotateY(Math.PI / 2);
    return g;
  };
  const bodyS = body();
  plates.forEach(([z, k], i) => {
    const side = i % 2 ? 1 : -1;
    const h = 0.2 * k + 0.02;
    // which bone carries this plate
    const b = z > 0.15 ? sk.torso : z > -0.4 ? sk.hips : sk.tail[0];
    rigid(`stego-plate-${i}`, b, () => {
      // find the top of the back here
      let y = 1.2;
      for (let it = 0; it < 40; it++) y -= Math.max(0.002, bodyS.d(0.03 * side, y, z));
      const g = plateGeo(h);
      g.rotateZ(side * 0.14);
      g.translate(0.03 * side, y - 0.025, z);
      return g;
    }, m.accent);
  });
  rigid('stego-spikes', sk.tail[3], () => {
    const t = q.tail[3];
    const geos: THREE.BufferGeometry[] = [];
    for (const sd of [-1, 1]) {
      geos.push(spikeGeo([0.03 * sd, t[1] + 0.03, t[2] - 0.04], [0.2 * sd, t[1] + 0.16, t[2] - 0.12], 0.026, 10));
      geos.push(spikeGeo([0.025 * sd, t[1] + 0.02, t[2] - 0.11], [0.17 * sd, t[1] + 0.12, t[2] - 0.24], 0.022, 10));
    }
    return mergeAll(geos);
  }, m.horn);
  nails(sk, q, 0.072, m.claw);
  const eye = { c: [0.088, Hd.y + 0.04, Hd.z + 0.1] as V3, r: 0.044, yaw: 0.7, pitch: 0.08 };
  const eyes = [-1, 1].map((sd) => buildEye(sk.head, sd, eye, m));
  const brows = [-1, 1].map((sd) => brow(sk.head, sd, [0.08, Hd.y + 0.083, Hd.z + 0.095], 0.045, 0.014, m));
  const anchors = anchorsFor(sk, {
    head: add(Hd, 0, 0.1, 0.06),
    face: add(Hd, 0, 0.035, 0.15),
    neck: [0, 0.52, 0.44],
    body: [0, 0.66, 0],
    waist: [0, 0.6, -0.1],
    prop: add(Hd, 0, -0.07, 0.23),
  }, true);
  anchors.head.scale.setScalar(0.62);
  fitFace(anchors.face, sk.head, eye);
  fitBody(anchors, sk, bodyS, { midY: 0.6, rumpZ: -0.42, rumpY: 0.63, neck: [0, 0.53, 0.42], neckDir: [0, -0.4, 1] });
  anchors.neck.rotation.x = -0.75;
  anchors.neck.scale.setScalar(0.9);
  return rig(sk, q, { eyes, brows, anchors, height: 1.1, materials: [m.skin, m.accent] });
}

// ------------------------------------------------------------ long-neck

const LONGNECK: QuadSpec = {
  species: 'longneck',
  hipY: 0.5,
  torso: [0, 0.1, 0],
  torsoRest: -0.05,
  neck: [0, 0.18, 0.3],
  neckRest: -0.15,
  neck2: [0, 0.34, 0.07],
  neck2Rest: 0.1,
  head: [0, 0.3, 0.05],
  headRest: 0.15,
  jaw: [0, -0.04, 0.05],
  legs: [
    { hip: [0.18, 0.52, 0.26], knee: [0.19, 0.3, 0.28], ankle: [0.19, 0.1, 0.27], front: true },
    { hip: [0.19, 0.5, -0.26], knee: [0.2, 0.29, -0.22], ankle: [0.2, 0.1, -0.28], front: false },
  ],
  tail: [
    [0, 0.62, -0.42],
    [0, 0.57, -0.62],
    [0, 0.5, -0.8],
    [0, 0.42, -0.96],
    [0, 0.34, -1.1],
    [0, 0.27, -1.23],
  ],
};

export function buildLongneck(c: DinoColor): Rig {
  const q = LONGNECK;
  const m = mats(c, 1);
  const sk = skeleton(q);
  const B = (b: THREE.Object3D) => sk.bones.indexOf(b as THREE.Bone);
  const Hd = W(sk.head);
  const N1 = W(sk.neck), N2 = W(sk.neck2!);
  const body = () => {
    const s = new Sculpt();
    const rT: Region = { bone: B(sk.torso), belly: 1, dorsal: [0, 1, 0], band: [0, 0, 1] };
    const rH: Region = { bone: B(sk.hips), belly: 1, dorsal: [0, 1, 0], band: [0, 0, 1] };
    s.add(new Ellipsoid([0, 0.66, 0], [0.31, 0.29, 0.45], rT));
    s.add(new Ellipsoid([0, 0.72, 0.17], [0.27, 0.27, 0.29], rT), 0.12);
    s.add(new Ellipsoid([0, 0.65, -0.24], [0.26, 0.25, 0.26], rH), 0.1);
    const rN: Region = { bone: B(sk.neck), belly: 1, dorsal: [0, 0.3, -0.95], band: [0, 1, 0.2] };
    const rN2: Region = { bone: B(sk.neck2!), belly: 1, dorsal: [0, 0.3, -0.95], band: [0, 1, 0.1] };
    s.add(new RoundCone([0, 0.76, 0.24], add(N2, 0, 0, 0), 0.17, 0.115, rN), 0.08);
    s.add(new RoundCone(add(N2, 0, 0, 0), add(Hd, 0, -0.01, -0.01), 0.115, 0.085, rN2), 0.06);
    const rHd: Region = { bone: B(sk.head), belly: 0, dorsal: [0, 1, 0], band: [0, 0, 1] };
    s.add(new Ellipsoid(add(Hd, 0, 0.03, 0.06), [0.115, 0.1, 0.13], rHd), 0.05);
    s.add(new RoundCone(add(Hd, 0, 0.01, 0.1), add(Hd, 0, -0.03, 0.245), 0.095, 0.065, rHd), 0.05);
    // the crest over the nose
    s.add(new Ellipsoid(add(Hd, 0, 0.11, 0.08), [0.06, 0.05, 0.06], rHd), 0.05);
    for (const sd of [-1, 1]) {
      s.sub(new Ellipsoid(add(Hd, 0.09 * sd, 0.055, 0.095), [0.04, 0.04, 0.04], rHd), 0.012);
      s.sub(new Ellipsoid(add(Hd, 0.022 * sd, 0.13, 0.11), [0.011, 0.009, 0.012], rHd), 0.005);
    }
    s.sub(new Ellipsoid(add(Hd, 0, -0.045, 0.15), [0.065, 0.028, 0.1], rHd), 0.015);
    sculptLegs(s, sk, q, 0.082);
    tailSculpt(s, sk, q, [0.15, 0.115, 0.085, 0.06, 0.04, 0.015]);
    s.sub(new Below(0.002, { bone: 0 }), 0.012);
    return s;
  };
  finishSkin('longneck', sk.root, body, 0.0155, sk.bones, m.skin);
  jawPiece('longneck-jaw', sk, () => {
    const s = new Sculpt();
    const r: Region = { bone: 0, belly: 1, dorsal: [0, 1, 0], band: [0, 0, 1] };
    s.add(new RoundCone(add(Hd, 0, -0.05, 0.05), add(Hd, 0, -0.055, 0.21), 0.058, 0.042, r));
    s.sub(new Ellipsoid(add(Hd, 0, -0.025, 0.13), [0.045, 0.022, 0.09], r), 0.012);
    return s;
  }, m.skin);
  rigid('longneck-mouth', sk.head, () => ellipsoidGeo(add(Hd, 0, -0.04, 0.14), [0.05, 0.02, 0.085]), m.mouth, false);
  rigid('longneck-tongue', sk.jaw, () => ellipsoidGeo(add(Hd, 0, -0.045, 0.13), [0.032, 0.01, 0.06]), m.tongue, false);
  rigid('longneck-teeth', sk.head, () => teethRow(add(Hd, 0, -0.035, 0.13), 0.05, 0.1, 1, 4, 0.01), m.tooth, false);
  nails(sk, q, 0.082, m.claw);
  const eye = { c: [0.09, Hd.y + 0.057, Hd.z + 0.1] as V3, r: 0.045, yaw: 0.7, pitch: 0.05 };
  const eyes = [-1, 1].map((sd) => buildEye(sk.head, sd, eye, m));
  const brows = [-1, 1].map((sd) => brow(sk.head, sd, [0.082, Hd.y + 0.1, Hd.z + 0.095], 0.046, 0.014, m));
  const anchors = anchorsFor(sk, {
    head: add(Hd, 0, 0.15, 0.04),
    face: add(Hd, 0, 0.055, 0.15),
    neck: add(N1, 0, 0.05, 0.07),
    body: [0, 0.68, 0],
    waist: [0, 0.6, -0.08],
    prop: add(Hd, 0, -0.06, 0.24),
  }, true);
  anchors.head.scale.setScalar(0.62);
  fitFace(anchors.face, sk.head, eye);
  fitBody(anchors, sk, body(), { midY: 0.66, rumpZ: -0.4, rumpY: 0.64, neck: [0, 0.9, 0.3], neckDir: [0, -0.15, 1] });
  anchors.neck.scale.setScalar(0.75);
  anchors.neck.rotation.x = -0.2;
  return rig(sk, q, { eyes, brows, anchors, height: 1.75, materials: [m.skin, m.accent] });
}
