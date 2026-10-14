// Sculpting with signed distance fields. A creature is a list of soft
// primitives (ellipsoids, tapered capsules, rounded boxes) blended together
// like clay, then turned into a smooth mesh with surface nets. Each primitive
// belongs to a bone, so the mesh comes out skinned: where two primitives
// blend, the skin bends smoothly between their bones. Primitives also say
// which side is the back and which is the belly, so the skin shader can
// colour the belly, paint back markings and groove the belly bands.

import * as THREE from 'three';

export type V3 = [number, number, number];

export interface Region {
  /** index into the skeleton's bones */
  bone: number;
  /** 0..1: how much this part's underside gets the belly colour */
  belly?: number;
  /** this part's "up" (towards the back), in bind space */
  dorsal?: V3;
  /** the axis belly bands are spaced along */
  band?: V3;
}

abstract class Prim {
  region: Region;
  constructor(region: Region) {
    this.region = region;
  }
  abstract d(x: number, y: number, z: number): number;
  abstract bounds(out: THREE.Box3): THREE.Box3;
}

/** Rotation matrix (row-major 3x3) that takes a world offset into local space. */
function invRot(rot?: V3): number[] | null {
  if (!rot || (rot[0] === 0 && rot[1] === 0 && rot[2] === 0)) return null;
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])).invert();
  const e = m.elements;
  return [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]];
}

export class Ellipsoid extends Prim {
  cx: number; cy: number; cz: number;
  rx: number; ry: number; rz: number;
  m: number[] | null;
  constructor(c: V3, r: V3, region: Region, rot?: V3) {
    super(region);
    [this.cx, this.cy, this.cz] = c;
    [this.rx, this.ry, this.rz] = r;
    this.m = invRot(rot);
  }
  d(x: number, y: number, z: number) {
    let px = x - this.cx, py = y - this.cy, pz = z - this.cz;
    const m = this.m;
    if (m) {
      const qx = m[0] * px + m[1] * py + m[2] * pz;
      const qy = m[3] * px + m[4] * py + m[5] * pz;
      const qz = m[6] * px + m[7] * py + m[8] * pz;
      px = qx; py = qy; pz = qz;
    }
    const ax = px / this.rx, ay = py / this.ry, az = pz / this.rz;
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const bx = ax / this.rx, by = ay / this.ry, bz = az / this.rz;
    const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
    return k1 < 1e-9 ? -Math.min(this.rx, this.ry, this.rz) : (k0 * (k0 - 1)) / k1;
  }
  bounds(out: THREE.Box3) {
    const r = Math.max(this.rx, this.ry, this.rz);
    return out.set(new THREE.Vector3(this.cx - r, this.cy - r, this.cz - r), new THREE.Vector3(this.cx + r, this.cy + r, this.cz + r));
  }
}

/** A capsule whose radius changes from r1 at a to r2 at b (exact distance). */
export class RoundCone extends Prim {
  ax: number; ay: number; az: number;
  bax: number; bay: number; baz: number;
  r1: number; r2: number;
  l2: number; rr: number; a2: number; il2: number;
  constructor(a: V3, b: V3, r1: number, r2: number, region: Region) {
    super(region);
    [this.ax, this.ay, this.az] = a;
    this.bax = b[0] - a[0];
    this.bay = b[1] - a[1];
    this.baz = b[2] - a[2];
    this.r1 = r1;
    this.r2 = r2;
    this.l2 = this.bax * this.bax + this.bay * this.bay + this.baz * this.baz;
    this.rr = r1 - r2;
    this.a2 = this.l2 - this.rr * this.rr;
    this.il2 = 1 / this.l2;
  }
  d(x: number, y: number, z: number) {
    const pax = x - this.ax, pay = y - this.ay, paz = z - this.az;
    const l2 = this.l2;
    const yy = pax * this.bax + pay * this.bay + paz * this.baz;
    const zz = yy - l2;
    const qx = pax * l2 - this.bax * yy, qy = pay * l2 - this.bay * yy, qz = paz * l2 - this.baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * l2;
    const z2 = zz * zz * l2;
    const rr = this.rr;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * this.a2 * z2 > k) return Math.sqrt(x2 + z2) * this.il2 - this.r2;
    if (Math.sign(yy) * this.a2 * y2 < k) return Math.sqrt(x2 + y2) * this.il2 - this.r1;
    return (Math.sqrt(x2 * this.a2 * this.il2) + yy * rr) * this.il2 - this.r1;
  }
  bounds(out: THREE.Box3) {
    const r = Math.max(this.r1, this.r2);
    const bx = this.ax + this.bax, by = this.ay + this.bay, bz = this.az + this.baz;
    return out.set(
      new THREE.Vector3(Math.min(this.ax, bx) - r, Math.min(this.ay, by) - r, Math.min(this.az, bz) - r),
      new THREE.Vector3(Math.max(this.ax, bx) + r, Math.max(this.ay, by) + r, Math.max(this.az, bz) + r),
    );
  }
}

export class RoundBox extends Prim {
  cx: number; cy: number; cz: number;
  hx: number; hy: number; hz: number;
  r: number;
  m: number[] | null;
  constructor(c: V3, half: V3, r: number, region: Region, rot?: V3) {
    super(region);
    [this.cx, this.cy, this.cz] = c;
    this.r = r;
    this.hx = half[0] - r;
    this.hy = half[1] - r;
    this.hz = half[2] - r;
    this.m = invRot(rot);
  }
  d(x: number, y: number, z: number) {
    let px = x - this.cx, py = y - this.cy, pz = z - this.cz;
    const m = this.m;
    if (m) {
      const qx = m[0] * px + m[1] * py + m[2] * pz;
      const qy = m[3] * px + m[4] * py + m[5] * pz;
      const qz = m[6] * px + m[7] * py + m[8] * pz;
      px = qx; py = qy; pz = qz;
    }
    const qx = Math.abs(px) - this.hx, qy = Math.abs(py) - this.hy, qz = Math.abs(pz) - this.hz;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - this.r;
  }
  bounds(out: THREE.Box3) {
    const r = Math.hypot(this.hx, this.hy, this.hz) + this.r;
    return out.set(new THREE.Vector3(this.cx - r, this.cy - r, this.cz - r), new THREE.Vector3(this.cx + r, this.cy + r, this.cz + r));
  }
}

/** Everything below y = h (used to flatten soles); subtract it. */
export class Below extends Prim {
  h: number;
  constructor(h: number, region: Region) {
    super(region);
    this.h = h;
  }
  d(_x: number, y: number) {
    return y - this.h;
  }
  bounds(out: THREE.Box3) {
    return out.makeEmpty();
  }
}

type OpKind = 0 | 1 | 2; // add, subtract, intersect
interface Op {
  prim: Prim;
  kind: OpKind;
  k: number;
  /** where this op can change the field (null: everywhere) */
  box: THREE.Box3 | null;
}

function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function smax(a: number, b: number, k: number) {
  return -smin(-a, -b, k);
}

/** A sculpture: primitives added, carved and intersected in order. */
export class Sculpt {
  ops: Op[] = [];
  private push(prim: Prim, kind: OpKind, k: number) {
    const b = prim.bounds(new THREE.Box3());
    this.ops.push({ prim, kind, k, box: kind === 2 || b.isEmpty() ? null : b.expandByScalar(k + 0.01) });
    return this;
  }
  add(p: Prim, k = 0.04) {
    return this.push(p, 0, k);
  }
  sub(p: Prim, k = 0.02) {
    return this.push(p, 1, k);
  }
  inter(p: Prim, k = 0.02) {
    return this.push(p, 2, k);
  }
  d(x: number, y: number, z: number) {
    return this.dl(null, x, y, z);
  }
  /** the field using only the listed ops (in order), or all of them */
  dl(list: Int32Array | null, x: number, y: number, z: number) {
    let d = 1e9;
    const ops = this.ops;
    const n = list ? list.length : ops.length;
    for (let j = 0; j < n; j++) {
      const o = ops[list ? list[j] : j];
      const v = o.prim.d(x, y, z);
      if (o.kind === 0) d = smin(d, v, o.k);
      else if (o.kind === 1) d = smax(d, -v, o.k);
      else d = smax(d, v, o.k);
    }
    return d;
  }
  /** the ops that can matter inside a box */
  near(box: THREE.Box3): Int32Array {
    const out: number[] = [];
    this.ops.forEach((o, i) => {
      if (!o.box || o.box.intersectsBox(box)) out.push(i);
    });
    return Int32Array.from(out);
  }
  bounds(margin = 0.05): THREE.Box3 {
    const box = new THREE.Box3();
    const b = new THREE.Box3();
    for (const o of this.ops) if (o.kind === 0) box.union(o.prim.bounds(b));
    return box.expandByScalar(margin);
  }
}

// ------------------------------------------------------------ meshing

/**
 * Surface nets over a grid with `cell` spacing. Far from the surface the
 * field is only sampled on a coarse grid, which keeps this quick.
 */
function surfaceNet(s: Sculpt, box: THREE.Box3, cell: number, margin: number) {
  const f = (x: number, y: number, z: number) => s.d(x, y, z);
  const ox = box.min.x, oy = box.min.y, oz = box.min.z;
  const B = 4;
  const nx = Math.ceil((box.max.x - ox) / cell / B) * B + 1;
  const ny = Math.ceil((box.max.y - oy) / cell / B) * B + 1;
  const nz = Math.ceil((box.max.z - oz) / cell / B) * B + 1;
  const sxy = nx * ny;
  const field = new Float32Array(nx * ny * nz);
  const band = B * cell * 1.9;
  // coarse pass
  const cx = (nx - 1) / B + 1, cy = (ny - 1) / B + 1, cz = (nz - 1) / B + 1;
  const coarse = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) coarse[i + j * cx + k * cx * cy] = f(ox + i * B * cell, oy + j * B * cell, oz + k * B * cell);
  // fine pass, only in blocks the surface might cross, with just the ops near each block
  const bx = cx - 1, by = cy - 1;
  const blockOps: (Int32Array | null)[] = new Array(bx * by * (cz - 1)).fill(null);
  const bb = new THREE.Box3();
  const span = B * cell;
  for (let bk = 0; bk < cz - 1; bk++)
    for (let bj = 0; bj < cy - 1; bj++)
      for (let bi = 0; bi < cx - 1; bi++) {
        let near = false;
        let sum = 0;
        for (let c = 0; c < 8; c++) {
          const v = coarse[bi + (c & 1) + (bj + ((c >> 1) & 1)) * cx + (bk + (c >> 2)) * cx * cy];
          sum += v;
          if (Math.abs(v) < band) near = true;
        }
        let list: Int32Array | null = null;
        if (near) {
          bb.min.set(ox + bi * span, oy + bj * span, oz + bk * span);
          bb.max.set(bb.min.x + span, bb.min.y + span, bb.min.z + span);
          list = s.near(bb.expandByScalar(margin));
          blockOps[bi + bj * bx + bk * bx * by] = list;
        }
        for (let k = 0; k <= B; k++)
          for (let j = 0; j <= B; j++)
            for (let i = 0; i <= B; i++) {
              const gi = bi * B + i, gj = bj * B + j, gk = bk * B + k;
              const idx = gi + gj * nx + gk * sxy;
              field[idx] = list ? s.dl(list, ox + gi * cell, oy + gj * cell, oz + gk * cell) : sum / 8;
            }
      }

  // one vertex per cell the surface crosses
  const mx = nx - 1, my = ny - 1, mz = nz - 1;
  const vid = new Int32Array(mx * my * mz).fill(-1);
  const pos: number[] = [];
  const idx: number[] = [];
  const vlist: (Int32Array | null)[] = [];
  const v = new Float32Array(8);
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  for (let k = 0; k < mz; k++)
    for (let j = 0; j < my; j++)
      for (let i = 0; i < mx; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const val = field[i + (c & 1) + (j + ((c >> 1) & 1)) * nx + (k + (c >> 2)) * sxy];
          v[c] = val;
          if (val < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let px = 0, py = 0, pz = 0, n = 0;
        for (const [a, b] of EDGES) {
          const va = v[a], vb = v[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          px += (a & 1) + ((b & 1) - (a & 1)) * t;
          py += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          pz += (a >> 2) + ((b >> 2) - (a >> 2)) * t;
          n++;
        }
        const id = pos.length / 3;
        pos.push(ox + (i + px / n) * cell, oy + (j + py / n) * cell, oz + (k + pz / n) * cell);
        vlist.push(blockOps[Math.min(bx - 1, Math.floor(i / B)) + Math.min(by - 1, Math.floor(j / B)) * bx + Math.min(cz - 2, Math.floor(k / B)) * bx * by]);
        const ci = i + j * mx + k * mx * my;
        vid[ci] = id;
        // quads for the three edges leaving corner 0
        const inside = v[0] < 0;
        for (let a = 0; a < 3; a++) {
          const corner = 1 << a;
          if (v[0] < 0 === v[corner] < 0) continue;
          const b = (a + 1) % 3, c = (a + 2) % 3;
          const ijk = [i, j, k];
          if (ijk[b] === 0 || ijk[c] === 0) continue;
          const st = [1, mx, mx * my];
          const A = ci, Bc = ci - st[b], C = ci - st[b] - st[c], D = ci - st[c];
          const va = vid[A], vb = vid[Bc], vc = vid[C], vd = vid[D];
          if (va < 0 || vb < 0 || vc < 0 || vd < 0) continue;
          if (inside) idx.push(va, vb, vc, va, vc, vd);
          else idx.push(va, vc, vb, va, vd, vc);
        }
      }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), vlist };
}

export interface SculptMeshOpts {
  cell: number;
  /** extra space around the primitives' bounds */
  margin?: number;
  /** compute ambient occlusion into the mask's w channel */
  ao?: boolean;
}

/**
 * Mesh a sculpture into a skinned geometry with:
 * - skinIndex/skinWeight from the primitives' bones
 * - aMask = (belly, back, band coordinate, ambient occlusion)
 */
export function meshSculpt(s: Sculpt, opts: SculptMeshOpts): THREE.BufferGeometry {
  const box = s.bounds(opts.margin ?? opts.cell * 3);
  // ops within reach of a block: enough for the AO samples along the normal
  const { pos, idx, vlist } = surfaceNet(s, box, opts.cell, 0.12);
  const count = pos.length / 3;
  const nor = new Float32Array(count * 3);
  const e = opts.cell * 0.5;
  let list: Int32Array | null = null;
  const f = (x: number, y: number, z: number) => s.dl(list, x, y, z);
  // pull vertices onto the surface and take normals from the gradient
  for (let i = 0; i < count; i++) {
    list = vlist[i];
    let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    let gx = 0, gy = 0, gz = 0;
    for (let it = 0; it < 2; it++) {
      const d = f(x, y, z);
      gx = f(x + e, y, z) - f(x - e, y, z);
      gy = f(x, y + e, z) - f(x, y - e, z);
      gz = f(x, y, z + e) - f(x, y, z - e);
      const g2 = (gx * gx + gy * gy + gz * gz) / (4 * e * e);
      if (g2 < 1e-8) break;
      const step = d / g2 / (2 * e);
      // never move further than half a cell
      const lim = opts.cell * 0.5;
      x -= Math.max(-lim, Math.min(lim, step * gx));
      y -= Math.max(-lim, Math.min(lim, step * gy));
      z -= Math.max(-lim, Math.min(lim, step * gz));
    }
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    const gl = Math.hypot(gx, gy, gz) || 1;
    nor[i * 3] = gx / gl;
    nor[i * 3 + 1] = gy / gl;
    nor[i * 3 + 2] = gz / gl;
  }

  // skin weights and masks from the primitives near each vertex
  const adds = s.ops.filter((o) => o.kind === 0);
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  const mask = new Float32Array(count * 4);
  const dist = new Float32Array(adds.length);
  const boneW = new Map<number, number>();
  for (let i = 0; i < count; i++) {
    list = vlist[i];
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const nx = nor[i * 3], ny = nor[i * 3 + 1], nz = nor[i * 3 + 2];
    let dmin = 1e9;
    for (let p = 0; p < adds.length; p++) {
      const o = adds[p];
      // skip primitives far from this vertex's block
      if (list && o.box && !o.box.containsPoint(tmpP.set(x, y, z))) {
        dist[p] = 1e9;
        continue;
      }
      dist[p] = o.prim.d(x, y, z);
      if (dist[p] < dmin) dmin = dist[p];
    }
    boneW.clear();
    let wsum = 0, belly = 0, back = 0, bandC = 0;
    for (let p = 0; p < adds.length; p++) {
      const o = adds[p];
      const blend = Math.max(0.025, o.k * 1.2);
      const t = 1 - (dist[p] - dmin) / blend;
      if (t <= 0) continue;
      const w = t * t;
      const r = o.prim.region;
      boneW.set(r.bone, (boneW.get(r.bone) ?? 0) + w);
      const dv = r.dorsal ?? [0, 1, 0];
      const up = nx * dv[0] + ny * dv[1] + nz * dv[2];
      belly += w * (r.belly ?? 0) * smooth(0.05, -0.55, up);
      back += w * smooth(0.05, 0.75, up);
      const bv = r.band ?? [0, 1, 0];
      bandC += w * (x * bv[0] + y * bv[1] + z * bv[2]);
      wsum += w;
    }
    const top = [...boneW.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tw = top.reduce((a, b) => a + b[1], 0) || 1;
    for (let k = 0; k < 4; k++) {
      skinIndex[i * 4 + k] = top[k] ? top[k][0] : 0;
      skinWeight[i * 4 + k] = top[k] ? top[k][1] / tw : 0;
    }
    mask[i * 4] = belly / (wsum || 1);
    mask[i * 4 + 1] = back / (wsum || 1);
    mask[i * 4 + 2] = bandC / (wsum || 1);
    // ambient occlusion: how much the field "closes in" along the normal
    if (opts.ao) {
      let occ = 0;
      for (let k = 1; k <= 4; k++) {
        const h = k * 0.025;
        occ += (h - f(x + nx * h, y + ny * h, z + nz * h)) / Math.pow(2, k);
      }
      mask[i * 4 + 3] = Math.max(0, Math.min(1, 1 - occ * 7));
    } else mask[i * 4 + 3] = 1;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  g.setAttribute('aMask', new THREE.BufferAttribute(mask, 4));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

const tmpP = new THREE.Vector3();

function smooth(a: number, b: number, v: number) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
