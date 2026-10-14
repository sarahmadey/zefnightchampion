// Natural-looking plants and rocks, modelled in code: palms and ferns with
// drooping fronds made of individual leaflets, leafy bushes built from
// hundreds of leaves, faceted boulders with moss on top, grass tufts, real
// petals on wildflowers, barked logs, ribbed cacti, layered pines and flat
// stepping stones. Each returns one vertex-coloured geometry so a whole
// grove draws in one instanced call.

import * as THREE from 'three';
import { cachedGeo } from '../three/geometry';
import { TAU, mulberry32 } from '../three/util';

type RNG = () => number;
const C = (hex: string) => new THREE.Color(hex);

/** Collects triangles with colours, then becomes a geometry. */
class Builder {
  pos: number[] = [];
  col: number[] = [];
  nor: number[] | null = null;
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ca: THREE.Color, cb = ca, cc = ca) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, ca: THREE.Color, cb = ca, cc = ca, cd = ca) {
    this.tri(a, b, c, ca, cb, cc);
    this.tri(a, c, d, ca, cc, cd);
  }
  /** add an existing geometry, coloured per vertex */
  geo(g: THREE.BufferGeometry, color: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color) {
    const x = g.index ? g.toNonIndexed() : g;
    if (!x.getAttribute('normal')) x.computeVertexNormals();
    const p = x.getAttribute('position') as THREE.BufferAttribute;
    const n = x.getAttribute('normal') as THREE.BufferAttribute;
    const v = new THREE.Vector3(), w = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      w.fromBufferAttribute(n, i);
      const c = color(v, w);
      this.pos.push(v.x, v.y, v.z);
      this.col.push(c.r, c.g, c.b);
    }
  }
  build(smooth = false): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    if (smooth) {
      // leaves: tilt normals upward so foliage lights softly from both sides
      const n = g.getAttribute('normal') as THREE.BufferAttribute;
      for (let i = 0; i < n.count; i++) {
        const y = Math.abs(n.getY(i)) * 0.5 + 0.5;
        const v = new THREE.Vector3(n.getX(i) * 0.6, y, n.getZ(i) * 0.6).normalize();
        n.setXYZ(i, v.x, v.y, v.z);
      }
    }
    g.computeBoundingSphere();
    return g;
  }
}

function jitter(c: THREE.Color, rng: RNG, amt: number) {
  const k = 1 + (rng() - 0.5) * amt;
  return c.clone().multiplyScalar(k);
}

// ------------------------------------------------------------ noise

function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const h = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  return l(l(l(h(0, 0, 0), h(1, 0, 0), u), l(h(0, 1, 0), h(1, 1, 0), u), v), l(l(h(0, 0, 1), h(1, 0, 1), u), l(h(0, 1, 1), h(1, 1, 1), u), v), w);
}
function fbm3(x: number, y: number, z: number, oct = 4) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise3(x * f, y * f, z * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}

// ------------------------------------------------------------ fronds

/**
 * A pinnate frond (palm or fern) lying along +x from the origin: a rachis
 * that rises then droops, with paired leaflets that hang down a little.
 */
function frond(b: Builder, m: THREE.Matrix4, o: { len: number; rise: number; droop: number; leaflet: number; pairs: number; width: number; base: THREE.Color; tip: THREE.Color; rng: RNG }) {
  const pt = (t: number) => new THREE.Vector3(t * o.len, o.rise * Math.sin(t * Math.PI * 0.6) - o.droop * t * t, 0);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) pts.push(pt(i / 12).applyMatrix4(m));
  // rachis as a thin ribbon
  const stem = o.base.clone().multiplyScalar(0.75);
  for (let i = 0; i < 12; i++) {
    const a = pts[i], c = pts[i + 1];
    const up = new THREE.Vector3(0, 0.012 * (1 - i / 12) + 0.004, 0);
    b.quad(a.clone().sub(up), c.clone().sub(up), c.clone().add(up), a.clone().add(up), stem);
  }
  for (let k = 0; k < o.pairs; k++) {
    const t = 0.12 + (k / (o.pairs - 1)) * 0.86;
    const p0 = pt(t), p1 = pt(Math.min(1, t + 0.02));
    const dir = p1.clone().sub(p0).normalize();
    const len = o.leaflet * Math.sin(Math.min(1, t * 1.15) * Math.PI) * (0.75 + o.rng() * 0.25) + o.leaflet * 0.12;
    const col = o.base.clone().lerp(o.tip, t);
    for (const side of [-1, 1]) {
      // leaflet runs sideways and a bit forward, then droops
      const out = new THREE.Vector3(dir.x * 0.45, -0.25 - o.rng() * 0.15, side * 0.85).normalize();
      const w = o.width * (0.7 + 0.3 * Math.sin(t * Math.PI));
      const a = p0.clone();
      const mid = p0.clone().addScaledVector(out, len * 0.55).add(new THREE.Vector3(0, -len * 0.08, 0));
      const tip = p0.clone().addScaledVector(out, len).add(new THREE.Vector3(0, -len * 0.3, 0));
      const fw = dir.clone().multiplyScalar(w);
      const c1 = jitter(col, o.rng, 0.16);
      const c2 = c1.clone().multiplyScalar(1.12);
      const A = a.applyMatrix4(m), M1 = mid.clone().add(fw).applyMatrix4(m), M2 = mid.clone().sub(fw).applyMatrix4(m), T = tip.applyMatrix4(m);
      b.tri(A, M1, M2, c1, c2, c2);
      b.tri(M2, M1, T, c2, c2, c2);
    }
  }
}

export function palm(variant = 0): THREE.BufferGeometry {
  return cachedGeo(`n-palm-${variant}`, () => {
    const rng = mulberry32(31 + variant * 7);
    const b = new Builder();
    const h = 3.3 + variant * 0.55 + rng() * 0.4;
    const lean = 0.5 + rng() * 0.5;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(lean * 0.12, h * 0.33, 0),
      new THREE.Vector3(lean * 0.45, h * 0.68, 0),
      new THREE.Vector3(lean, h, 0),
    ]);
    // trunk: stacked, slightly flared rings
    const rings = 26, radial = 9;
    const barkA = C('#9a6b3d'), barkB = C('#6e4724');
    const frame = curve.computeFrenetFrames(rings, false);
    const ringPts: THREE.Vector3[][] = [];
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const c = curve.getPointAt(t);
      const r = 0.2 * (1 - t * 0.4) * (1 + 0.16 * Math.pow((i * 3) % 1 === 0 ? 1 : ((i * 0.5) % 1), 2));
      const flare = i % 2 === 0 ? 1.08 : 0.94;
      const ring: THREE.Vector3[] = [];
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * TAU;
        ring.push(c.clone().addScaledVector(frame.normals[i], Math.cos(a) * r * flare).addScaledVector(frame.binormals[i], Math.sin(a) * r * flare));
      }
      ringPts.push(ring);
    }
    for (let i = 0; i < rings; i++)
      for (let j = 0; j < radial; j++) {
        const j2 = (j + 1) % radial;
        const ca = i % 2 ? barkA : barkB;
        b.quad(ringPts[i][j], ringPts[i][j2], ringPts[i + 1][j2], ringPts[i + 1][j], jitter(ca, rng, 0.1));
      }
    const top = curve.getPointAt(1);
    const fronds = 10;
    for (let i = 0; i < fronds; i++) {
      const m = new THREE.Matrix4()
        .makeTranslation(top.x, top.y, top.z)
        .multiply(new THREE.Matrix4().makeRotationY((i / fronds) * TAU + rng() * 0.3))
        .multiply(new THREE.Matrix4().makeRotationZ(0.15 + rng() * 0.25));
      const old = i % 4 === 3;
      frond(b, m, {
        len: 1.9 + rng() * 0.5,
        rise: 0.35,
        droop: 1.15 + rng() * 0.4,
        leaflet: 0.62,
        pairs: 14,
        width: 0.042,
        base: old ? C('#6e8f2c') : C('#2f7d32'),
        tip: old ? C('#c9b45a') : C('#7cc243'),
        rng,
      });
    }
    // a few coconuts tucked under the crown
    for (let i = 0; i < 3; i++) {
      const s = new THREE.IcosahedronGeometry(0.11, 1);
      s.translate(top.x + Math.cos(i * 2.1) * 0.14, top.y - 0.14, top.z + Math.sin(i * 2.1) * 0.14);
      b.geo(s, () => C('#5a3a1c'));
    }
    return b.build();
  });
}

export function fern(variant = 0): THREE.BufferGeometry {
  return cachedGeo(`n-fern-${variant}`, () => {
    const rng = mulberry32(91 + variant * 13);
    const b = new Builder();
    const n = 11;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Matrix4()
        .makeRotationY((i / n) * TAU + rng() * 0.4)
        .multiply(new THREE.Matrix4().makeRotationZ(0.55 + rng() * 0.45));
      frond(b, m, {
        len: 0.85 + rng() * 0.35,
        rise: 0.25,
        droop: 0.75 + rng() * 0.3,
        leaflet: 0.2,
        pairs: 11,
        width: 0.026,
        base: variant ? C('#3d7a22') : C('#2b7a2f'),
        tip: variant ? C('#a9d64a') : C('#8fd14f'),
        rng,
      });
    }
    return b.build(true);
  });
}

// ------------------------------------------------------------ bushes

/** A shrub: an irregular cloud of small leaves around a dark core. */
export function bush(seed = 0, dark = '#1f6b2a', light = '#7dcc4f'): THREE.BufferGeometry {
  return cachedGeo(`n-bush-${seed}-${dark}-${light}`, () => {
    const rng = mulberry32(51 + seed);
    const b = new Builder();
    const lobes: [THREE.Vector3, THREE.Vector3][] = [];
    const nl = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < nl; i++) {
      const r = new THREE.Vector3(0.45 + rng() * 0.25, 0.4 + rng() * 0.25, 0.45 + rng() * 0.25);
      lobes.push([new THREE.Vector3((rng() - 0.5) * 0.8, r.y * 0.75 + rng() * 0.2, (rng() - 0.5) * 0.8), r]);
    }
    const D = C(dark), L = C(light);
    // core so you can't see through
    for (const [c, r] of lobes) {
      const s = new THREE.IcosahedronGeometry(1, 1);
      s.scale(r.x * 0.78, r.y * 0.78, r.z * 0.78);
      s.translate(c.x, c.y, c.z);
      b.geo(s, () => D.clone().multiplyScalar(0.8));
    }
    const leaves = 190;
    const v = new THREE.Vector3();
    for (let i = 0; i < leaves; i++) {
      const [c, r] = lobes[Math.floor(rng() * lobes.length)];
      v.set(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
      if (v.y < -0.4) v.y = -v.y * 0.3;
      const p = new THREE.Vector3(c.x + v.x * r.x, c.y + v.y * r.y, c.z + v.z * r.z);
      if (p.y < 0.03) continue;
      // a leaf facing out, with a random twist
      const nrm = v.clone();
      const t1 = new THREE.Vector3().crossVectors(nrm, new THREE.Vector3(rng() - 0.5, 1, rng() - 0.5)).normalize();
      const t2 = new THREE.Vector3().crossVectors(nrm, t1).normalize();
      const len = 0.13 + rng() * 0.07, wid = len * 0.42;
      const tip = p.clone().addScaledVector(t1, len).addScaledVector(nrm, len * 0.25);
      const base = p.clone().addScaledVector(t1, -len * 0.25);
      const s1 = p.clone().addScaledVector(t2, wid).addScaledVector(t1, len * 0.3).addScaledVector(nrm, -0.01);
      const s2 = p.clone().addScaledVector(t2, -wid).addScaledVector(t1, len * 0.3).addScaledVector(nrm, -0.01);
      const k = Math.min(1, Math.max(0, p.y / 1.1));
      const col = jitter(D.clone().lerp(L, k * 0.8 + rng() * 0.2), rng, 0.22);
      const vein = col.clone().multiplyScalar(1.12);
      b.tri(base, s1, tip, col, col, vein);
      b.tri(base, tip, s2, col, vein, col);
    }
    return b.build(true);
  });
}

// ------------------------------------------------------------ rocks

/** A faceted boulder, a bit flat-bottomed, with darker cracks and an optional mossy top. */
export function boulder(seed = 0, color = '#9aa3ad', moss: string | null = null, flat = 0.7): THREE.BufferGeometry {
  return cachedGeo(`n-rock-${seed}-${color}-${moss}-${flat}`, () => {
    const rng = mulberry32(71 + seed);
    const g = new THREE.IcosahedronGeometry(0.62, 2);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const off = rng() * 50;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = v.clone().normalize();
      const big = fbm3(n.x * 1.3 + off, n.y * 1.3, n.z * 1.3, 3);
      const fine = fbm3(n.x * 4 + off, n.y * 4, n.z * 4, 2);
      const k = 0.72 + big * 0.55 + fine * 0.12;
      v.multiplyScalar(k);
      v.set(v.x * 1.15, Math.max(-0.08, v.y * flat), v.z);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    const base = C(color);
    const mossC = moss ? C(moss) : null;
    const b = new Builder();
    // flat-shaded facets read as stone
    const flatG = g.index ? g.toNonIndexed() : g;
    flatG.computeVertexNormals();
    b.geo(flatG, (q, n) => {
      const crack = fbm3(q.x * 5 + off, q.y * 5, q.z * 5, 2);
      let c = base.clone().multiplyScalar(0.78 + crack * 0.42);
      // sun-bleached top
      c.lerp(C('#ffffff'), Math.max(0, n.y) * 0.12);
      if (mossC && n.y > 0.45) c = c.lerp(mossC, Math.min(1, (n.y - 0.45) * 2.2) * (0.55 + crack * 0.5));
      // dark where it meets the ground
      c.multiplyScalar(0.7 + Math.min(1, (q.y + 0.08) / 0.3) * 0.3);
      return c;
    });
    return b.build();
  });
}

// ------------------------------------------------------------ small plants

export function grassTuft(variant = 0, dark = '#3d8a2c', light = '#b5e26a', blades = 16, spread = 0.16, tall = 1): THREE.BufferGeometry {
  return cachedGeo(`n-grass-${variant}-${dark}-${light}-${blades}-${spread}-${tall}`, () => {
    const rng = mulberry32(17 + variant * 5);
    const b = new Builder();
    const D = C(dark), L = C(light);
    for (let i = 0; i < blades; i++) {
      const a = rng() * TAU;
      const r = Math.sqrt(rng()) * spread;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = (0.18 + rng() * 0.22) * tall;
      const lean = 0.08 + rng() * 0.18;
      const dir = new THREE.Vector3(Math.cos(a + rng() - 0.5), 0, Math.sin(a + rng() - 0.5));
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const w = 0.018 + rng() * 0.01;
      const at = (t: number) => new THREE.Vector3(x, 0, z).addScaledVector(dir, lean * t * t * h * 2).add(new THREE.Vector3(0, h * t, 0));
      const p0 = at(0), p1 = at(0.5), p2 = at(1);
      const c0 = jitter(D, rng, 0.2), c1 = jitter(D.clone().lerp(L, 0.55), rng, 0.15), c2 = jitter(L, rng, 0.15);
      b.quad(p0.clone().addScaledVector(side, -w), p0.clone().addScaledVector(side, w), p1.clone().addScaledVector(side, w * 0.7), p1.clone().addScaledVector(side, -w * 0.7), c0, c0, c1, c1);
      b.tri(p1.clone().addScaledVector(side, -w * 0.7), p1.clone().addScaledVector(side, w * 0.7), p2, c1, c1, c2);
    }
    return b.build(true);
  });
}

function petalShape(len: number, wid: number) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid, len * 0.25, wid * 0.9, len * 0.8, 0, len);
  s.bezierCurveTo(-wid * 0.9, len * 0.8, -wid, len * 0.25, 0, 0);
  return s;
}

export function wildflower(petal: string, center = '#ffd43b', petals = 6): THREE.BufferGeometry {
  return cachedGeo(`n-flower-${petal}-${center}-${petals}`, () => {
    const rng = mulberry32(3);
    const b = new Builder();
    const stemC = C('#3f8f3a');
    const h = 0.48;
    // stem
    const stem = new THREE.CylinderGeometry(0.012, 0.016, h, 5);
    stem.translate(0, h / 2, 0);
    b.geo(stem, () => stemC);
    // two leaves
    for (const s of [-1, 1]) {
      const leaf = new THREE.ShapeGeometry(petalShape(0.2, 0.05), 3);
      leaf.rotateX(-Math.PI / 2 + 0.7);
      leaf.rotateY(s > 0 ? 0.5 : Math.PI + 0.5);
      leaf.translate(0, 0.1 + (s > 0 ? 0.05 : 0), 0);
      b.geo(leaf, () => C('#4caf50'));
    }
    // petals, cupped upward
    const P = C(petal);
    for (let i = 0; i < petals; i++) {
      const pg = new THREE.ShapeGeometry(petalShape(0.11, 0.045), 4);
      const pp = pg.getAttribute('position') as THREE.BufferAttribute;
      for (let k = 0; k < pp.count; k++) pp.setZ(k, -Math.pow(pp.getY(k) / 0.11, 2) * 0.03 + Math.abs(pp.getX(k)) * 0.15);
      pg.rotateX(-Math.PI / 2 + 0.35);
      pg.rotateY((i / petals) * TAU);
      pg.translate(0, h, 0);
      const c = jitter(P, rng, 0.1);
      b.geo(pg, (q) => c.clone().lerp(C('#ffffff'), Math.min(0.35, Math.hypot(q.x, q.z) * 2)));
    }
    const ctr = new THREE.CylinderGeometry(0.03, 0.025, 0.025, 10);
    ctr.translate(0, h + 0.012, 0);
    b.geo(ctr, () => C(center));
    return b.build(true);
  });
}

// ------------------------------------------------------------ trees and logs

export function log(): THREE.BufferGeometry {
  return cachedGeo('n-log', () => {
    const b = new Builder();
    const len = 2.2;
    const body = new THREE.CylinderGeometry(0.3, 0.32, len, 14, 6, true);
    const p = body.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const ridge = 1 + 0.06 * Math.abs(Math.sin(a * 7)) + 0.03 * Math.sin(p.getY(i) * 9 + a * 3);
      p.setX(i, p.getX(i) * ridge);
      p.setZ(i, p.getZ(i) * ridge);
    }
    body.rotateZ(Math.PI / 2);
    body.translate(0, 0.28, 0);
    b.geo(body, (q, n) => C('#6b4423').lerp(C('#8d5a2b'), Math.max(0, n.y) * 0.6).multiplyScalar(0.85 + 0.25 * Math.abs(Math.sin(q.x * 6 + q.z * 9))));
    for (const s of [-1, 1]) {
      const cap = new THREE.CircleGeometry(0.3, 14);
      cap.rotateY((s * Math.PI) / 2);
      cap.translate((s * len) / 2, 0.28, 0);
      b.geo(cap, (q) => {
        const r = Math.hypot(q.y - 0.28, q.z);
        return C('#d9a86c').lerp(C('#a8743f'), (Math.sin(r * 60) * 0.5 + 0.5) * 0.5 + r * 1.2);
      });
    }
    // a little moss on top
    const moss = new THREE.SphereGeometry(0.16, 8, 4, 0, TAU, 0, Math.PI / 2);
    moss.scale(2.4, 0.35, 1.2);
    moss.translate(0.3, 0.55, 0);
    b.geo(moss, () => C('#5f9f3a'));
    return b.build();
  });
}

/** A saguaro with ribs and two arms. */
export function cactus(seed = 0): THREE.BufferGeometry {
  return cachedGeo(`n-cactus-${seed}`, () => {
    const rng = mulberry32(13 + seed);
    const b = new Builder();
    const col = (q: THREE.Vector3, n: THREE.Vector3) => C('#3f8f4f').lerp(C('#6cc070'), Math.max(0, n.y) * 0.3 + (Math.sin(Math.atan2(q.z, q.x) * 12) * 0.5 + 0.5) * 0.25);
    const ribbed = (r: number, h: number) => {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push(new THREE.Vector2(r * (t > 0.85 ? Math.sqrt(Math.max(0, 1 - ((t - 0.85) / 0.15) ** 2)) : 1), t * h));
      }
      const g = new THREE.LatheGeometry(pts, 24);
      const p = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const a = Math.atan2(p.getZ(i), p.getX(i));
        const k = 1 + 0.09 * Math.cos(a * 12);
        p.setX(i, p.getX(i) * k);
        p.setZ(i, p.getZ(i) * k);
      }
      return g;
    };
    const h = 1.7 + rng() * 0.6;
    b.geo(ribbed(0.2, h), col);
    for (const s of [-1, 1]) {
      if (seed % 2 && s < 0) continue;
      const y0 = h * (0.35 + rng() * 0.2);
      const arm = ribbed(0.13, 0.55 + rng() * 0.35);
      arm.translate(0.36 * s, y0 + 0.12, 0);
      b.geo(arm, col);
      const elbow = new THREE.CylinderGeometry(0.12, 0.12, 0.36, 16);
      elbow.rotateZ(Math.PI / 2);
      elbow.translate(0.2 * s, y0, 0);
      b.geo(elbow, col);
    }
    return b.build();
  });
}

/** A pine of jagged, drooping tiers; snowy pines carry snow on top. */
export function pine(seed = 0, snow = false): THREE.BufferGeometry {
  return cachedGeo(`n-pine-${seed}-${snow}`, () => {
    const rng = mulberry32(23 + seed);
    const b = new Builder();
    const trunk = new THREE.CylinderGeometry(0.08, 0.13, 0.9, 7);
    trunk.translate(0, 0.45, 0);
    b.geo(trunk, () => C('#5a3a22'));
    const tiers = 5;
    const H = 2.6 + rng() * 0.6;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers;
      const r = 0.95 * (1 - t * 0.78);
      const y0 = 0.55 + t * (H - 0.8);
      const hgt = 0.95 * (1 - t * 0.35);
      const cone = new THREE.ConeGeometry(r, hgt, 16, 3, true);
      const p = cone.getAttribute('position') as THREE.BufferAttribute;
      for (let k = 0; k < p.count; k++) {
        const y = p.getY(k);
        const a = Math.atan2(p.getZ(k), p.getX(k));
        // jagged, drooping hem
        if (y < -hgt * 0.45) {
          const j = 1 + 0.18 * (Math.abs(Math.sin(a * 8 + i)) - 0.4);
          p.setX(k, p.getX(k) * j);
          p.setZ(k, p.getZ(k) * j);
          p.setY(k, y - 0.06 * Math.abs(Math.sin(a * 8 + i)));
        }
      }
      cone.translate(0, y0 + hgt / 2, 0);
      b.geo(cone, (_q, n) => {
        let c = C('#1e5b34').lerp(C('#3f8f4f'), Math.max(0, n.y) * 0.5 + rng() * 0.1);
        if (snow && n.y > 0.35) c = c.lerp(C('#ffffff'), Math.min(1, (n.y - 0.35) * 2.6));
        return c;
      });
    }
    return b.build();
  });
}

// ------------------------------------------------------------ board bits

/** A flat stepping stone with an irregular edge and a speckled top. */
export function flatStone(): THREE.BufferGeometry {
  return cachedGeo('n-stone', () => {
    const rng = mulberry32(5);
    const shape = new THREE.Shape();
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const r = 0.6 * (0.9 + 0.1 * Math.sin(a * 3 + 0.7) + (rng() - 0.5) * 0.06);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 4 });
    g.rotateX(-Math.PI / 2);
    // a gently domed, slightly uneven top
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
      if (y > 0.05) p.setY(i, y + 0.035 * (1 - (x * x + z * z) / 0.5) + 0.012 * Math.sin(x * 9) * Math.cos(z * 7));
    }
    const b = new Builder();
    b.geo(g, (q, nn) => {
      const speck = fbm3(q.x * 9, q.y * 9, q.z * 9, 2);
      const c = C('#ffffff').multiplyScalar(0.8 + speck * 0.3);
      // darker sides
      return c.multiplyScalar(nn.y > 0.6 ? 1 : 0.72);
    });
    return b.build();
  });
}
