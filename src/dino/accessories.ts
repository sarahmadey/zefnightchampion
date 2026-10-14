// Silly accessories that hatch from eggs: hats, shades, jerseys, capes,
// sneakers and sports balls. Each is modelled in code for a T. rex-sized
// anchor; the rig's anchors scale them for smaller heads, and a few pieces
// change shape for four-legged dinos (a jersey becomes a sporty blanket).

import * as THREE from 'three';
import { cachedGeo, curveFrom, extrude, lathe, merge, paint, roundedBox, starShape, tube } from '../three/geometry';
import { pattern } from '../three/materials';
import { ACCESSORIES, UNDERPANTS, type Species, type UnderpantsDesign } from '../game/rewards';
import { TAU } from '../three/util';

const cache = new Map<string, THREE.Material>();
function mat(key: string, make: () => THREE.Material): THREE.Material {
  let m = cache.get(key);
  if (!m) {
    m = make();
    m.name = key;
    cache.set(key, m);
  }
  return m;
}
const plastic = (c: string, rough = 0.35) =>
  mat(`acc-p:${c}:${rough}`, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: rough, clearcoat: 0.5, clearcoatRoughness: 0.2 }));
const cloth = (c: string) =>
  mat(`acc-c:${c}`, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.8, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide }));
const gold = () => mat('acc-gold', () => new THREE.MeshPhysicalMaterial({ color: '#ffc63a', metalness: 0.85, roughness: 0.22, clearcoat: 0.6 }));
const silver = () => mat('acc-silver', () => new THREE.MeshPhysicalMaterial({ color: '#d5dbe6', metalness: 0.85, roughness: 0.25 }));
const glass = () =>
  mat('acc-glass', () => new THREE.MeshPhysicalMaterial({ color: '#1c1a3a', roughness: 0.05, clearcoat: 1, metalness: 0.2, transparent: true, opacity: 0.92 }));
const vc = () => mat('acc-vc', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }));

function m(geo: THREE.BufferGeometry, material: THREE.Material, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0], scale: number | [number, number, number] = 1): THREE.Mesh {
  const me = new THREE.Mesh(geo, material);
  me.position.set(...pos);
  me.rotation.set(...rot);
  if (typeof scale === 'number') me.scale.setScalar(scale);
  else me.scale.set(...scale);
  me.castShadow = true;
  return me;
}

const G = {
  sph: () => cachedGeo('a-sph', () => new THREE.SphereGeometry(1, 22, 16)),
  dome: () => cachedGeo('a-dome', () => new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI / 2)),
  cyl: () => cachedGeo('a-cyl', () => new THREE.CylinderGeometry(1, 1, 1, 24)),
  openCyl: () => cachedGeo('a-ocyl', () => new THREE.CylinderGeometry(1, 1, 1, 28, 1, true)),
  cone: () => cachedGeo('a-cone', () => new THREE.ConeGeometry(1, 1, 22).translate(0, 0.5, 0)),
  torus: () => cachedGeo('a-torus', () => new THREE.TorusGeometry(1, 0.25, 10, 32)),
  /** a thin ring that hugs a sphere's surface */
  seam: () => cachedGeo('a-seam', () => new THREE.TorusGeometry(1, 0.035, 6, 56)),
  box: (r = 0.15) => cachedGeo(`a-box-${r}`, () => roundedBox(1, 1, 1, r, 3)),
};

// ------------------------------------------------------------- head

function cap(color: string) {
  const g = new THREE.Group();
  g.add(m(G.dome(), plastic(color), [0, -0.02, 0], [0, 0, 0], [0.2, 0.15, 0.21]));
  const brim = cachedGeo('cap-brim', () => {
    const b = new THREE.CylinderGeometry(0.16, 0.16, 0.014, 28, 1, false, -Math.PI / 2 - 1, 2);
    b.translate(0, 0, 0.0);
    return b;
  });
  g.add(m(brim, plastic(color), [0, -0.01, 0.08], [-0.12, 0, 0], [1, 1, 1.1]));
  g.add(m(G.sph(), plastic('#ffffff'), [0, 0.13, 0], [0, 0, 0], 0.022));
  g.add(m(G.dome(), plastic('#ffffff'), [0, -0.0, 0.135], [Math.PI / 2 - 0.3, 0, 0], [0.06, 0.02, 0.06]));
  g.rotation.x = -0.1;
  return g;
}

function partyHat() {
  const g = new THREE.Group();
  g.add(m(G.cone(), pattern({ a: '#ff5d8f', b: '#ffd43b', mode: 'helix', freq: 1, twist: 18, roughness: 0.4, clearcoat: 0.3 }), [0, -0.02, 0], [0, 0, 0], [0.1, 0.32, 0.1]));
  g.add(m(G.sph(), plastic('#5ce1e6'), [0, 0.31, 0], [0, 0, 0], 0.04));
  g.add(m(G.torus(), plastic('#5ce1e6'), [0, -0.01, 0], [Math.PI / 2, 0, 0], [0.1, 0.1, 0.1]));
  g.rotation.z = 0.18;
  return g;
}

function cowboy() {
  const g = new THREE.Group();
  const brown = cloth('#a0612b');
  const brimGeo = cachedGeo('cowboy-brim', () =>
    lathe(
      [
        [0.0, 0.0],
        [0.14, 0.0],
        [0.24, 0.015],
        [0.3, 0.06],
        [0.31, 0.075],
      ],
      36,
      10,
    ),
  );
  g.add(m(brimGeo, brown, [0, -0.04, 0], [0, 0, 0], [1, 1, 0.9]));
  const crown = cachedGeo('cowboy-crown', () =>
    lathe(
      [
        [0.15, 0],
        [0.15, 0.08],
        [0.13, 0.14],
        [0.06, 0.16],
        [0.0, 0.135],
      ],
      30,
      12,
    ),
  );
  g.add(m(crown, brown, [0, -0.04, 0]));
  g.add(m(G.openCyl(), cloth('#5b3412'), [0, 0.0, 0], [0, 0, 0], [0.153, 0.025, 0.153]));
  return g;
}

function crown() {
  const g = new THREE.Group();
  g.add(m(G.openCyl(), gold(), [0, 0.02, 0], [0, 0, 0], [0.14, 0.07, 0.14]));
  const gems = ['#ff4d6d', '#4dabf7', '#51cf66', '#ffd43b', '#b197fc'];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    g.add(m(G.cone(), gold(), [Math.sin(a) * 0.14, 0.05, Math.cos(a) * 0.14], [0, 0, 0], [0.035, 0.09, 0.035]));
    g.add(m(G.sph(), gold(), [Math.sin(a) * 0.14, 0.145, Math.cos(a) * 0.14], [0, 0, 0], 0.018));
    g.add(m(G.sph(), plastic(gems[i], 0.1), [Math.sin(a) * 0.145, 0.02, Math.cos(a) * 0.145], [0, 0, 0], 0.022));
  }
  g.rotation.z = -0.12;
  return g;
}

function propeller() {
  const g = new THREE.Group();
  g.add(m(G.dome(), pattern({ a: '#ff6b6b', b: '#4dabf7', mode: 'swirl', freq: 6, twist: 0, roughness: 0.6, clearcoat: 0.2 }), [0, -0.03, 0], [0, 0, 0], [0.19, 0.14, 0.19]));
  g.add(m(G.cyl(), plastic('#ffd43b'), [0, 0.13, 0], [0, 0, 0], [0.012, 0.06, 0.012]));
  const spin = new THREE.Group();
  spin.position.y = 0.165;
  spin.userData.spin = 9;
  const blade = cachedGeo('prop-blade', () => roundedBox(0.2, 0.012, 0.05, 0.006, 2));
  spin.add(m(blade, plastic('#51cf66'), [0.1, 0, 0], [0.25, 0, 0]));
  spin.add(m(blade, plastic('#ff922b'), [-0.1, 0, 0], [-0.25, 0, 0]));
  spin.add(m(G.sph(), plastic('#ffd43b'), [0, 0.01, 0], [0, 0, 0], 0.02));
  g.add(spin);
  return g;
}

function sweatband(species: Species) {
  const g = new THREE.Group();
  const band = pattern({ a: '#ffffff', b: '#ff4d6d', mode: 'helix', freq: 0, twist: 60, roughness: 0.8, clearcoat: 0 });
  // the T. rex's long head needs an oval band round the brow
  if (species === 'trex') g.add(m(G.torus(), band, [0, -0.005, 0.0], [Math.PI / 2 - 0.22, 0, 0], [0.158, 0.2, 0.2]));
  else g.add(m(G.torus(), band, [0, -0.1, 0.02], [Math.PI / 2 - 0.2, 0, 0], [0.235, 0.235, 0.22]));
  return g;
}

function pirate() {
  const g = new THREE.Group();
  const black = cloth('#2b2b3a');
  g.add(m(G.dome(), black, [0, -0.02, 0], [0, 0, 0], [0.19, 0.15, 0.19]));
  const wing = cachedGeo('pirate-wing', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.3, 0);
    s.quadraticCurveTo(-0.28, 0.14, 0, 0.2);
    s.quadraticCurveTo(0.28, 0.14, 0.3, 0);
    s.lineTo(-0.3, 0);
    return extrude(s, 0.02, 0.008, 12).translate(0, 0, -0.01);
  });
  g.add(m(wing, black, [0, -0.02, 0.07], [-0.15, 0, 0]));
  g.add(m(wing, black, [0, -0.02, -0.07], [0.15, 0, 0]));
  const skull = new THREE.Group();
  skull.add(m(G.sph(), plastic('#ffffff'), [0, 0, 0], [0, 0, 0], [0.035, 0.032, 0.02]));
  skull.add(m(G.box(0.3), plastic('#ffffff'), [0, -0.035, 0], [0, 0, 0.6], [0.09, 0.012, 0.01]));
  skull.add(m(G.box(0.3), plastic('#ffffff'), [0, -0.035, 0], [0, 0, -0.6], [0.09, 0.012, 0.01]));
  skull.position.set(0, 0.08, 0.1);
  g.add(skull);
  g.add(m(G.openCyl(), gold(), [0, 0.0, 0], [0, 0, 0], [0.192, 0.02, 0.192]));
  return g;
}

function chef() {
  const g = new THREE.Group();
  const white = cloth('#ffffff');
  g.add(m(G.openCyl(), white, [0, 0.03, 0], [0, 0, 0], [0.15, 0.1, 0.15]));
  const puff = cachedGeo('chef-puff', () => {
    const parts: THREE.BufferGeometry[] = [];
    const pts: [number, number, number, number][] = [
      [0, 0.17, 0, 0.13],
      [0.09, 0.15, 0.05, 0.1],
      [-0.09, 0.15, 0.05, 0.1],
      [0.05, 0.16, -0.09, 0.1],
      [-0.06, 0.16, -0.08, 0.1],
    ];
    for (const [x, y, z, r] of pts) parts.push(new THREE.SphereGeometry(r, 16, 12).translate(x, y, z));
    return merge(parts);
  });
  g.add(m(puff, white));
  return g;
}

function viking() {
  const g = new THREE.Group();
  g.add(m(G.dome(), silver(), [0, -0.03, 0], [0, 0, 0], [0.2, 0.17, 0.2]));
  g.add(m(G.openCyl(), gold(), [0, -0.01, 0], [0, 0, 0], [0.203, 0.03, 0.203]));
  const horn = cachedGeo('viking-horn', () =>
    tube(curveFrom([[0, 0, 0], [0.08, 0.04, 0], [0.13, 0.12, 0], [0.13, 0.22, 0]]), { segments: 16, radial: 10, radius: (t) => 0.04 * (1 - t) + 0.004 }),
  );
  for (const s of [-1, 1]) {
    const h = m(horn, plastic('#fff1cf'), [0.17 * s, 0.05, 0], [0, 0, 0], [s, 1, 1]);
    g.add(h);
  }
  return g;
}

function wizard() {
  const g = new THREE.Group();
  const blue = cloth('#3b4cca');
  g.add(m(G.cyl(), blue, [0, -0.02, 0], [0, 0, 0], [0.27, 0.012, 0.27]));
  const hat = cachedGeo('wizard-cone', () => {
    const c = new THREE.ConeGeometry(0.15, 0.42, 24, 8, true).translate(0, 0.21, 0);
    // bend the tip
    const p = c.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = Math.pow(Math.max(0, y - 0.15) / 0.27, 2);
      p.setZ(i, p.getZ(i) - k * 0.12);
    }
    c.computeVertexNormals();
    return c;
  });
  g.add(m(hat, blue));
  const star = cachedGeo('wizard-star', () => extrude(starShape(5, 0.04, 0.018, 0.2), 0.01, 0.004, 4));
  [
    [0.05, 0.1, 0.11],
    [-0.06, 0.17, 0.09],
    [0.02, 0.27, 0.06],
  ].forEach(([x, y, z]) => g.add(m(star, gold(), [x, y, z], [-0.3, 0, 0])));
  return g;
}

// ------------------------------------------------------------- face

function shades() {
  const g = new THREE.Group();
  const lens = cachedGeo('shades-lens', () => roundedBox(0.12, 0.085, 0.02, 0.03, 3));
  for (const s of [-1, 1]) g.add(m(lens, glass(), [0.085 * s, 0, 0.0], [0, s * 0.25, 0]));
  g.add(m(G.box(0.3), plastic('#1c1a3a'), [0, 0.02, -0.005], [0, 0, 0], [0.06, 0.015, 0.015]));
  const temple = cachedGeo('shades-temple', () => roundedBox(0.012, 0.012, 0.16, 0.005, 2));
  for (const s of [-1, 1]) g.add(m(temple, plastic('#1c1a3a'), [0.15 * s, 0.015, -0.08], [0, s * 0.35, 0]));
  return g;
}

function goggles() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    g.add(m(G.torus(), plastic('#ff922b'), [0.085 * s, 0, 0.0], [0, s * 0.25, 0], [0.055, 0.055, 0.06]));
    g.add(m(G.sph(), mat('acc-goggle-lens', () => new THREE.MeshPhysicalMaterial({ color: '#7fd8ff', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.6 })), [0.085 * s, 0, -0.005], [0, 0, 0], [0.05, 0.05, 0.02]));
  }
  g.add(m(G.torus(), plastic('#5f3dc4', 0.7), [0, 0.01, -0.17], [Math.PI / 2, 0, 0], [0.2, 0.23, 0.1]));
  return g;
}

// ------------------------------------------------------------- neck

function bowtie() {
  const g = new THREE.Group();
  const wing = cachedGeo('bow-wing', () => new THREE.ConeGeometry(0.06, 0.1, 4).rotateZ(Math.PI / 2).translate(0.05, 0, 0));
  const red = pattern({ a: '#e63946', b: '#ffffff', mode: 'uv', freq: 6, twist: 6, roughness: 0.5, clearcoat: 0.3, duty: 0.75 });
  g.add(m(wing, red, [0.01, 0, 0], [0, 0, 0], [1, 1, 0.5]));
  g.add(m(wing, red, [-0.01, 0, 0], [0, 0, Math.PI], [1, 1, 0.5]));
  g.add(m(G.sph(), plastic('#c1121f'), [0, 0, 0.01], [0, 0, 0], [0.028, 0.03, 0.022]));
  return g;
}

function medal() {
  const g = new THREE.Group();
  const ribbon = cachedGeo('medal-ribbon', () => roundedBox(0.035, 0.2, 0.01, 0.004, 2));
  g.add(m(ribbon, cloth('#3a86ff'), [0.035, 0.0, 0], [0, 0, 0.35]));
  g.add(m(ribbon, cloth('#ff006e'), [-0.035, 0.0, 0], [0, 0, -0.35]));
  g.add(m(G.cyl(), gold(), [0, -0.12, 0.01], [Math.PI / 2, 0, 0], [0.06, 0.018, 0.06]));
  const star = cachedGeo('medal-star', () => extrude(starShape(5, 0.035, 0.016, 0.2), 0.008, 0.003, 4));
  g.add(m(star, plastic('#fff3bf'), [0, -0.12, 0.022]));
  return g;
}

function scarf() {
  const g = new THREE.Group();
  const knit = pattern({ a: '#ff6b6b', b: '#ffffff', mode: 'helix', freq: 0, twist: 40, roughness: 0.9, clearcoat: 0 });
  g.add(m(G.torus(), knit, [0, -0.02, -0.12], [Math.PI / 2 - 0.25, 0, 0], [0.19, 0.17, 0.3]));
  g.add(m(G.box(0.4), knit, [0.07, -0.1, 0.02], [0.2, 0, 0.15], [0.07, 0.17, 0.035]));
  return g;
}

// ------------------------------------------------------------- body

function jersey(species: Species) {
  const g = new THREE.Group();
  const shirt = cloth('#7b2cbf');
  const trim = cloth('#ffd43b');
  if (species === 'trex') {
    const body = cachedGeo('jersey-trex', () =>
      lathe(
        [
          [0.255, -0.17],
          [0.29, -0.05],
          [0.295, 0.06],
          [0.25, 0.16],
          [0.17, 0.21],
        ],
        32,
        10,
      ),
    );
    g.add(m(body, shirt, [0, 0, 0], [0, 0, 0], [1.02, 1, 1.02]));
    g.add(m(G.torus(), trim, [0, 0.205, 0], [Math.PI / 2, 0, 0], [0.165, 0.165, 0.06]));
    const num = cachedGeo('jersey-1', () => roundedBox(0.05, 0.17, 0.02, 0.01, 2));
    g.add(m(num, trim, [0, 0.03, 0.295]));
    g.add(m(cachedGeo('jersey-1b', () => roundedBox(0.06, 0.03, 0.02, 0.01, 2)), trim, [-0.025, 0.1, 0.29], [0, 0, 0.6]));
  } else {
    const blanket = cachedGeo('jersey-quad', () => {
      // an arc of cloth draped over the back (the arc starts on -x, so turning
      // the cylinder onto its side the other way puts it on top)
      const c = new THREE.CylinderGeometry(0.36, 0.36, 0.5, 28, 1, true, -Math.PI / 2 - 1.1, 2.2);
      c.rotateZ(-Math.PI / 2);
      c.rotateY(Math.PI / 2);
      return c;
    });
    g.add(m(blanket, shirt, [0, 0.02, 0], [0, 0, 0]));
    for (const s of [-1, 1]) {
      g.add(m(cachedGeo('jersey-q1', () => roundedBox(0.02, 0.15, 0.045, 0.01, 2)), trim, [0.3 * s, 0.16, 0], [0, 0, -s * 0.85]));
    }
  }
  return g;
}

function cape(species: Species) {
  const g = new THREE.Group();
  const geo = cachedGeo('cape', () => {
    const p = new THREE.PlaneGeometry(0.42, 0.5, 6, 8);
    p.translate(0, -0.25, 0);
    const pos = p.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setX(i, x * (1 + -y * 0.6));
      pos.setZ(i, -Math.pow(x / 0.3, 2) * 0.04);
    }
    p.computeVertexNormals();
    return p;
  });
  const sway = new THREE.Group();
  sway.userData.sway = 1;
  sway.add(m(geo, cloth('#e63946')));
  const star = cachedGeo('cape-star', () => extrude(starShape(5, 0.07, 0.032, 0.2), 0.008, 0.003, 4));
  sway.add(m(star, gold(), [0, -0.2, -0.012], [0, Math.PI, 0]));
  if (species === 'trex') {
    // from the top of the back, lying along it
    sway.position.set(0, 0.21, -0.2);
    sway.rotation.x = 0.62;
  } else {
    sway.position.set(0, 0.25, 0.2);
    sway.rotation.x = 1.25;
  }
  g.add(sway);
  return g;
}

function tutu() {
  const g = new THREE.Group();
  const ruffle = cachedGeo('tutu', () => {
    const parts: THREE.BufferGeometry[] = [];
    for (let ring = 0; ring < 2; ring++) {
      const n = 18;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + ring * 0.17;
        const c = new THREE.ConeGeometry(0.06, 0.16, 5, 1, true);
        c.rotateZ(Math.PI / 2 + 0.5);
        c.translate(0.32 + ring * 0.03, -ring * 0.03, 0);
        c.rotateY(a);
        parts.push(c);
      }
    }
    return merge(parts);
  });
  g.add(m(ruffle, cloth('#ff8fc7')));
  g.add(m(G.torus(), cloth('#ffd6ec'), [0, 0.02, 0], [Math.PI / 2, 0, 0], [0.28, 0.28, 0.14]));
  return g;
}

// ------------------------------------------------------------- feet

function sneaker() {
  const g = new THREE.Group();
  g.add(m(G.box(0.4), plastic('#ffffff', 0.5), [0, -0.022, 0.035], [0, 0, 0], [0.19, 0.035, 0.27]));
  g.add(m(G.box(0.45), plastic('#ff4d6d'), [0, 0.02, 0.03], [0, 0, 0], [0.18, 0.08, 0.25]));
  for (let i = 0; i < 3; i++) g.add(m(G.box(0.4), plastic('#ffffff', 0.5), [0, 0.06, 0.08 - i * 0.04], [0, 0, 0], [0.09, 0.012, 0.012]));
  return g;
}

function boots() {
  const g = new THREE.Group();
  const yellow = plastic('#ffd43b', 0.25);
  g.add(m(G.box(0.45), yellow, [0, 0.0, 0.035], [0, 0, 0], [0.19, 0.08, 0.27]));
  g.add(m(G.cyl(), yellow, [0, 0.08, -0.01], [0, 0, 0], [0.085, 0.14, 0.085]));
  g.add(m(G.torus(), plastic('#ff922b'), [0, 0.15, -0.01], [Math.PI / 2, 0, 0], [0.085, 0.085, 0.06]));
  return g;
}

// ------------------------------------------------------------- props

function soccerBall() {
  const geo = cachedGeo('soccer', () => {
    // fine enough to stay round when it's shown big out of the egg
    const g = new THREE.IcosahedronGeometry(1, 3);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    // the 12 icosahedron corners become black pentagon-ish patches
    const ico = new THREE.IcosahedronGeometry(1, 0).getAttribute('position') as THREE.BufferAttribute;
    const corners: THREE.Vector3[] = [];
    for (let i = 0; i < ico.count; i++) corners.push(new THREE.Vector3().fromBufferAttribute(ico, i).normalize());
    for (let f = 0; f < pos.count / 3; f++) {
      a.set(0, 0, 0);
      for (let k = 0; k < 3; k++) a.add(b.fromBufferAttribute(pos, f * 3 + k));
      a.normalize();
      const dark = corners.some((c) => c.dot(a) > 0.93);
      const c = dark ? 0.08 : 0.97;
      for (let k = 0; k < 3; k++) colors.set([c, c, c], (f * 3 + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // round it out, with smooth sphere normals (the patches keep crisp edges)
    const nrm = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      a.fromBufferAttribute(pos, i).normalize();
      pos.setXYZ(i, a.x, a.y, a.z);
      nrm.set([a.x, a.y, a.z], i * 3);
    }
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    return g;
  });
  const g = new THREE.Group();
  g.add(m(geo, vc(), [0, 0, 0], [0, 0, 0], 0.11));
  return g;
}

function basketball() {
  const g = new THREE.Group();
  g.add(m(G.sph(), plastic('#f76707', 0.7), [0, 0, 0], [0, 0, 0], 0.11));
  const seam = plastic('#2b1b0e', 0.6);
  g.add(m(G.seam(), seam, [0, 0, 0], [0, 0, 0], 0.1105));
  g.add(m(G.seam(), seam, [0, 0, 0], [0, Math.PI / 2, 0], 0.1105));
  g.add(m(G.seam(), seam, [0, 0, 0], [Math.PI / 2, 0, 0], 0.1105));
  return g;
}

function football() {
  const g = new THREE.Group();
  g.add(m(G.sph(), plastic('#8b4513', 0.6), [0, 0, 0], [0, 0, 0], [0.085, 0.085, 0.14]));
  g.add(m(G.box(0.3), plastic('#ffffff', 0.6), [0, 0.083, 0], [0, 0, 0], [0.012, 0.01, 0.08]));
  for (let i = 0; i < 4; i++) g.add(m(G.box(0.3), plastic('#ffffff', 0.6), [0, 0.085, -0.03 + i * 0.02], [0, 0, 0], [0.035, 0.008, 0.008]));
  return g;
}

function trophy() {
  const g = new THREE.Group();
  const cup = cachedGeo('trophy-cup', () =>
    lathe(
      [
        [0.0, 0.0],
        [0.07, 0.0],
        [0.07, 0.025],
        [0.02, 0.04],
        [0.018, 0.09],
        [0.05, 0.11],
        [0.09, 0.16],
        [0.095, 0.24],
        [0.085, 0.245],
      ],
      28,
      18,
    ),
  );
  g.add(m(cup, gold(), [0, -0.11, 0]));
  for (const s of [-1, 1]) g.add(m(G.torus(), gold(), [0.095 * s, 0.07, 0], [0, 0, 0], [0.04, 0.045, 0.06]));
  return g;
}

// ------------------------------------------------------------- build

export function buildAccessory(index: number, species: Species): THREE.Group {
  const a = ACCESSORIES[index];
  let g: THREE.Group;
  switch (a.id) {
    case 'cap':
      g = cap('#e63946');
      break;
    case 'shades':
      g = shades();
      break;
    case 'soccer':
      g = soccerBall();
      break;
    case 'jersey':
      g = jersey(species);
      break;
    case 'party':
      g = partyHat();
      break;
    case 'bowtie':
      g = bowtie();
      break;
    case 'cowboy':
      g = cowboy();
      break;
    case 'cape':
      g = cape(species);
      break;
    case 'crown':
      g = crown();
      break;
    case 'basketball':
      g = basketball();
      break;
    case 'propeller':
      g = propeller();
      break;
    case 'medal':
      g = medal();
      break;
    case 'sneakers':
      g = sneaker();
      break;
    case 'sweatband':
      g = sweatband(species);
      break;
    case 'football':
      g = football();
      break;
    case 'pirate':
      g = pirate();
      break;
    case 'scarf':
      g = scarf();
      break;
    case 'tutu':
      g = tutu();
      break;
    case 'chef':
      g = chef();
      break;
    case 'viking':
      g = viking();
      break;
    case 'trophy':
      g = trophy();
      break;
    case 'wizard':
      g = wizard();
      break;
    case 'boots':
      g = boots();
      break;
    case 'goggles':
      g = goggles();
      break;
    default:
      g = new THREE.Group();
  }
  g.name = `acc-${a.id}`;
  return g;
}

/** Feet accessories need a scale per species (T. rex feet are long and flat). */
export function footScale(species: Species): number {
  return species === 'trex' ? 0.85 : species === 'stego' ? 0.92 : 0.95;
}

/** A coach's cap for Coach Rex. */
export function coachCap(): THREE.Group {
  const g = cap('#1d6fd8');
  return g;
}

// ------------------------------------------------------------ underpants

/** Big silly underpants in one of the store designs (also used on the store's roof sign). */
export function buildUnderpants(design: UnderpantsDesign): THREE.Group {
  const g = new THREE.Group();
  const shape = cachedGeo('undies', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0.42);
    s.lineTo(0.5, 0.42);
    s.quadraticCurveTo(0.56, 0.1, 0.48, -0.22);
    s.quadraticCurveTo(0.3, -0.3, 0.14, -0.12);
    s.quadraticCurveTo(0, -0.24, -0.14, -0.12);
    s.quadraticCurveTo(-0.3, -0.3, -0.48, -0.22);
    s.quadraticCurveTo(-0.56, 0.1, -0.5, 0.42);
    const e = extrude(s, 0.16, 0.06, 18);
    e.translate(0, 0, -0.08);
    return e;
  });
  const base = mat(`undies:${design.id}`, () => new THREE.MeshPhysicalMaterial({ color: design.base, roughness: 0.75, sheen: 0.8, sheenColor: new THREE.Color('#ffffff') }));
  g.add(m(shape, base));
  const band = cachedGeo('undies-band', () => roundedBox(1.08, 0.12, 0.3, 0.05, 3));
  g.add(m(band, mat('undies-band', () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.6, sheen: 0.5 })), [0, 0.42, 0]));
  const accent = plastic(design.accent, 0.5);
  const front = 0.15;
  const deco = new THREE.Group();
  switch (design.motif) {
    case 'spots':
      [
        [-0.25, 0.15, 0.09],
        [0.2, 0.22, 0.07],
        [0.05, -0.0, 0.08],
        [-0.33, -0.1, 0.06],
        [0.33, -0.08, 0.06],
      ].forEach(([x, y, r]) => deco.add(m(G.sph(), accent, [x, y, front], [0, 0, 0], [r, r, 0.02])));
      break;
    case 'bolts': {
      const bolt = cachedGeo('bolt', () => {
        const s = new THREE.Shape();
        s.moveTo(0.02, 0.16);
        s.lineTo(-0.08, -0.01);
        s.lineTo(0.0, -0.01);
        s.lineTo(-0.04, -0.17);
        s.lineTo(0.09, 0.03);
        s.lineTo(0.01, 0.03);
        s.lineTo(0.06, 0.16);
        return extrude(s, 0.02, 0.005, 2);
      });
      deco.add(m(bolt, accent, [-0.22, 0.12, front]));
      deco.add(m(bolt, accent, [0.24, 0.1, front], [0, 0, 0.2], 0.8));
      break;
    }
    case 'stripes':
      ['#ff922b', '#ffd43b', '#51cf66', '#4dabf7', '#9b5de5'].forEach((c, i) =>
        deco.add(m(G.box(0.2), plastic(c, 0.6), [0, 0.28 - i * 0.1, front - 0.005], [0, 0, 0], [0.98 - Math.max(0, i - 2) * 0.12, 0.06, 0.02])),
      );
      break;
    case 'flames': {
      const flame = cachedGeo('flame', () => {
        const s = new THREE.Shape();
        s.moveTo(-0.08, 0);
        s.quadraticCurveTo(-0.1, 0.12, 0, 0.22);
        s.quadraticCurveTo(0.02, 0.1, 0.05, 0.12);
        s.quadraticCurveTo(0.1, 0.06, 0.08, 0);
        s.quadraticCurveTo(0, -0.04, -0.08, 0);
        return extrude(s, 0.02, 0.005, 6);
      });
      [-0.3, -0.1, 0.1, 0.3].forEach((x, i) => deco.add(m(flame, accent, [x, -0.05 + (i % 2) * 0.06, front], [0, 0, 0], 0.9 + (i % 2) * 0.2)));
      break;
    }
    case 'stars': {
      const star = cachedGeo('undies-star', () => extrude(starShape(5, 0.07, 0.03, 0.2), 0.015, 0.004, 4));
      [
        [-0.25, 0.18],
        [0.22, 0.24],
        [0.02, 0.02],
        [-0.3, -0.12],
        [0.3, -0.1],
      ].forEach(([x, y]) => deco.add(m(star, accent, [x, y, front])));
      break;
    }
    case 'dots':
      for (let i = 0; i < 9; i++) {
        const x = -0.36 + (i % 3) * 0.36 + (Math.floor(i / 3) % 2) * 0.12;
        const y = 0.26 - Math.floor(i / 3) * 0.17;
        deco.add(m(G.sph(), accent, [x, y, front], [0, 0, 0], [0.045, 0.045, 0.015]));
      }
      break;
  }
  g.add(deco);
  // the back gets the same pattern
  const back = deco.clone();
  back.rotation.y = Math.PI;
  g.add(back);
  return g;
}

/** Underpants as worn: a snug band round the hips with a white waistband and the design's pattern. */
export function buildWornUnderpants(design: UnderpantsDesign, species: Species): THREE.Group {
  const g = new THREE.Group();
  const base = mat(`worn:${design.id}`, () => new THREE.MeshPhysicalMaterial({ color: design.base, roughness: 0.7, sheen: 0.8, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide }));
  const band = mat('worn-band', () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.6, sheen: 0.5 }));
  const accent = plastic(design.accent, 0.5);
  const shell = cachedGeo('worn-shell', () => {
    const c = new THREE.CylinderGeometry(1, 0.92, 1, 40, 4, true);
    // dip the leg openings at the sides
    const p = c.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < -0.4) {
        const a = Math.atan2(p.getZ(i), p.getX(i));
        p.setY(i, y + Math.pow(Math.abs(Math.cos(a)), 3) * 0.45);
      }
    }
    c.computeVertexNormals();
    return c;
  });
  const quad = species !== 'trex';
  const holder = new THREE.Group();
  holder.add(m(shell, base, [0, 0, 0], [0, 0, 0], [1, 1, 1]));
  // a slim rolled edge that hugs the shell (radius 1 at the top, 0.92 at the legs)
  const roll = cachedGeo('worn-roll', () => new THREE.TorusGeometry(1, 0.06, 8, 40));
  const rim = (y: number) => 0.96 + 0.08 * y;
  holder.add(m(roll, band, [0, 0.5, 0], [Math.PI / 2, 0, 0], [1, 1, 1.5]));
  // the pattern on the front and back
  const n = design.motif === 'stripes' ? 0 : 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const piece = design.motif === 'stars' || design.motif === 'bolts' || design.motif === 'flames'
      ? m(cachedGeo('worn-star', () => extrude(starShape(5, 0.16, 0.07, 0.2), 0.04, 0.01, 4)), accent)
      : m(G.sph(), accent, [0, 0, 0], [0, 0, 0], [0.13, 0.13, 0.04]);
    piece.position.set(Math.cos(a) * 0.985, -0.08 + (i % 2) * 0.18, Math.sin(a) * 0.985);
    piece.lookAt(Math.cos(a) * 3, piece.position.y, Math.sin(a) * 3);
    holder.add(piece);
  }
  if (design.motif === 'stripes') {
    ['#ff922b', '#ffd43b', '#51cf66', '#4dabf7'].forEach((c, i) => {
      const y = 0.28 - i * 0.18;
      holder.add(m(roll, plastic(c, 0.6), [0, y, 0], [Math.PI / 2, 0, 0], [rim(y), rim(y), 1.4]));
    });
  }
  if (quad) {
    // round the back of a four-legged dino, axis along the body
    holder.rotation.x = Math.PI / 2;
    holder.scale.set(0.37, 0.24, 0.33);
  } else {
    holder.scale.set(0.31, 0.2, 0.3);
  }
  g.add(holder);
  return g;
}

export function underpantsDesign(i: number): UnderpantsDesign {
  return UNDERPANTS[((i % UNDERPANTS.length) + UNDERPANTS.length) % UNDERPANTS.length];
}

/** Paint helper re-exported for scene code that wants vertex-coloured props. */
export { paint };
