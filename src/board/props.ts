// Procedural props for the lands of Dino Land. Each builder returns one
// merged, vertex-coloured geometry so a whole forest is a single instanced
// draw call: palms, ferns, bushes, flowers, mushrooms, rocks, cacti, bones,
// snowy pines, crystals, shells and more.

import * as THREE from 'three';
import { cachedGeo, curveFrom, extrude, lathe, merge, paint, starShape, tube } from '../three/geometry';
import { TAU, mulberry32, randRange } from '../three/util';
import { boulder, bush, cactus, fern, log, palm, pine, wildflower } from './nature';

const C = (hex: string) => new THREE.Color(hex);

function colored(g: THREE.BufferGeometry, color: string | ((p: THREE.Vector3) => THREE.Color)): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute('uv');
  if (typeof color === 'string') paint(ng, color);
  else paint(ng, (p) => color(p));
  return ng;
}

// ------------------------------------------------------------- jungle

export function palmGeometry(variant = 0): THREE.BufferGeometry {
  return palm(variant);
}


export function fernGeometry(): THREE.BufferGeometry {
  return fern(0);
}


export function bushGeometry(seed = 0): THREE.BufferGeometry {
  return bush(seed);
}


export function flowerGeometry(petal: string, center = '#ffd43b'): THREE.BufferGeometry {
  return wildflower(petal, center);
}


export function mushroomGeometry(cap = '#ff6b6b'): THREE.BufferGeometry {
  return cachedGeo(`mushroom-${cap}`, () => {
    const stem = colored(lathe([[0.0, 0], [0.12, 0], [0.1, 0.25], [0.08, 0.42], [0.0, 0.44]], 12, 8), '#fff4e6');
    const capG = lathe([[0.0, 0.62], [0.2, 0.6], [0.34, 0.5], [0.38, 0.38], [0.3, 0.36], [0.0, 0.37]], 18, 10);
    const capC = colored(capG, cap);
    const dots: THREE.BufferGeometry[] = [];
    const rng = mulberry32(5);
    for (let i = 0; i < 6; i++) {
      const a = rng() * TAU;
      const r = 0.12 + rng() * 0.15;
      const d = new THREE.SphereGeometry(0.045, 8, 6);
      d.scale(1, 0.4, 1);
      d.translate(Math.cos(a) * r, 0.58 - r * 0.5, Math.sin(a) * r);
      dots.push(colored(d, '#ffffff'));
    }
    return merge([stem, capC, ...dots]);
  });
}

export function rockGeometry(seed = 0, color = '#a0a7b8'): THREE.BufferGeometry {
  return boulder(seed, color);
}


export function logGeometry(): THREE.BufferGeometry {
  return log();
}


// ------------------------------------------------------------- volcano

export function emberBushGeometry(): THREE.BufferGeometry {
  return bush(3, '#7a2a12', '#f08c3a');
}


export function steamVentGeometry(): THREE.BufferGeometry {
  return cachedGeo('vent', () => {
    const ring = lathe([[0.25, 0.0], [0.6, 0.0], [0.55, 0.25], [0.35, 0.32], [0.25, 0.2]], 16, 8);
    return colored(ring, (p) => C('#5c4d4d').lerp(C('#ff922b'), p.y > 0.25 && Math.hypot(p.x, p.z) < 0.4 ? 0.8 : 0));
  });
}

// ------------------------------------------------------------- lagoon

export function shellGeometry(): THREE.BufferGeometry {
  return cachedGeo('shell', () => {
    const parts: THREE.BufferGeometry[] = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const rib = new THREE.CapsuleGeometry(0.05, 0.32, 3, 6);
      rib.translate(0, 0.16, 0);
      rib.rotateZ(((i / (n - 1)) - 0.5) * 2.2);
      rib.rotateX(-1.25);
      parts.push(rib);
    }
    return colored(merge(parts), (p) => C('#ffc9c9').lerp(C('#fff5f5'), Math.min(1, Math.hypot(p.x, p.z) / 0.4)));
  });
}

export function starfishGeometry(): THREE.BufferGeometry {
  return cachedGeo('starfish', () => {
    const g = extrude(starShape(5, 0.35, 0.13, 0.5), 0.06, 0.04, 6);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.05, 0);
    return colored(g, '#ff8787');
  });
}

export function umbrellaGeometry(): THREE.BufferGeometry {
  return cachedGeo('umbrella', () => {
    const pole = colored(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8).translate(0, 1.1, 0), '#f1f3f5');
    const canopy = new THREE.ConeGeometry(1.3, 0.55, 12, 1, true).translate(0, 2.25, 0);
    const c = colored(canopy, (p) => (Math.floor(((Math.atan2(p.z, p.x) + Math.PI) / TAU) * 12) % 2 ? C('#ff6b6b') : C('#ffffff')));
    return merge([pole, c]);
  });
}

export function beachBallGeometry(): THREE.BufferGeometry {
  return cachedGeo('beachball', () => {
    const g = new THREE.SphereGeometry(0.35, 18, 12);
    g.translate(0, 0.35, 0);
    const cols = ['#ff6b6b', '#ffffff', '#4dabf7', '#ffd43b', '#ffffff', '#51cf66'];
    return colored(g, (p) => C(cols[Math.floor(((Math.atan2(p.z, p.x) + Math.PI) / TAU) * 6) % 6]));
  });
}

// ------------------------------------------------------------- canyon

export function cactusGeometry(seed = 0): THREE.BufferGeometry {
  return cactus(seed);
}


export function bonesGeometry(): THREE.BufferGeometry {
  return cachedGeo('bones', () => {
    const parts: THREE.BufferGeometry[] = [];
    // a friendly rib cage
    for (let i = 0; i < 5; i++) {
      const rib = new THREE.TorusGeometry(0.55 - Math.abs(i - 2) * 0.08, 0.06, 6, 16, Math.PI);
      rib.translate(0, 0, (i - 2) * 0.3);
      parts.push(rib);
    }
    const spine = new THREE.CylinderGeometry(0.07, 0.07, 1.6, 8);
    spine.rotateX(Math.PI / 2);
    spine.translate(0, 0.55, 0);
    parts.push(spine);
    return colored(merge(parts.map((p) => (p.index ? p.toNonIndexed() : p))), '#fff4e0');
  });
}

export function tumbleweedGeometry(): THREE.BufferGeometry {
  return cachedGeo('tumbleweed', () => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const t = new THREE.TorusGeometry(0.35, 0.025, 4, 18);
      t.rotateX(i * 0.7);
      t.rotateY(i * 1.3);
      parts.push(t);
    }
    const g = merge(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
    g.translate(0, 0.36, 0);
    return colored(g, '#c08a4a');
  });
}

export function mesaGeometry(seed = 0): THREE.BufferGeometry {
  return cachedGeo(`mesa-${seed}`, () => {
    const rng = mulberry32(17 + seed);
    const g = lathe(
      [
        [0, 0],
        [4.2, 0],
        [3.9, 1.5],
        [3.5, 3.8],
        [3.3, 5.5],
        [3.0, 5.6],
        [0, 5.7],
      ],
      14,
      14,
    );
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const k = 0.9 + rng() * 0.2;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return colored(g, (q) => C('#d9480f').lerp(C('#ffa94d'), (Math.sin(q.y * 2.4) + 1) * 0.35));
  });
}

// ------------------------------------------------------------- snowy

export function pineGeometry(seed = 0): THREE.BufferGeometry {
  return pine(seed, true);
}


export function snowballsGeometry(): THREE.BufferGeometry {
  return cachedGeo('snowballs', () => {
    const parts: THREE.BufferGeometry[] = [];
    const pts: [number, number, number, number][] = [
      [0, 0.3, 0, 0.32],
      [0.5, 0.22, 0.1, 0.24],
      [0.2, 0.62, 0.05, 0.2],
    ];
    for (const [x, y, z, r] of pts) parts.push(new THREE.SphereGeometry(r, 12, 10).translate(x, y, z));
    return colored(merge(parts), (p) => C('#ffffff').lerp(C('#d0ebff'), Math.max(0, 0.4 - p.y)));
  });
}

export function snowDinoGeometry(): THREE.BufferGeometry {
  return cachedGeo('snowdino', () => {
    const parts: THREE.BufferGeometry[] = [];
    parts.push(colored(new THREE.SphereGeometry(0.55, 16, 12).translate(0, 0.5, 0), '#ffffff'));
    parts.push(colored(new THREE.SphereGeometry(0.4, 16, 12).translate(0, 1.15, 0.1), '#ffffff'));
    parts.push(colored(new THREE.SphereGeometry(0.22, 12, 10).scale(1, 0.8, 1.3).translate(0, 1.15, 0.45), '#ffffff'));
    for (const s of [-1, 1]) parts.push(colored(new THREE.SphereGeometry(0.05, 8, 6).translate(0.15 * s, 1.3, 0.42), '#212529'));
    parts.push(colored(new THREE.ConeGeometry(0.06, 0.25, 8).rotateX(Math.PI / 2).translate(0, 1.18, 0.72), '#ff922b'));
    const scarf = new THREE.TorusGeometry(0.36, 0.08, 8, 20);
    scarf.rotateX(Math.PI / 2);
    scarf.translate(0, 0.86, 0.05);
    parts.push(colored(scarf, '#e03131'));
    for (let i = 0; i < 4; i++) parts.push(colored(new THREE.ConeGeometry(0.1, 0.22, 8).translate(0, 1.5 - i * 0.28, -0.3 - i * 0.08), '#a5d8ff'));
    return merge(parts);
  });
}

export function iceCrystalGeometry(): THREE.BufferGeometry {
  return cachedGeo('ice-crystal', () => {
    const rng = mulberry32(3);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const h = randRange(rng, 0.6, 1.4);
      const c = new THREE.ConeGeometry(0.18, h, 6);
      c.translate(0, h / 2, 0);
      c.rotateZ(randRange(rng, -0.5, 0.5));
      c.rotateX(randRange(rng, -0.5, 0.5));
      c.translate(randRange(rng, -0.25, 0.25), 0, randRange(rng, -0.25, 0.25));
      parts.push(c);
    }
    return colored(merge(parts), (p) => C('#a5d8ff').lerp(C('#ffffff'), Math.min(1, p.y / 1.2)));
  });
}

// ------------------------------------------------------------- crystal

export function crystalGeometry(seed = 0, color = '#b197fc'): THREE.BufferGeometry {
  return cachedGeo(`crystal-${seed}-${color}`, () => {
    const rng = mulberry32(700 + seed);
    const parts: THREE.BufferGeometry[] = [];
    const n = 5 + seed * 2;
    for (let i = 0; i < n; i++) {
      const h = randRange(rng, 0.6, 1.8);
      const r = randRange(rng, 0.12, 0.26);
      const g = new THREE.CylinderGeometry(r * 0.15, r, h, 6, 1);
      g.translate(0, h / 2, 0);
      g.rotateZ(randRange(rng, -0.45, 0.45));
      g.rotateX(randRange(rng, -0.45, 0.45));
      g.rotateY(rng() * TAU);
      g.translate(randRange(rng, -0.3, 0.3), 0, randRange(rng, -0.3, 0.3));
      parts.push(g);
    }
    return colored(merge(parts), (p) => C(color).lerp(C('#ffffff'), Math.min(1, p.y / 1.8) * 0.7));
  });
}

// ------------------------------------------------------------- meadow

export function tulipGeometry(color: string): THREE.BufferGeometry {
  return wildflower(color, '#ffd43b', 5);
}


export function balloonGeometry(color: string): THREE.BufferGeometry {
  return cachedGeo(`balloon-${color}`, () => {
    const b = new THREE.SphereGeometry(0.32, 14, 12);
    b.scale(1, 1.2, 1);
    b.translate(0, 2.2, 0);
    const knot = new THREE.ConeGeometry(0.05, 0.08, 6).rotateX(Math.PI).translate(0, 1.8, 0);
    const string = tube(curveFrom([[0, 1.78, 0], [0.08, 1.2, 0], [-0.05, 0.6, 0], [0, 0, 0]]), { segments: 10, radial: 3, radius: () => 0.008 });
    return merge([colored(b, color), colored(knot, color), colored(string, '#f8f9fa')]);
  });
}

// ------------------------------------------------------------- board bits

export function nestGeometry(): THREE.BufferGeometry {
  return cachedGeo('nest', () => {
    const parts: THREE.BufferGeometry[] = [];
    const rng = mulberry32(8);
    for (let i = 0; i < 40; i++) {
      const a = rng() * TAU;
      const twig = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 5);
      twig.rotateZ(Math.PI / 2 + randRange(rng, -0.3, 0.3));
      twig.translate(0, 0.12 + rng() * 0.22, 0.85);
      twig.rotateY(a);
      parts.push(twig);
    }
    const bowl = lathe([[0, 0.02], [0.6, 0.05], [0.95, 0.25], [1.05, 0.35]], 20, 6);
    parts.push(bowl.toNonIndexed());
    return colored(merge(parts.map((p) => (p.index ? p.toNonIndexed() : p))), (p) => C('#a0703c').lerp(C('#d9a066'), Math.min(1, p.y * 2)));
  });
}
