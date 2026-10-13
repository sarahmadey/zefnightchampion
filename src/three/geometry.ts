// Procedural geometry builders. Everything in the world is modelled here in
// code: lathed candy shapes, tapered tubes, piped frosting, waffle grids,
// puffy clouds, petals and so on.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TAU, clamp, fbm2, mulberry32, randRange, smoothstep } from './util';

export type ColorLike = THREE.ColorRepresentation;
type ColorFn = (p: THREE.Vector3, n: THREE.Vector3, uv: THREE.Vector2) => THREE.Color;

const tmpColor = new THREE.Color();

/** Add (or overwrite) a per-vertex colour attribute. */
export function paint(geo: THREE.BufferGeometry, color: ColorLike | ColorFn): THREE.BufferGeometry {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const arr = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const t = new THREE.Vector2();
  const fixed = typeof color === 'function' ? null : new THREE.Color(color);
  for (let i = 0; i < pos.count; i++) {
    let c: THREE.Color;
    if (fixed) c = fixed;
    else {
      p.fromBufferAttribute(pos, i);
      if (nor) n.fromBufferAttribute(nor, i);
      if (uv) t.fromBufferAttribute(uv, i);
      c = (color as ColorFn)(p, n, t);
    }
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

export interface XForm {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: number | [number, number, number];
}

const tmpMat = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

export function xform(geo: THREE.BufferGeometry, x: XForm): THREE.BufferGeometry {
  tmpPos.set(...(x.pos ?? [0, 0, 0]));
  tmpEuler.set(...(x.rot ?? [0, 0, 0]));
  tmpQuat.setFromEuler(tmpEuler);
  const s = x.scale ?? 1;
  if (typeof s === 'number') tmpScale.set(s, s, s);
  else tmpScale.set(...s);
  tmpMat.compose(tmpPos, tmpQuat, tmpScale);
  geo.applyMatrix4(tmpMat);
  return geo;
}

/** Merge geometries that may mix indexed/non-indexed and missing attributes. */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const anyNonIndexed = geos.some((g) => !g.index);
  const wantColor = geos.some((g) => g.getAttribute('color'));
  const prepared = geos.map((g0) => {
    let g = g0;
    if (anyNonIndexed && g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') g.deleteAttribute(name);
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (!g.getAttribute('uv')) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    }
    if (wantColor && !g.getAttribute('color')) paint(g, '#ffffff');
    return g;
  });
  const out = mergeGeometries(prepared, false);
  if (!out) throw new Error('merge failed');
  return out;
}

/** Smooth a 2D outline through Catmull-Rom so lathe shapes look hand-shaped. */
export function smoothProfile(points: [number, number][], samples = 32): THREE.Vector2[] {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return curve.getSpacedPoints(samples).map((v) => new THREE.Vector2(Math.max(0, v.x), v.y));
}

export function lathe(profile: [number, number][], segments = 32, samples = 32): THREE.BufferGeometry {
  const pts = smoothProfile(profile, samples);
  const g = new THREE.LatheGeometry(pts, segments);
  g.computeVertexNormals();
  fixSeamNormals(g, segments + 1, pts.length, true);
  return g;
}

/**
 * Average the normals of duplicated seam vertices (first and last column) in
 * grid-shaped geometry so lathes and tubes don't show a hard seam.
 */
function fixSeamNormals(g: THREE.BufferGeometry, cols: number, rows: number, colMajor: boolean) {
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let r = 0; r < rows; r++) {
    const i0 = colMajor ? r : r * cols;
    const i1 = colMajor ? (cols - 1) * rows + r : r * cols + cols - 1;
    if (i1 >= n.count) continue;
    a.fromBufferAttribute(n, i0);
    b.fromBufferAttribute(n, i1);
    a.add(b).normalize();
    n.setXYZ(i0, a.x, a.y, a.z);
    n.setXYZ(i1, a.x, a.y, a.z);
  }
  n.needsUpdate = true;
}

export interface TubeOpts {
  segments?: number;
  radial?: number;
  /** Radius at position t along the curve (0..1) and angle a around it. */
  radius: (t: number, a: number) => number;
  closed?: boolean;
}

/** A tube whose radius can taper and ripple: tails, hair, stems, licorice. */
export function tube(curve: THREE.Curve<THREE.Vector3>, opts: TubeOpts): THREE.BufferGeometry {
  const segs = opts.segments ?? 32;
  const radial = opts.radial ?? 10;
  const frames = curve.computeFrenetFrames(segs, !!opts.closed);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(Math.min(t, 1), P);
    const nn = frames.normals[i];
    const bb = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const sin = Math.sin(a);
      const cos = -Math.cos(a);
      N.set(cos * nn.x + sin * bb.x, cos * nn.y + sin * bb.y, cos * nn.z + sin * bb.z).normalize();
      const r = opts.radius(t, a);
      positions.push(P.x + r * N.x, P.y + r * N.y, P.z + r * N.z);
      uvs.push(t, j / radial);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = (i + 1) * (radial + 1) + j;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  fixSeamNormals(g, radial + 1, segs + 1, false);
  return g;
}

/** Rounded radius profile that closes both ends of a tube. */
export function capsuleRadius(r: number, endFrac = 0.12) {
  return (t: number) => {
    const e = Math.min(t, 1 - t) / endFrac;
    return e >= 1 ? r : r * Math.sqrt(Math.max(0, 1 - (1 - e) * (1 - e)));
  };
}

export function curveFrom(points: [number, number, number][], tension = 0.5): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'catmullrom',
    tension,
  );
}

export function roundedBox(w: number, h: number, d: number, r: number, seg = 3): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-4));
  return g;
}

export function sphere(r: number, w = 20, h = 14): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, w, h);
}

/** Displace vertices along their normals with smooth noise (for organic lumps). */
export function lumpy(geo: THREE.BufferGeometry, amp: number, freq: number, seed = 1): THREE.BufferGeometry {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const o = seed * 13.37;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const d = (fbm2(p.x * freq + o, p.z * freq + p.y * 0.7 * freq - o) - 0.5) * 2 * amp;
    p.addScaledVector(n, d);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- 2D shapes

export function starShape(points: number, outer: number, inner: number, roundness = 0): THREE.Shape {
  const s = new THREE.Shape();
  const n = points * 2;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU + Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else if (roundness > 0) {
      const pa = ((i - 0.5) / n) * TAU + Math.PI / 2;
      const pr = (outer + inner) / 2 + roundness * (i % 2 === 0 ? 1 : -1) * (outer - inner);
      s.quadraticCurveTo(Math.cos(pa) * pr, Math.sin(pa) * pr, x, y);
    } else s.lineTo(x, y);
  }
  return s;
}

export function heartShape(size = 1): THREE.Shape {
  const s = new THREE.Shape();
  const k = size / 1.2;
  s.moveTo(0, -0.55 * k);
  s.bezierCurveTo(-0.35 * k, -0.25 * k, -0.62 * k, 0.0, -0.6 * k, 0.25 * k);
  s.bezierCurveTo(-0.58 * k, 0.52 * k, -0.22 * k, 0.62 * k, 0, 0.36 * k);
  s.bezierCurveTo(0.22 * k, 0.62 * k, 0.58 * k, 0.52 * k, 0.6 * k, 0.25 * k);
  s.bezierCurveTo(0.62 * k, 0.0, 0.35 * k, -0.25 * k, 0, -0.55 * k);
  return s;
}

/** A soft teardrop petal pointing up the +Y axis. */
export function petalShape(len: number, width: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(width * 0.9, len * 0.15, width * 0.75, len * 0.85, 0, len);
  s.bezierCurveTo(-width * 0.75, len * 0.85, -width * 0.9, len * 0.15, 0, 0);
  return s;
}

export function extrude(shape: THREE.Shape, depth: number, bevel: number, curveSegments = 12): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 3,
    curveSegments,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

/** A cupped petal: flat petal shape bent into a bowl (for flowers and the gate). */
export function cuppedPetal(len: number, width: number, cup: number, thickness = 0.02): THREE.BufferGeometry {
  const g = extrude(petalShape(len, width), thickness, thickness * 0.5, 10);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = y / len;
    pos.setZ(i, z + cup * (x * x) / (width * width) + cup * 0.6 * t * t);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// ----------------------------------------------------------- candy shapes

/** Soft-serve style piped frosting: a star-ridged tube spiralling upward. */
export function pipedSwirl(opts: {
  turns?: number;
  radius?: number;
  height?: number;
  thickness?: number;
  ridges?: number;
}): THREE.BufferGeometry {
  const turns = opts.turns ?? 2.4;
  const R = opts.radius ?? 0.5;
  const H = opts.height ?? 0.6;
  const th = opts.thickness ?? 0.16;
  const ridges = opts.ridges ?? 6;
  const pts: [number, number, number][] = [];
  const n = Math.ceil(turns * 16);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * TAU;
    const r = R * (1 - t * 0.92);
    pts.push([Math.cos(a) * r, t * H, Math.sin(a) * r]);
  }
  pts.push([0, H + th * 0.6, 0]);
  const curve = curveFrom(pts, 0.5);
  return tube(curve, {
    segments: n * 3,
    radial: ridges * 4,
    radius: (t, a) => {
      const base = th * (1 - t * 0.55) * (t < 0.04 ? 0.6 + t * 10 : 1) * (t > 0.92 ? Math.max(0.05, (1 - t) / 0.08) : 1);
      return base * (1 + 0.16 * Math.cos(a * ridges));
    },
  });
}

/** Frosting drips hanging from a rim of radius `r` at height `y`. */
export function frostingDrips(r: number, y: number, count: number, maxLen: number, thick: number, seed = 3): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  // the rim band
  const band = new THREE.TorusGeometry(r, thick, 8, 64);
  band.rotateX(Math.PI / 2);
  band.translate(0, y, 0);
  parts.push(band);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + randRange(rng, -0.12, 0.12);
    const len = maxLen * randRange(rng, 0.35, 1);
    const w = thick * randRange(rng, 0.9, 1.4);
    const curve = curveFrom(
      [
        [Math.cos(a) * r, y + thick * 0.2, Math.sin(a) * r],
        [Math.cos(a) * (r + thick * 0.15), y - len * 0.5, Math.sin(a) * (r + thick * 0.15)],
        [Math.cos(a) * (r + thick * 0.1), y - len, Math.sin(a) * (r + thick * 0.1)],
      ],
      0.5,
    );
    parts.push(
      tube(curve, {
        segments: 8,
        radial: 8,
        radius: (t) => {
          const bulb = t > 0.75 ? 1 + Math.sin(((t - 0.75) / 0.25) * Math.PI) * 0.35 : 1;
          const tip = t > 0.93 ? Math.sqrt(Math.max(0, (1 - t) / 0.07)) : 1;
          return w * (0.75 + 0.25 * (1 - t)) * bulb * tip;
        },
      }),
    );
  }
  return merge(parts);
}

/** Apply a raised waffle grid to a surface, using its local x/z as the grid plane. */
export function waffleGrid(
  geo: THREE.BufferGeometry,
  cell: number,
  depth: number,
  ridge: ColorLike,
  pocket: ColorLike,
): THREE.BufferGeometry {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  geo.computeVertexNormals();
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cr = new THREE.Color(ridge);
  const cp = new THREE.Color(pocket);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    // project onto the dominant plane so steep sides still get squares
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = p.x;
      v = p.z;
    } else if (ax >= az) {
      u = p.z;
      v = p.y;
    } else {
      u = p.x;
      v = p.y;
    }
    const gu = Math.abs((((u / cell) % 1) + 1) % 1 - 0.5) * 2;
    const gv = Math.abs((((v / cell) % 1) + 1) % 1 - 0.5) * 2;
    const rr = smoothstep(0.55, 0.8, Math.max(gu, gv));
    p.addScaledVector(n, (rr - 1) * depth);
    pos.setXYZ(i, p.x, p.y, p.z);
    tmpColor.copy(cp).lerp(cr, rr);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/** A fluffy cloud / marshmallow puff made of overlapping lumpy blobs. */
export function puffGeometry(seed: number, blobs = 7, spread = 1, detail = 3): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * TAU + rng() * 0.6;
    const d = i === 0 ? 0 : spread * randRange(rng, 0.35, 0.75);
    const r = i === 0 ? 0.62 : randRange(rng, 0.38, 0.55);
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(r, detail);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g = mergeVertices(g);
    g.computeVertexNormals();
    g.scale(1, 0.82, 1);
    g.translate(Math.cos(a) * d, randRange(rng, -0.05, 0.18) + (i === 0 ? 0.12 : 0), Math.sin(a) * d * 0.8);
    parts.push(g);
  }
  const g = merge(parts);
  return lumpy(g, 0.035, 2.2, seed);
}

/** Gumdrop silhouette: flat base, soft shoulders, rounded top. */
export function gumdropGeometry(segments = 28): THREE.BufferGeometry {
  return lathe(
    [
      [0, 0],
      [0.42, 0.0],
      [0.5, 0.06],
      [0.48, 0.3],
      [0.4, 0.55],
      [0.24, 0.72],
      [0, 0.78],
    ],
    segments,
    24,
  );
}

/** Strawberry body with seeds, leafy calyx and stem — vertex coloured. */
export function strawberryGeometry(seed = 1, seedCount = 46): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  const profile: [number, number][] = [
    [0.0, -0.62],
    [0.12, -0.55],
    [0.3, -0.3],
    [0.43, 0.02],
    [0.46, 0.2],
    [0.38, 0.36],
    [0.18, 0.44],
    [0.0, 0.45],
  ];
  const body = lathe(profile, 28, 26);
  paint(body, (p) => {
    const t = clamp((p.y + 0.62) / 1.07, 0, 1);
    return tmpColor.set('#e8173a').lerp(new THREE.Color('#ff5a6e'), t * 0.35);
  });
  parts.push(body);
  // seeds sit on the surface, following the lathe profile
  const prof = smoothProfile(profile, 40);
  const radiusAt = (y: number) => {
    for (let i = 0; i < prof.length - 1; i++) {
      const a = prof[i];
      const b = prof[i + 1];
      if ((y >= a.y && y <= b.y) || (y <= a.y && y >= b.y)) {
        const k = (y - a.y) / (b.y - a.y || 1);
        return a.x + (b.x - a.x) * k;
      }
    }
    return 0;
  };
  for (let i = 0; i < seedCount; i++) {
    const y = randRange(rng, -0.48, 0.3);
    const a = i * 2.39996 + rng() * 0.3;
    const r = radiusAt(y) + 0.004;
    const s = new THREE.SphereGeometry(0.022, 6, 4);
    s.scale(1, 1.6, 0.6);
    const n = new THREE.Vector3(Math.cos(a), 0.15, Math.sin(a)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    s.applyQuaternion(q);
    s.translate(Math.cos(a) * r, y, Math.sin(a) * r);
    paint(s, '#ffe680');
    parts.push(s);
  }
  // leafy calyx
  const leafCount = 6;
  for (let i = 0; i < leafCount; i++) {
    const a = (i / leafCount) * TAU;
    const leaf = cuppedPetal(0.34, 0.12, -0.05, 0.015);
    leaf.rotateX(-Math.PI / 2 + 0.35);
    leaf.rotateY(-a + Math.PI / 2);
    leaf.translate(Math.cos(a) * 0.08, 0.43, Math.sin(a) * 0.08);
    paint(leaf, '#3fae4a');
    parts.push(leaf);
  }
  const stem = tube(curveFrom([[0, 0.42, 0], [0.02, 0.55, 0.01], [0.06, 0.66, 0.0]]), {
    segments: 6,
    radial: 6,
    radius: (t) => 0.035 * (1 - t * 0.4),
  });
  paint(stem, '#2f8f3a');
  parts.push(stem);
  return merge(parts);
}

/** A disc with a soft rounded rim (cookies, peppermints, lily pads). */
export function puckGeometry(r: number, h: number, segments = 48, bulge = 0.25): THREE.BufferGeometry {
  return lathe(
    [
      [0, -h / 2],
      [r * 0.7, -h / 2],
      [r * 0.97, -h * 0.35],
      [r, 0],
      [r * 0.97, h * 0.35],
      [r * 0.7, h / 2 + h * bulge * 0.3],
      [0, h / 2 + h * bulge],
    ],
    segments,
    28,
  );
}

/** Classic candy-cane hook as a tube curve. */
export function caneCurve(height: number, hook: number): THREE.CatmullRomCurve3 {
  const pts: [number, number, number][] = [
    [0, 0, 0],
    [0, height * 0.5, 0],
    [0, height, 0],
  ];
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * Math.PI;
    pts.push([hook - Math.cos(a) * hook, height + Math.sin(a) * hook, 0]);
  }
  pts.push([hook * 2, height - hook * 0.4, 0]);
  return curveFrom(pts, 0.5);
}

/** Twisted rope with a star cross-section (licorice). */
export function twistRope(curve: THREE.Curve<THREE.Vector3>, radius: number, twists: number, segments = 48): THREE.BufferGeometry {
  return tube(curve, {
    segments,
    radial: 20,
    radius: (t, a) => {
      const end = Math.min(t, 1 - t) < 0.02 ? 0.6 + Math.min(t, 1 - t) * 20 : 1;
      return radius * end * (1 + 0.14 * Math.cos(a * 5 + t * twists * TAU));
    },
  });
}

/** Little 5-point star used for sparkles and decorations. */
export function starGeometry(size = 0.1, depth = 0.04): THREE.BufferGeometry {
  return extrude(starShape(5, size, size * 0.45, 0.15), depth, depth * 0.35, 4);
}

export function heartGeometry(size = 0.1, depth = 0.05): THREE.BufferGeometry {
  return extrude(heartShape(size), depth, depth * 0.35, 8);
}

/** A music note (head + stem + flag) for musical moments. */
export function noteGeometry(size = 0.12): THREE.BufferGeometry {
  const head = new THREE.SphereGeometry(size * 0.42, 12, 8);
  head.scale(1.3, 0.9, 0.6);
  head.rotateZ(0.4);
  const stem = new THREE.CylinderGeometry(size * 0.07, size * 0.07, size * 1.6, 6);
  stem.translate(size * 0.48, size * 0.8, 0);
  const flag = tube(
    curveFrom([
      [size * 0.48, size * 1.55, 0],
      [size * 0.9, size * 1.2, 0],
      [size * 0.85, size * 0.85, 0],
    ]),
    { segments: 8, radial: 5, radius: (t) => size * 0.09 * (1 - t * 0.6) },
  );
  return merge([head, stem, flag]);
}

/** Generate a radial-gradient texture in code (used for glows and blob shadows). */
let radialTex: THREE.Texture | null = null;
export function radialTexture(): THREE.Texture {
  if (radialTex) return radialTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  radialTex = new THREE.CanvasTexture(canvas);
  radialTex.colorSpace = THREE.SRGBColorSpace;
  return radialTex;
}

/** Shared geometry cache: build once, reuse everywhere. */
const geoCache = new Map<string, THREE.BufferGeometry>();
export function cachedGeo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    g.computeBoundingSphere();
    geoCache.set(key, g);
  }
  return g;
}

/** Icing band from a to b with drips hanging off it (eaves, ledges, walls). */
export function dripsAlong(
  a: [number, number, number],
  b: [number, number, number],
  count: number,
  maxLen: number,
  thick: number,
  seed = 5,
): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const parts: THREE.BufferGeometry[] = [];
  const len = A.distanceTo(B);
  const band = tube(curveFrom([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], b]), {
    segments: Math.max(6, Math.ceil(len * 6)),
    radial: 8,
    radius: (t) => thick * (0.85 + 0.25 * Math.abs(Math.sin(t * len * 5))) * (Math.min(t, 1 - t) < 0.02 ? 0.7 : 1),
  });
  parts.push(band);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5 + randRange(rng, -0.25, 0.25)) / count;
    const p = new THREE.Vector3().lerpVectors(A, B, t);
    const l = maxLen * randRange(rng, 0.3, 1);
    const w = thick * randRange(rng, 0.8, 1.25);
    parts.push(
      tube(curveFrom([[p.x, p.y, p.z], [p.x, p.y - l * 0.5, p.z], [p.x, p.y - l, p.z]]), {
        segments: 8,
        radial: 8,
        radius: (u) => {
          const bulb = u > 0.72 ? 1 + Math.sin(((u - 0.72) / 0.28) * Math.PI) * 0.4 : 1;
          const tip = u > 0.93 ? Math.sqrt(Math.max(0, (1 - u) / 0.07)) : 1;
          return w * (0.7 + 0.3 * (1 - u)) * bulb * tip;
        },
      }),
    );
  }
  return merge(parts);
}

/** Lollipop: a stick with a swirled disc on top (disc faces +z). */
export function lollipopDisc(r: number, thick: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, thick, 48, 1);
  g.rotateX(Math.PI / 2);
  return g;
}

/**
 * A flat ribbon following a curve on the ground, for streams and rivers.
 * uv.x runs along, uv.y across; `flowLen` holds the distance along the flow.
 */
export function flowRibbon(
  curve: THREE.Curve<THREE.Vector3>,
  halfWidth: (t: number) => number,
  y: (x: number, z: number, t: number) => number,
  segments = 120,
  across = 8,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const flow: number[] = [];
  const idx: number[] = [];
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const len = curve.getLength();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, P);
    curve.getTangentAt(t, T);
    T.y = 0;
    T.normalize();
    const rx = -T.z;
    const rz = T.x;
    const hw = halfWidth(t);
    for (let j = 0; j <= across; j++) {
      const a = (j / across) * 2 - 1;
      const x = P.x + rx * a * hw;
      const z = P.z + rz * a * hw;
      pos.push(x, y(x, z, t), z);
      uv.push(t, j / across);
      flow.push(t * len);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j;
      const b = a + across + 1;
      // wound so the surface faces up
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('flowLen', new THREE.Float32BufferAttribute(flow, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make sure the ribbon faces upward regardless of curve direction
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  if (n.count && n.getY(Math.floor(n.count / 2)) < 0) {
    const index = g.getIndex()!;
    const arr = index.array as Uint16Array | Uint32Array;
    for (let k = 0; k < arr.length; k += 3) {
      const tmp = arr[k + 1];
      arr[k + 1] = arr[k + 2];
      arr[k + 2] = tmp;
    }
    index.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

/** A lemon slice: yellow rind, white pith and juicy segments (vertex coloured). */
export function lemonSliceGeometry(r = 0.6, thick = 0.12, segments = 10): THREE.BufferGeometry {
  const g = lathe(
    [
      [0, -thick / 2],
      [r * 0.98, -thick / 2],
      [r, 0],
      [r * 0.98, thick / 2],
      [r * 0.9, thick / 2 + 0.005],
      [r * 0.6, thick / 2 + 0.012],
      [r * 0.3, thick / 2 + 0.016],
      [0, thick / 2 + 0.018],
    ],
    96,
    40,
  );
  const rind = new THREE.Color('#ffd21f');
  const pith = new THREE.Color('#fffbe6');
  const flesh = new THREE.Color('#ffe86b');
  const line = new THREE.Color('#fff8d0');
  paint(g, (p) => {
    const rr = Math.hypot(p.x, p.z) / r;
    if (rr > 0.93 || p.y < thick / 2 - 0.01) return rind;
    if (rr > 0.84) return pith;
    if (rr < 0.12) return pith;
    const a = Math.atan2(p.z, p.x);
    const seg = (2 * Math.PI) / segments;
    const d = Math.abs(((a % seg) + seg) % seg - seg / 2) / (seg / 2);
    return d > 0.82 ? line : new THREE.Color().copy(flesh).lerp(line, rr * 0.25);
  });
  return g;
}
