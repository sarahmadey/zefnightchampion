// 3D prize icons that pop out of the treasure chest: candy, a popcorn tub
// for movie night, a burger with fries, a squishy, pizza, ice cream, a toy,
// a park tree, a book and a present. All modelled in code, vertex-coloured.

import * as THREE from 'three';
import { cachedGeo, curveFrom, lathe, merge, paint, roundedBox, tube } from '../three/geometry';
import { TAU } from '../three/util';
import type { PrizeIcon } from '../game/rewards';

const C = (h: string) => new THREE.Color(h);

function col(g: THREE.BufferGeometry, c: string | ((p: THREE.Vector3) => THREE.Color)) {
  const n = g.index ? g.toNonIndexed() : g;
  if (typeof c === 'string') paint(n, c);
  else paint(n, (p) => c(p));
  return n;
}

function candy() {
  const body = col(new THREE.SphereGeometry(0.32, 22, 16).scale(1.15, 0.85, 0.85), (p) =>
    Math.floor((Math.atan2(p.y, p.z) + Math.PI) / (TAU / 8) + p.x * 4) % 2 ? C('#ff4d8d') : C('#ffffff'),
  );
  const parts = [body];
  for (const s of [-1, 1]) {
    const wrap = new THREE.ConeGeometry(0.2, 0.28, 10, 1, true);
    wrap.rotateZ((s * Math.PI) / 2);
    wrap.translate(s * 0.48, 0, 0);
    parts.push(col(wrap, '#ffd43b'));
  }
  return merge(parts);
}

function popcorn() {
  const tub = col(lathe([[0.0, 0], [0.24, 0], [0.34, 0.55], [0.0, 0.55]], 24, 8), (p) =>
    Math.floor((Math.atan2(p.z, p.x) + Math.PI) / (TAU / 12)) % 2 ? C('#e03131') : C('#ffffff'),
  );
  const parts = [tub];
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39;
    const r = Math.sqrt(i / 26) * 0.3;
    const k = new THREE.IcosahedronGeometry(0.075, 1);
    k.translate(Math.cos(a) * r, 0.58 + (1 - r / 0.3) * 0.12 + (i % 3) * 0.02, Math.sin(a) * r);
    parts.push(col(k, i % 4 ? '#fff3bf' : '#ffe066'));
  }
  return merge(parts).translate(0, -0.3, 0);
}

function burger() {
  const parts: THREE.BufferGeometry[] = [];
  const bunTop = lathe([[0, 0.38], [0.22, 0.35], [0.34, 0.25], [0.36, 0.16], [0.0, 0.16]], 24, 8);
  parts.push(col(bunTop, '#e8a33d'));
  for (let i = 0; i < 9; i++) {
    const s = new THREE.SphereGeometry(0.018, 6, 4).scale(1, 0.5, 1.6);
    const a = i * 2.1;
    s.translate(Math.cos(a) * 0.18, 0.34, Math.sin(a) * 0.18);
    parts.push(col(s, '#fff8e1'));
  }
  parts.push(col(new THREE.CylinderGeometry(0.37, 0.37, 0.03, 24).translate(0, 0.15, 0), '#51cf66'));
  parts.push(col(new THREE.CylinderGeometry(0.36, 0.36, 0.025, 24).translate(0, 0.125, 0), '#ffd43b'));
  parts.push(col(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 24).translate(0, 0.07, 0), '#6b3e26'));
  parts.push(col(lathe([[0.0, -0.04], [0.33, -0.04], [0.35, 0.0], [0.33, 0.025], [0.0, 0.025]], 24, 6), '#e8a33d'));
  const fries = col(roundedBox(0.2, 0.22, 0.12, 0.03), '#e03131').translate(0.42, 0.06, 0);
  parts.push(fries);
  for (let i = 0; i < 7; i++) {
    const f = new THREE.BoxGeometry(0.03, 0.22, 0.03);
    f.rotateZ((i - 3) * 0.08);
    f.translate(0.36 + i * 0.02, 0.24, (i % 2) * 0.03 - 0.015);
    parts.push(col(f, '#ffd43b'));
  }
  return merge(parts).translate(-0.1, -0.15, 0);
}

function squishy() {
  const body = col(new THREE.SphereGeometry(0.34, 24, 18).scale(1.1, 0.85, 1), '#ffc9e3');
  const parts = [body];
  for (const s of [-1, 1]) {
    parts.push(col(new THREE.ConeGeometry(0.1, 0.16, 12).translate(s * 0.2, 0.32, 0), '#ffc9e3'));
    parts.push(col(new THREE.SphereGeometry(0.04, 10, 8).translate(s * 0.12, 0.05, 0.31), '#2b1b2e'));
    parts.push(col(new THREE.SphereGeometry(0.05, 10, 8).scale(1, 0.6, 0.3).translate(s * 0.22, -0.04, 0.28), '#ff8fb8'));
  }
  parts.push(col(new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI).rotateZ(Math.PI).translate(0, -0.02, 0.33), '#2b1b2e'));
  return merge(parts);
}

function pizza() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.4);
  s.lineTo(0.3, 0.3);
  s.quadraticCurveTo(0, 0.42, -0.3, 0.3);
  s.lineTo(0, -0.4);
  const slice = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
  const base = col(slice, (p) => (p.y > 0.27 ? C('#e8a33d') : p.z > 0.04 ? C('#ffd43b') : C('#f4c97a')));
  const parts = [base];
  [
    [0.0, 0.1],
    [-0.1, 0.18],
    [0.1, 0.17],
    [0.0, -0.12],
  ].forEach(([x, y]) => parts.push(col(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 14).rotateX(Math.PI / 2).translate(x, y, 0.075), '#e03131')));
  return merge(parts).rotateX(-0.25);
}

function icecream() {
  const cone = col(new THREE.ConeGeometry(0.16, 0.42, 16).rotateX(Math.PI).translate(0, -0.15, 0), (p) =>
    (Math.floor((p.y + 1) * 14) + Math.floor((Math.atan2(p.z, p.x) + Math.PI) * 2.5)) % 2 ? C('#e8a33d') : C('#d08c2a'),
  );
  return merge([
    cone,
    col(new THREE.SphereGeometry(0.19, 18, 14).translate(0, 0.12, 0), '#ffc9de'),
    col(new THREE.SphereGeometry(0.16, 18, 14).translate(0, 0.32, 0), '#a5d8ff'),
    col(new THREE.SphereGeometry(0.05, 10, 8).translate(0, 0.5, 0), '#e03131'),
  ]);
}

function toy() {
  // a little toy car
  const parts: THREE.BufferGeometry[] = [];
  parts.push(col(roundedBox(0.62, 0.18, 0.32, 0.07).translate(0, 0.05, 0), '#4dabf7'));
  parts.push(col(roundedBox(0.34, 0.16, 0.28, 0.06).translate(-0.04, 0.2, 0), '#a5d8ff'));
  for (const x of [-0.2, 0.2])
    for (const z of [-0.17, 0.17]) parts.push(col(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 14).rotateX(Math.PI / 2).translate(x, -0.04, z), '#343a40'));
  return merge(parts);
}

function park() {
  const trunk = col(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 8).translate(0, -0.1, 0), '#8d5a2b');
  const parts = [trunk];
  [
    [0, 0.25, 0, 0.26],
    [0.16, 0.16, 0.05, 0.18],
    [-0.16, 0.18, -0.03, 0.18],
  ].forEach(([x, y, z, r]) => parts.push(col(new THREE.IcosahedronGeometry(r, 2).translate(x, y, z), '#51cf66')));
  return merge(parts);
}

function book() {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(col(roundedBox(0.5, 0.06, 0.38, 0.02).translate(0, -0.05, 0), '#e64980'));
  parts.push(col(roundedBox(0.47, 0.06, 0.36, 0.01).translate(0.0, 0.01, 0), '#fff9db'));
  parts.push(col(roundedBox(0.5, 0.03, 0.38, 0.015).translate(0, 0.055, 0), '#e64980'));
  return merge(parts).rotateX(-0.6);
}

function gift() {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(col(roundedBox(0.46, 0.4, 0.46, 0.04), '#9775fa'));
  parts.push(col(new THREE.BoxGeometry(0.47, 0.41, 0.09), '#ffd43b'));
  parts.push(col(new THREE.BoxGeometry(0.09, 0.41, 0.47), '#ffd43b'));
  for (const s of [-1, 1]) parts.push(col(new THREE.TorusGeometry(0.08, 0.025, 8, 16).rotateY(Math.PI / 2).rotateZ(s * 0.6).translate(s * 0.07, 0.26, 0), '#ffd43b'));
  return merge(parts);
}

export function prizeGeometry(icon: PrizeIcon): THREE.BufferGeometry {
  return cachedGeo(`prize-${icon}`, () => {
    switch (icon) {
      case 'candy':
        return candy();
      case 'movie':
        return popcorn();
      case 'burger':
        return burger();
      case 'squishy':
        return squishy();
      case 'pizza':
        return pizza();
      case 'icecream':
        return icecream();
      case 'toy':
        return toy();
      case 'park':
        return park();
      case 'book':
        return book();
      default:
        return gift();
    }
  });
}

/** A lucky star sticker (for spaces Zef has already reached). */
export function stickerGeometry(): THREE.BufferGeometry {
  return cachedGeo('sticker', () => {
    const s = new THREE.Shape();
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU + Math.PI / 2;
      const r = i % 2 === 0 ? 0.36 : 0.16;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2);
    return g;
  });
}

export function ropeGeometry(a: THREE.Vector3, b: THREE.Vector3, sag: number, r = 0.035): THREE.BufferGeometry {
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= sag;
  return tube(curveFrom([[a.x, a.y, a.z], [mid.x, mid.y, mid.z], [b.x, b.y, b.z]]), { segments: 24, radial: 6, radius: () => r });
}
