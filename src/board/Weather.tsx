// The weather on the board, so mornings look different through the year:
// leaves tumbling down in the fall, snow in the winter, blossom petals in the
// spring and butterflies in the summer. On some mornings a rainbow arcs
// across the sky. It's all scenery: nothing to tap.

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { extrude, merge, petalShape } from '../three/geometry';
import { frameDt, hero } from '../game/actors';
import { motion } from '../game/settings';
import { clamp, mulberry32, TAU } from '../three/util';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

/** Time zones in the southern half of the world, where the seasons are the other way round. */
const SOUTHERN = [
  'Australia/',
  'Pacific/Auckland',
  'Pacific/Chatham',
  'America/Argentina',
  'America/Sao_Paulo',
  'America/Santiago',
  'America/Montevideo',
  'America/Asuncion',
  'Africa/Johannesburg',
  'Africa/Maputo',
  'Africa/Windhoek',
  'Africa/Harare',
  'Africa/Lusaka',
  'Indian/Mauritius',
  'Indian/Antananarivo',
];

function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}

/** The season where the player lives (by month, flipped south of the equator). */
export function seasonFor(date: Date, timeZone = localZone()): Season {
  const south = SOUTHERN.some((z) => timeZone.startsWith(z));
  const m = (date.getMonth() + (south ? 6 : 0)) % 12;
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'fall';
  return 'winter';
}

/** For trying the weather out: `?season=winter` or `?rainbow` in the page address. */
function urlParam(name: string): string | null {
  try {
    return new URLSearchParams(location.search).get(name);
  } catch {
    return null;
  }
}

/** Every fourth morning has a rainbow (not in snowy weather). */
export function rainbowDay(date: Date, timeZone = localZone()): boolean {
  const day = Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
  return day % 4 === 1 && seasonFor(date, timeZone) !== 'winter';
}

// ---------------------------------------------------------------- falling and fluttering things

const COUNT: Record<Season, number> = { fall: 60, winter: 170, spring: 70, summer: 9 };
const COLORS: Record<Season, string[]> = {
  fall: ['#f76707', '#e8590c', '#fab005', '#d9480f', '#b5651d'],
  winter: ['#ffffff', '#f1f3f5', '#e7f5ff'],
  spring: ['#ffc9de', '#ffdeeb', '#fff0f6', '#fcc2d7'],
  summer: ['#ffd43b', '#74c0fc', '#ff922b', '#f783ac', '#b197fc'],
};
/** Half the size of the box around Zef's dino that the weather fills. */
const BOX = { x: 9, z: 9, top: 7 };

/** One wing of a butterfly, lying flat, hinged along the body (x = 0). */
function wingGeometry(side: 1 | -1): THREE.BufferGeometry {
  const fore = new THREE.CircleGeometry(0.1, 14);
  fore.scale(1.15, 1, 1);
  fore.translate(0.1, 0.045, 0);
  const hind = new THREE.CircleGeometry(0.065, 12);
  hind.translate(0.065, -0.06, 0);
  const g = merge([fore, hind]);
  g.rotateX(-Math.PI / 2);
  g.scale(side, 1, 1);
  return g;
}

/** What each speck of weather looks like (a butterfly is two wings). */
function partsFor(season: Season): THREE.BufferGeometry[] {
  if (season === 'summer') return [wingGeometry(1), wingGeometry(-1)];
  if (season === 'winter') return [new THREE.IcosahedronGeometry(0.07, 0)];
  const len = season === 'fall' ? 0.25 : 0.16;
  const g = extrude(petalShape(len, len * 0.6), 0.004, 0, 8);
  g.translate(0, -len / 2, 0);
  return [g];
}

interface Mote {
  p: THREE.Vector3;
  fall: number;
  sway: number;
  freq: number;
  phase: number;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  size: number;
  /** butterflies: where they're heading and how high they like to fly */
  heading: number;
  height: number;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const wingQ = new THREE.Quaternion();
const bodyQ = new THREE.Quaternion();
const scl = new THREE.Vector3();
const zAxis = new THREE.Vector3(0, 0, 1);

/** Seasonal weather around Zef's dino, wrapping round as he moves along the board. */
export function Weather() {
  const camera = useThree((s) => s.camera);
  const season = useMemo(() => {
    const forced = urlParam('season');
    return forced === 'spring' || forced === 'summer' || forced === 'fall' || forced === 'winter' ? forced : seasonFor(new Date());
  }, []);
  const n = COUNT[season];
  const parts = useMemo(() => partsFor(season), [season]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide }), []);
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const st = useRef({ t: 0, placed: false });
  const motes = useMemo<Mote[]>(() => {
    const rng = mulberry32(season.length * 97 + 11);
    return Array.from({ length: n }, () => ({
      p: new THREE.Vector3((rng() * 2 - 1) * BOX.x, rng() * BOX.top, (rng() * 2 - 1) * BOX.z),
      fall: season === 'winter' ? 0.45 + rng() * 0.35 : season === 'fall' ? 0.35 + rng() * 0.25 : 0.22 + rng() * 0.18,
      sway: season === 'winter' ? 0.25 : 0.6 + rng() * 0.5,
      freq: 0.6 + rng() * 0.9,
      phase: rng() * TAU,
      rot: new THREE.Euler(rng() * TAU, rng() * TAU, rng() * TAU),
      spin: new THREE.Vector3((rng() - 0.5) * 3, (rng() - 0.5) * 2, (rng() - 0.5) * 3),
      size: season === 'winter' ? 0.6 + rng() * 0.8 : 0.8 + rng() * 0.5,
      heading: rng() * TAU,
      height: 0.7 + rng() * 1.6,
    }));
  }, [season, n]);

  useLayoutEffect(() => {
    const rng = mulberry32(5);
    const palette = COLORS[season].map((c) => new THREE.Color(c));
    const colors = motes.map(() => palette[Math.floor(rng() * palette.length)]);
    for (const mesh of meshes.current) {
      if (!mesh) continue;
      colors.forEach((c, i) => mesh.setColorAt(i, c));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [season, motes]);

  useFrame((_, raw) => {
    const dt = frameDt(raw) * (motion.reduced ? 0.35 : 1);
    const s = st.current;
    s.t += dt;
    const a = hero.pos;
    // the first time, scatter the weather around wherever Zef's dino is
    if (!s.placed && a.lengthSq() > 0) {
      s.placed = true;
      for (const m of motes) m.p.add(a);
    }
    const ground = a.y - 0.3;
    motes.forEach((m, i) => {
      if (season === 'summer') {
        // butterflies wander, bob and turn
        m.heading += Math.sin(s.t * 0.7 + m.phase) * 1.4 * dt;
        m.p.x += Math.sin(m.heading) * 0.75 * dt;
        m.p.z += Math.cos(m.heading) * 0.75 * dt;
        m.p.y = ground + m.height + Math.sin(s.t * 2.2 + m.phase) * 0.25;
      } else {
        m.p.y -= m.fall * dt;
        m.p.x += Math.sin(s.t * m.freq + m.phase) * m.sway * dt;
        m.p.z += Math.cos(s.t * m.freq * 0.7 + m.phase) * m.sway * 0.6 * dt;
        m.rot.x += m.spin.x * dt;
        m.rot.y += m.spin.y * dt;
        m.rot.z += m.spin.z * dt;
        // fallen to the ground: start again at the top
        if (m.p.y < ground) m.p.y += BOX.top + Math.random() * 0.5;
      }
      // keep everything in the box around the dino, wrapping round as it moves on
      const dx = m.p.x - a.x;
      const dz = m.p.z - a.z;
      if (dx > BOX.x) m.p.x -= BOX.x * 2;
      else if (dx < -BOX.x) m.p.x += BOX.x * 2;
      if (dz > BOX.z) m.p.z -= BOX.z * 2;
      else if (dz < -BOX.z) m.p.z += BOX.z * 2;
      if (m.p.y > ground + BOX.top + 1) m.p.y = ground + Math.random() * BOX.top;

      // anything drifting right past the camera fades away instead of filling the screen
      const near = clamp((m.p.distanceTo(camera.position) - 1.8) / 2.2, 0, 1);
      if (season === 'summer') {
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, m.heading);
        const flap = 0.25 + Math.abs(Math.sin(s.t * 13 + m.phase)) * 1.0;
        scl.setScalar(1.6 * near + 0.0001);
        meshes.current.forEach((mesh, k) => {
          if (!mesh) return;
          wingQ.setFromAxisAngle(zAxis, k === 0 ? flap : -flap);
          m4.compose(m.p, bodyQ.copy(q).multiply(wingQ), scl);
          mesh.setMatrixAt(i, m4);
        });
      } else {
        q.setFromEuler(m.rot);
        scl.setScalar(m.size * near + 0.0001);
        m4.compose(m.p, q, scl);
        meshes.current[0]?.setMatrixAt(i, m4);
      }
    });
    for (const mesh of meshes.current) if (mesh) mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      {parts.map((g, k) => (
        <instancedMesh key={`${season}-${k}`} ref={(el) => (meshes.current[k] = el)} args={[g, mat, n]} frustumCulled={false} raycast={() => null} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------- the rainbow

const RAINBOW = ['#b197fc', '#b197fc', '#748ffc', '#4dabf7', '#69db7c', '#ffe066', '#ff9f43', '#ff6b6b', '#ff6b6b'];

/** Seven soft bands, violet inside to red outside, fading out at the edges and at the ends. */
function rainbowGeometry(inner: number, outer: number): THREE.BufferGeometry {
  const rows = RAINBOW.length - 1;
  const g = new THREE.RingGeometry(inner, outer, 96, rows, 0, Math.PI);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 4);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.hypot(x, y);
    const j = clamp(Math.round(((r - inner) / (outer - inner)) * rows), 0, rows);
    c.set(RAINBOW[j]);
    const edge = j === 0 || j === rows ? 0 : 1;
    const ends = clamp(y / r / 0.3, 0, 1);
    col.set([c.r, c.g, c.b, 0.42 * edge * ends], i * 4);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  return g;
}

/** On a rainbow morning, a big soft rainbow far away over the board. */
export function Rainbow() {
  const camera = useThree((s) => s.camera);
  const show = useMemo(() => rainbowDay(new Date()) || urlParam('rainbow') !== null, []);
  const geo = useMemo(() => rainbowGeometry(60, 72), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, toneMapped: false }), []);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(camera.position.x + 25, camera.position.y - 28, camera.position.z - 230);
  });
  if (!show) return null;
  return <mesh ref={ref} geometry={geo} material={mat} renderOrder={-6} frustumCulled={false} raycast={() => null} />;
}
