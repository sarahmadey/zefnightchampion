// The magnificent candy castle on Gumdrop Mountain. Visible from the cottage,
// it grows on screen as Zef approaches. Its towers light their windows in a
// sequence when tapped (stop 14) and its chocolate doors open (stop 15).

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  cachedGeo,
  curveFrom,
  dripsAlong,
  extrude,
  gumdropGeometry,
  heartShape,
  lathe,
  lumpy,
  merge,
  paint,
  roundedBox,
  tube,
  waffleGrid,
} from '../three/geometry';
import { emissive, gloss, jelly, pattern, vcolor } from '../three/materials';
import { sharedTime } from '../three/shaders';
import { Glow } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { CASTLE_BASE_Y } from '../game/route';
import { bus } from '../game/bus';
import { frameDt } from '../game/actors';
import { TAU, clamp, ease, mulberry32, randRange } from '../three/util';
import { motion } from '../game/settings';

export const CASTLE_POS = new THREE.Vector3(0, CASTLE_BASE_Y, -153);

interface Tower {
  x: number;
  z: number;
  r: number;
  h: number;
  base?: number;
  color: string;
  roof: number;
}

export const TOWERS: Tower[] = [
  { x: -2.75, z: 8.75, r: 1.25, h: 8.2, color: '#ffd3e7', roof: 0 },
  { x: 2.75, z: 8.75, r: 1.25, h: 8.2, color: '#ffd3e7', roof: 0 },
  { x: -8.4, z: 8.4, r: 1.6, h: 9.6, color: '#e6d0ff', roof: 1 },
  { x: 8.4, z: 8.4, r: 1.6, h: 9.6, color: '#cdf5e6', roof: 2 },
  { x: -8.4, z: -6.4, r: 1.75, h: 11.6, color: '#fff2b8', roof: 2 },
  { x: 8.4, z: -6.4, r: 1.75, h: 11.6, color: '#ffd3e7', roof: 1 },
  { x: 0, z: -0.5, r: 3.4, h: 13.6, color: '#fff4f9', roof: -1 },
  { x: -3.45, z: 1.0, r: 0.95, h: 16.2, base: 9.2, color: '#e6d0ff', roof: 0 },
  { x: 3.45, z: 1.0, r: 0.95, h: 16.2, base: 9.2, color: '#cdf5e6', roof: 0 },
];

const ROOF_MATS = [
  () => pattern({ a: '#ffffff', b: '#ff5d9e', mode: 'helix', freq: 6, twist: 1.2, roughness: 0.3 }),
  () => pattern({ a: '#ffffff', b: '#9a6bff', mode: 'helix', freq: 6, twist: 1.2, roughness: 0.3 }),
  () => pattern({ a: '#ffffff', b: '#22c3a6', mode: 'helix', freq: 6, twist: 1.2, roughness: 0.3 }),
];

const WALL_H = 5;

function wallsGeometry() {
  return cachedGeo('castle-walls', () => {
    const parts: THREE.BufferGeometry[] = [];
    const piece = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const g = roundedBox(w, h, d, 0.18, 2);
      g.translate(x, y, z);
      parts.push(g);
    };
    // front wall with the gate gap
    piece(5.85, WALL_H, 1.2, -4.625, WALL_H / 2, 8.2);
    piece(5.85, WALL_H, 1.2, 4.625, WALL_H / 2, 8.2);
    // arch over the gate: a block with a semicircular bite out of it
    const arch = new THREE.Shape();
    arch.moveTo(-1.9, 0);
    arch.lineTo(-1.7, 0);
    arch.absarc(0, 0, 1.7, Math.PI, 0, true);
    arch.lineTo(1.9, 0);
    arch.lineTo(1.9, 2.0);
    arch.lineTo(-1.9, 2.0);
    arch.lineTo(-1.9, 0);
    const ag = extrude(arch, 1.2, 0.06, 24);
    ag.translate(0, 3.0, 8.2);
    parts.push(ag);
    // sides and back
    piece(1.2, WALL_H, 14.6, -8.2, WALL_H / 2, 0.9);
    piece(1.2, WALL_H, 14.6, 8.2, WALL_H / 2, 0.9);
    piece(16.4, WALL_H, 1.2, 0, WALL_H / 2, -6.4);
    // rounded merlons along the top
    const merlon = (x: number, z: number, rotY: number) => {
      const g = roundedBox(0.75, 0.7, 1.05, 0.2, 2);
      g.rotateY(rotY);
      g.translate(x, WALL_H + 0.3, z);
      parts.push(g);
    };
    for (let x = -7.2; x <= 7.21; x += 1.2) if (Math.abs(x) > 2.4) merlon(x, 8.2, 0);
    for (let x = -7.2; x <= 7.21; x += 1.2) merlon(x, -6.4, 0);
    for (let z = -5.2; z <= 7.01; z += 1.2) {
      merlon(-8.2, z, Math.PI / 2);
      merlon(8.2, z, Math.PI / 2);
    }
    const g = lumpy(merge(parts), 0.02, 1.5, 3);
    const top = new THREE.Color('#fff0f6');
    const low = new THREE.Color('#ffb3d1');
    paint(g, (p) => new THREE.Color().copy(low).lerp(top, THREE.MathUtils.smoothstep(p.y, 0, WALL_H + 0.5)));
    return g;
  });
}

function towerBodiesGeometry() {
  return cachedGeo('castle-towers', () => {
    const parts: THREE.BufferGeometry[] = [];
    for (const t of TOWERS) {
      const base = t.base ?? 0;
      const h = t.h - base;
      const body = lathe(
        [
          [0, 0],
          [t.r * 1.08, 0],
          [t.r * 1.02, h * 0.08],
          [t.r, h * 0.5],
          [t.r * 1.0, h * 0.92],
          [t.r * 1.14, h * 0.96],
          [t.r * 1.14, h],
          [0, h],
        ],
        28,
        20,
      );
      if (t.base) {
        // corbel cone under a turret that hangs off the keep
        const corbel = lathe(
          [
            [0, -1.6],
            [t.r * 0.3, -1.5],
            [t.r * 0.9, -0.3],
            [t.r * 1.05, 0],
            [0, 0],
          ],
          24,
          12,
        );
        parts.push(paint(corbel.translate(0, 0, 0), t.color));
      }
      paint(body, (p) => {
        const c = new THREE.Color(t.color);
        // a soft lighter frosting band near the top
        if (p.y > h * 0.9) c.lerp(new THREE.Color('#ffffff'), 0.65);
        return c;
      });
      const merged = merge([body, ...(t.base ? [parts.pop()!] : [])]);
      merged.translate(t.x, base, t.z);
      parts.push(merged);
    }
    return merge(parts);
  });
}

function roofGeometry(kind: number) {
  return cachedGeo(`castle-roof-${kind}`, () => {
    const parts: THREE.BufferGeometry[] = [];
    for (const t of TOWERS) {
      if (t.roof !== kind) continue;
      const rh = t.r * 2.9;
      const g = lathe(
        [
          [0, 0],
          [t.r * 1.32, 0],
          [t.r * 1.28, 0.12],
          [t.r * 0.92, rh * 0.32],
          [t.r * 0.45, rh * 0.7],
          [t.r * 0.08, rh * 0.98],
          [0, rh],
        ],
        28,
        22,
      );
      g.translate(t.x, t.h, t.z);
      parts.push(g);
    }
    return merge(parts);
  });
}

function keepRoofGeometry() {
  return cachedGeo('castle-keeproof', () => {
    const t = TOWERS[6];
    const rh = 7.5;
    const g = lathe(
      [
        [0, 0],
        [t.r * 1.3, 0],
        [t.r * 1.22, 0.2],
        [t.r * 0.95, rh * 0.25],
        [t.r * 0.5, rh * 0.62],
        [t.r * 0.12, rh * 0.95],
        [0, rh],
      ],
      72,
      48,
    );
    waffleGrid(g, 0.55, 0.07, '#f2b45a', '#c9822f');
    g.translate(t.x, t.h, t.z);
    return g;
  });
}

function trimGeometry() {
  return cachedGeo('castle-trim', () => {
    const parts: THREE.BufferGeometry[] = [];
    for (const t of TOWERS) {
      const ring = new THREE.TorusGeometry(t.r * 1.2, 0.12, 8, 32);
      ring.rotateX(Math.PI / 2);
      ring.translate(t.x, t.h + 0.08, t.z);
      parts.push(ring);
      // icing drips under the roof
      const n = Math.max(8, Math.round(t.r * 9));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + 0.1;
        const len = 0.25 + ((i * 37) % 7) * 0.05;
        const x = t.x + Math.cos(a) * t.r * 1.16;
        const z = t.z + Math.sin(a) * t.r * 1.16;
        parts.push(
          tube(curveFrom([[x, t.h, z], [x, t.h - len * 0.5, z], [x, t.h - len, z]]), {
            segments: 6,
            radial: 6,
            radius: (u) => 0.08 * (u > 0.75 ? 1 + Math.sin(((u - 0.75) / 0.25) * Math.PI) * 0.3 : 1) * (u > 0.94 ? 0.4 : 1),
          }),
        );
      }
    }
    parts.push(dripsAlong([-7.6, WALL_H - 0.02, 8.85], [-2.2, WALL_H - 0.02, 8.85], 9, 0.5, 0.08, 31));
    parts.push(dripsAlong([2.2, WALL_H - 0.02, 8.85], [7.6, WALL_H - 0.02, 8.85], 9, 0.5, 0.08, 32));
    return paint(merge(parts), '#ffffff');
  });
}

interface WindowSpec {
  tower: number;
  pos: THREE.Vector3;
  rotY: number;
  row: number;
  scale: number;
}

function windowSpecs(): WindowSpec[] {
  const out: WindowSpec[] = [];
  TOWERS.forEach((t, ti) => {
    const base = t.base ?? 0;
    const top = t.h - 1.0;
    const step = ti === 6 ? 1.75 : 1.55;
    const cols = ti === 6 ? [-1.0, -0.5, 0, 0.5, 1.0] : ti >= 7 ? [-0.35, 0.35] : [-0.65, 0, 0.65];
    let row = 0;
    for (let y = base + (ti === 6 ? WALL_H + 0.9 : 1.6); y <= top; y += step) {
      for (const c of cols) {
        // face outward toward the front (+z) of the castle
        const a = c + (ti === 4 || ti === 5 ? (t.x < 0 ? -0.6 : 0.6) : 0);
        const scale = ti === 6 ? 1.25 : ti >= 7 ? 0.8 : 1;
        const rr = t.r + 0.03;
        const pos = new THREE.Vector3(t.x + Math.sin(a) * rr, y, t.z + Math.cos(a) * rr);
        // skip windows hidden behind the curtain wall
        if (y < WALL_H + 0.6 && Math.abs(t.z) < 8 && ti !== 4 && ti !== 5) continue;
        out.push({ tower: ti, pos, rotY: a, row, scale });
      }
      row++;
    }
  });
  return out;
}

function windowGeometry() {
  return cachedGeo('castle-window', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.21, -0.32);
    s.lineTo(0.21, -0.32);
    s.lineTo(0.21, 0.1);
    s.absarc(0, 0.1, 0.21, 0, Math.PI, false);
    s.lineTo(-0.21, -0.32);
    return extrude(s, 0.05, 0.015, 10);
  });
}

function flagsGeometry(cloth: boolean) {
  return cachedGeo(`castle-flags-${cloth}`, () => {
    const parts: THREE.BufferGeometry[] = [];
    const colors = ['#ff4f8a', '#ffd43b', '#7b5cff', '#20c997', '#ff8a3d'];
    TOWERS.forEach((t, i) => {
      const rh = t.roof === -1 ? 7.5 : t.r * 2.9;
      const topY = t.h + rh;
      const pole = new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6);
      pole.translate(t.x, topY + 0.7, t.z);
      paint(pole, '#fff4c2');
      const flag = new THREE.PlaneGeometry(1.1, 0.55, 10, 3);
      // pennant: taper toward the tip
      const pos = flag.getAttribute('position') as THREE.BufferAttribute;
      for (let k = 0; k < pos.count; k++) {
        const x = pos.getX(k) + 0.55;
        const y = pos.getY(k) * (1 - (x / 1.1) * 0.85);
        pos.setXYZ(k, x, y, 0);
      }
      flag.computeVertexNormals();
      flag.translate(t.x + 0.03, topY + 1.2, t.z);
      paint(flag, colors[i % colors.length]);
      parts.push(cloth ? flag : pole);
    });
    return merge(parts);
  });
}

function flagMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.time = sharedTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float time;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float k = uv.x;
          float ph = position.x * 0.7 + position.z * 0.5;
          transformed.z += sin(time * 6.0 - k * 5.0 + ph) * 0.16 * k;
          transformed.y += sin(time * 4.0 - k * 4.0 + ph) * 0.04 * k;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'flag';
  return m;
}

function doorGeometry(side: number) {
  return cachedGeo(`castle-door-${side}`, () => {
    // half of an arched doorway, hinged at its outer edge (x = 0)
    const w = 1.68;
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(w * side, 0);
    s.lineTo(w * side, 4.68);
    s.absarc(w * side, 3.0, 1.68, Math.PI / 2, side > 0 ? Math.PI : 0, side < 0);
    s.lineTo(0, 0);
    const slab = extrude(s, 0.22, 0.04, 20);
    const parts: THREE.BufferGeometry[] = [paint(slab, '#5a2d17')];
    // raised chocolate-bar squares
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 2; col++) {
        const sq = roundedBox(0.62, 0.62, 0.12, 0.08, 2);
        sq.translate(side * (0.45 + col * 0.76), 0.5 + row * 0.78, 0.14);
        parts.push(paint(sq, '#7a4124'));
      }
    }
    return merge(parts);
  });
}

function studGeometry() {
  return cachedGeo('castle-stud', () => new THREE.SphereGeometry(0.07, 10, 8));
}

export interface CastleProps {
  /** windows lit and sparkling (castle earned or arrival in progress) */
  awake: boolean;
  /** towers react to taps (Zef at stop 14) */
  towersActive: boolean;
  /** doors can be opened (Zef at stop 15) */
  doorsActive: boolean;
  onDoorsOpened?: () => void;
  onTowerTap?: () => void;
}

export function Castle({ awake, towersActive, doorsActive, onDoorsOpened, onTowerTap }: CastleProps) {
  const specs = useMemo(() => windowSpecs(), []);
  const winRef = useRef<THREE.InstancedMesh>(null!);
  const doorL = useRef<THREE.Group>(null!);
  const doorR = useRef<THREE.Group>(null!);
  const heart = useRef<THREE.Mesh>(null!);
  const doorGlow = useRef<THREE.Mesh>(null!);
  const flagMat = useMemo(() => flagMaterial(), []);
  const roofMats = useMemo(() => ROOF_MATS.map((f) => f()), []);
  const winMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), []);
  const st = useMemo(
    () => ({
      lit: new Float32Array(specs.length),
      target: new Float32Array(specs.length),
      delay: new Float32Array(specs.length).fill(-1),
      hold: new Float32Array(specs.length),
      wake: 0,
      wakeT: -1,
      doors: 0,
      doorsTarget: 0,
      towersLit: new Set<number>(),
      sparkleT: 0,
      heartPulse: 0,
    }),
    [specs],
  );
  const dark = useMemo(() => new THREE.Color('#4b3a7a'), []);
  const warm = useMemo(() => new THREE.Color('#ffd76e'), []);
  const tmpC = useMemo(() => new THREE.Color(), []);
  const rng = useMemo(() => mulberry32(77), []);
  const faint = useMemo(() => specs.map(() => (rng() < 0.18 ? 0.55 : 0)), [specs, rng]);

  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    specs.forEach((w, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), w.rotY);
      sc.setScalar(w.scale);
      m.compose(w.pos, q, sc);
      winRef.current.setMatrixAt(i, m);
      winRef.current.setColorAt(i, dark);
    });
    winRef.current.instanceMatrix.needsUpdate = true;
    winRef.current.computeBoundingSphere();
  }, [specs, dark]);

  useEffect(() => {
    const off = bus.on('castleWake', () => {
      st.wakeT = 0;
      sfx.play('magic');
    });
    const off2 = bus.on('castleDoorsOpen', (open?: boolean) => {
      if (open === false) {
        st.doorsTarget = 0;
        return;
      }
      if (st.doorsTarget < 0.5) {
        sfx.play('creak');
        sfx.play('fanfare');
      }
      st.doorsTarget = 1;
    });
    return () => {
      off();
      off2();
    };
  }, [st]);

  const lightTower = (ti: number) => {
    const rows = specs.map((w, i) => ({ w, i })).filter(({ w }) => w.tower === ti);
    rows.forEach(({ w, i }) => {
      st.delay[i] = w.row * 0.28;
      st.hold[i] = 9 + w.row * 0.28;
    });
    const maxRow = Math.max(...rows.map((r) => r.w.row));
    for (let r = 0; r <= maxRow; r++) setTimeout(() => sfx.play('chime', r + 2), r * 280);
    st.towersLit.add(ti);
    const t = TOWERS[ti];
    const rh = t.roof === -1 ? 7.5 : t.r * 2.9;
    setTimeout(() => {
      const top = new THREE.Vector3(CASTLE_POS.x + t.x, CASTLE_POS.y + t.h + rh + 1.5, CASTLE_POS.z + t.z);
      burst('sparkle', top, { count: 30, speed: 4, up: 2, life: 1.6, size: 0.3 });
      burst('confetti', top, { count: 24, speed: 3.5, up: 2 });
      sfx.play('firework');
    }, (maxRow + 1) * 280);
    if (st.towersLit.size >= 6) {
      st.heartPulse = 1;
      setTimeout(() => {
        for (let k = 0; k < 4; k++) {
          setTimeout(() => {
            const p = new THREE.Vector3(CASTLE_POS.x + randRange(rng, -8, 8), CASTLE_POS.y + 22 + randRange(rng, 0, 6), CASTLE_POS.z + randRange(rng, -4, 4));
            burst('sparkle', p, { count: 40, speed: 6, up: 1, life: 1.8, size: 0.35, colors: ['#ffd43b', '#ff6b8b', '#74c0fc', '#b197fc'] });
            sfx.play('firework');
          }, k * 450);
        }
      }, 1200);
      st.towersLit.clear();
    }
    onTowerTap?.();
  };

  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const time = state.clock.elapsedTime;
    // castle wake: windows light in a rising wave
    if (st.wakeT >= 0) {
      st.wakeT += dt;
      if (st.wakeT > 6) st.wakeT = -1;
    }
    for (let i = 0; i < specs.length; i++) {
      const w = specs[i];
      if (st.delay[i] >= 0) {
        st.delay[i] -= dt;
        if (st.delay[i] < 0) {
          st.target[i] = 1;
          const wp = w.pos.clone().add(CASTLE_POS);
          if (!motion.reduced && Math.random() < 0.5) burst('sparkle', wp, { count: 3, size: 0.18 });
        }
      }
      if (st.hold[i] > 0) {
        st.hold[i] -= dt;
        if (st.hold[i] <= 0) st.target[i] = 0;
      }
      let want = Math.max(st.target[i], faint[i]);
      if (awake) want = 1;
      if (st.wakeT >= 0) want = Math.max(want, st.wakeT * 3.2 > w.pos.y - 0.5 ? 1 : 0);
      st.lit[i] = THREE.MathUtils.damp(st.lit[i], want, 6, dt);
      const tw = awake ? 0.9 + 0.1 * Math.sin(time * 2 + i * 1.7) : 1;
      tmpC.copy(dark).lerp(warm, st.lit[i] * tw);
      winRef.current.setColorAt(i, tmpC);
    }
    if (winRef.current.instanceColor) winRef.current.instanceColor.needsUpdate = true;

    // doors
    st.doors = THREE.MathUtils.damp(st.doors, st.doorsTarget, 1.6, dt);
    const open = ease.inOutSine(clamp(st.doors, 0, 1));
    doorL.current.rotation.y = open * 1.45;
    doorR.current.rotation.y = -open * 1.45;
    (doorGlow.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + open * 0.65;

    // heart window pulse
    st.heartPulse = Math.max(0, st.heartPulse - dt * 0.25);
    const hp = (awake ? 0.6 : 0.25) + st.heartPulse * 0.8 + Math.sin(time * 2.2) * 0.08;
    heart.current.scale.setScalar(1 + st.heartPulse * 0.15 + Math.sin(time * 2.2) * 0.02);
    (heart.current.material as THREE.MeshStandardMaterial).emissiveIntensity = hp * 1.6;

    // a slow shimmer of sparkles around an awake castle
    if (awake && !motion.reduced) {
      st.sparkleT += dt;
      if (st.sparkleT > 0.35) {
        st.sparkleT = 0;
        const p = new THREE.Vector3(CASTLE_POS.x + randRange(rng, -9, 9), CASTLE_POS.y + randRange(rng, 3, 20), CASTLE_POS.z + randRange(rng, -6, 9));
        burst('sparkle', p, { count: 2, speed: 0.4, up: 0.6, gravity: 0.3, life: 1.6, size: 0.22 });
      }
    }
  });

  const towerTap = (ti: number) => (e: ThreeEvent<PointerEvent>) => {
    if (!towersActive) return;
    e.stopPropagation();
    lightTower(ti);
  };

  const doorTap = (e: ThreeEvent<PointerEvent>) => {
    if (!doorsActive) return;
    e.stopPropagation();
    if (st.doorsTarget < 0.5) {
      st.doorsTarget = 1;
      sfx.play('creak');
      sfx.play('fanfare');
      burst('sparkle', e.point, { count: 24, size: 0.2 });
      onDoorsOpened?.();
    }
  };

  const studs = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const side of [-1, 1]) for (let r = 0; r < 5; r++) out.push([side * 0.08, 0.3 + r * 0.8, 0.26]);
    return out;
  }, []);

  return (
    <group position={CASTLE_POS}>
      <mesh geometry={wallsGeometry()} material={vcolor(0.65, 'castle-walls')} castShadow receiveShadow />
      <mesh geometry={towerBodiesGeometry()} material={vcolor(0.55, 'castle-towers')} castShadow receiveShadow />
      {[0, 1, 2].map((k) => (
        <mesh key={k} geometry={roofGeometry(k)} material={roofMats[k]} castShadow />
      ))}
      <mesh geometry={keepRoofGeometry()} material={vcolor(0.5, 'waffle')} castShadow />
      <mesh geometry={trimGeometry()} material={vcolor(0.4, 'icing')} />
      <mesh geometry={flagsGeometry(false)} material={vcolor(0.5, 'poles')} />
      <mesh geometry={flagsGeometry(true)} material={flagMat} />
      {/* cherry on top */}
      <group position={[0, TOWERS[6].h + 7.5 + 0.4, -0.5]}>
        <mesh material={gloss('#e3123a', 0.12, 1)} castShadow>
          <sphereGeometry args={[0.75, 24, 18]} />
        </mesh>
        <mesh material={gloss('#3b8f3a', 0.4, 0.3)} position={[0.2, 0.9, 0]} rotation={[0, 0, -0.4]}>
          <cylinderGeometry args={[0.05, 0.06, 1.0, 6]} />
        </mesh>
      </group>
      {/* gumdrops on the gate towers */}
      {TOWERS.slice(0, 6).map((t, i) => (
        <mesh key={i} geometry={gumdropGeometry()} material={jelly(['#ff6b8b', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc', '#ffa94d'][i])} position={[t.x, t.h - 0.2, t.z + t.r * 1.1]} scale={0.5} />
      ))}
      <instancedMesh ref={winRef} args={[windowGeometry(), winMat, specs.length]} raycast={() => null} />
      {/* big glowing heart window on the keep */}
      <mesh
        ref={heart}
        geometry={cachedGeo('castle-heart', () => extrude(heartShape(2.2), 0.2, 0.06, 16))}
        material={emissive('#ff7fb0', 0.6)}
        position={[0, 9.4, -0.5 + 3.45]}
        raycast={() => null}
      />
      {awake && <Glow color="#ffb3d1" size={7} opacity={0.35} position={[0, 9.4, 3.6]} />}

      {/* gate: warm light behind chocolate doors */}
      <mesh ref={doorGlow} position={[0, 2.1, 7.7]}>
        <planeGeometry args={[3.4, 4.3]} />
        <meshBasicMaterial color="#ffd27a" transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <group ref={doorL} position={[-1.7, 0, 8.25]}>
        <mesh geometry={doorGeometry(1)} material={vcolor(0.35, 'choc')} castShadow />
        {studs.map((p, i) => (
          <mesh key={i} geometry={studGeometry()} material={gloss('#ffd23f', 0.25, 0.8)} position={[1.6 + p[0], p[1], p[2]]} />
        ))}
      </group>
      <group ref={doorR} position={[1.7, 0, 8.25]}>
        <mesh geometry={doorGeometry(-1)} material={vcolor(0.35, 'choc')} castShadow />
        {studs.map((p, i) => (
          <mesh key={i} geometry={studGeometry()} material={gloss('#ffd23f', 0.25, 0.8)} position={[-1.6 + p[0], p[1], p[2]]} />
        ))}
      </group>
      <mesh visible={false} position={[0, 2, 8.7]} onPointerDown={doorTap}>
        <boxGeometry args={[4.2, 4.6, 1.2]} />
      </mesh>
      {/* invisible tap columns for each tower */}
      {TOWERS.map((t, i) => (
        <mesh key={i} visible={false} position={[t.x, ((t.base ?? 0) + t.h) / 2 + 2, t.z]} onPointerDown={towerTap(i)}>
          <cylinderGeometry args={[t.r * 1.5, t.r * 1.5, t.h - (t.base ?? 0) + 6, 10]} />
        </mesh>
      ))}
    </group>
  );
}

export function closeCastleDoors() {
  bus.emit('castleDoorsOpen', false);
}

export function openCastleDoors() {
  bus.emit('castleDoorsOpen', true);
}
