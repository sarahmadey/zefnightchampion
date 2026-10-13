// Pooled, instanced particles for every little burst of joy: sparkles,
// hearts, candy confetti, cloud puffs, droplets, music notes and bubbles.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cachedGeo, heartGeometry, noteGeometry, puffGeometry, starGeometry } from './geometry';
import { makeBubbleMaterial } from './shaders';
import { motion } from '../game/settings';
import { frameDt } from '../game/actors';

export type ParticleKind = 'sparkle' | 'heart' | 'confetti' | 'puff' | 'drop' | 'note' | 'bubble';

export interface BurstOpts {
  count?: number;
  colors?: THREE.ColorRepresentation[];
  speed?: number;
  spread?: number;
  /** extra upward velocity */
  up?: number;
  gravity?: number;
  life?: number;
  size?: number;
  drag?: number;
  /** initial velocity direction bias */
  dir?: THREE.Vector3;
  /** random start offset radius */
  radius?: number;
}

const CAP: Record<ParticleKind, number> = {
  sparkle: 260,
  heart: 60,
  confetti: 240,
  puff: 90,
  drop: 160,
  note: 40,
  bubble: 80,
};

interface Pool {
  n: number;
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  max: Float32Array;
  size: Float32Array;
  rot: Float32Array;
  spin: Float32Array;
  grav: Float32Array;
  drag: Float32Array;
  color: THREE.Color[];
}

function makePool(cap: number): Pool {
  return {
    n: 0,
    pos: new Float32Array(cap * 3),
    vel: new Float32Array(cap * 3),
    life: new Float32Array(cap),
    max: new Float32Array(cap),
    size: new Float32Array(cap),
    rot: new Float32Array(cap * 3),
    spin: new Float32Array(cap * 3),
    grav: new Float32Array(cap),
    drag: new Float32Array(cap),
    color: Array.from({ length: cap }, () => new THREE.Color()),
  };
}

const pools: Record<ParticleKind, Pool> = {
  sparkle: makePool(CAP.sparkle),
  heart: makePool(CAP.heart),
  confetti: makePool(CAP.confetti),
  puff: makePool(CAP.puff),
  drop: makePool(CAP.drop),
  note: makePool(CAP.note),
  bubble: makePool(CAP.bubble),
};

const DEFAULTS: Record<ParticleKind, Required<Omit<BurstOpts, 'dir'>>> = {
  sparkle: { count: 14, colors: ['#fff6a8', '#ffffff', '#ffd1f0', '#a8f0ff'], speed: 2.2, spread: 1, up: 1.2, gravity: -1.5, life: 1.0, size: 0.12, drag: 1.6, radius: 0.1 },
  heart: { count: 6, colors: ['#ff6fa5', '#ff9cc4', '#ff4f8a'], speed: 0.6, spread: 0.6, up: 1.2, gravity: 0.25, life: 1.8, size: 0.13, drag: 1.2, radius: 0.15 },
  confetti: { count: 30, colors: ['#ff6b8b', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc', '#ffa94d'], speed: 3.2, spread: 1, up: 3, gravity: -5, life: 2.2, size: 0.07, drag: 1.2, radius: 0.2 },
  puff: { count: 6, colors: ['#ffffff', '#fff0f7'], speed: 0.8, spread: 1, up: 0.5, gravity: 0.2, life: 1.2, size: 0.25, drag: 2, radius: 0.15 },
  drop: { count: 12, colors: ['#d7143a'], speed: 2.4, spread: 1, up: 2.2, gravity: -9, life: 1.0, size: 0.06, drag: 0.6, radius: 0.1 },
  note: { count: 3, colors: ['#7c4dff', '#ff4f8a', '#2b8cff', '#ff9f1c'], speed: 0.5, spread: 0.6, up: 1.1, gravity: 0.2, life: 2.0, size: 0.16, drag: 1.0, radius: 0.2 },
  bubble: { count: 8, colors: ['#ffffff'], speed: 0.6, spread: 1, up: 1.2, gravity: 0.3, life: 2.4, size: 0.12, drag: 1.2, radius: 0.3 },
};

const tmpC = new THREE.Color();

export function burst(kind: ParticleKind, at: THREE.Vector3, opts: BurstOpts = {}) {
  const d = DEFAULTS[kind];
  const pool = pools[kind];
  const cap = CAP[kind];
  const reduced = motion.reduced;
  const count = Math.max(1, Math.round((opts.count ?? d.count) * (reduced ? 0.4 : 1)));
  const colors = opts.colors ?? d.colors;
  const speed = (opts.speed ?? d.speed) * (reduced ? 0.6 : 1);
  const spread = opts.spread ?? d.spread;
  const up = (opts.up ?? d.up) * (reduced ? 0.6 : 1);
  const life = opts.life ?? d.life;
  const size = opts.size ?? d.size;
  const radius = opts.radius ?? d.radius;
  for (let k = 0; k < count; k++) {
    let i = pool.n;
    if (i >= cap) {
      // recycle the oldest-ish slot
      i = Math.floor(Math.random() * cap);
    } else pool.n++;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const sx = Math.sin(ph) * Math.cos(th);
    const sy = Math.cos(ph);
    const sz = Math.sin(ph) * Math.sin(th);
    const v = speed * (0.4 + Math.random() * 0.6);
    pool.pos[i * 3] = at.x + sx * radius;
    pool.pos[i * 3 + 1] = at.y + Math.abs(sy) * radius;
    pool.pos[i * 3 + 2] = at.z + sz * radius;
    let vx = sx * v * spread;
    let vy = Math.abs(sy) * v * spread * 0.5 + up * (0.6 + Math.random() * 0.6);
    let vz = sz * v * spread;
    if (opts.dir) {
      vx += opts.dir.x * speed;
      vy += opts.dir.y * speed;
      vz += opts.dir.z * speed;
    }
    pool.vel[i * 3] = vx;
    pool.vel[i * 3 + 1] = vy;
    pool.vel[i * 3 + 2] = vz;
    pool.life[i] = 0;
    pool.max[i] = life * (0.75 + Math.random() * 0.5);
    pool.size[i] = size * (0.7 + Math.random() * 0.6);
    pool.rot[i * 3] = Math.random() * 6.28;
    pool.rot[i * 3 + 1] = Math.random() * 6.28;
    pool.rot[i * 3 + 2] = Math.random() * 6.28;
    const sp = kind === 'confetti' ? 9 : kind === 'sparkle' ? 4 : 1.5;
    pool.spin[i * 3] = (Math.random() - 0.5) * sp;
    pool.spin[i * 3 + 1] = (Math.random() - 0.5) * sp;
    pool.spin[i * 3 + 2] = (Math.random() - 0.5) * sp;
    pool.grav[i] = opts.gravity ?? d.gravity;
    pool.drag[i] = opts.drag ?? d.drag;
    pool.color[i].set(colors[Math.floor(Math.random() * colors.length)]);
  }
}

function geoFor(kind: ParticleKind): THREE.BufferGeometry {
  switch (kind) {
    case 'sparkle':
      return cachedGeo('p-star', () => starGeometry(1, 0.3));
    case 'heart':
      return cachedGeo('p-heart', () => heartGeometry(1, 0.35));
    case 'confetti':
      return cachedGeo('p-conf', () => new THREE.CapsuleGeometry(0.35, 1.2, 3, 6));
    case 'puff':
      return cachedGeo('p-puff', () => puffGeometry(3, 5, 0.6, 1));
    case 'drop':
      return cachedGeo('p-drop', () => {
        const g = new THREE.SphereGeometry(1, 10, 8);
        g.scale(0.85, 1.25, 0.85);
        return g;
      });
    case 'note':
      return cachedGeo('p-note', () => noteGeometry(1));
    case 'bubble':
      return cachedGeo('p-bubble', () => new THREE.SphereGeometry(1, 16, 12));
  }
}

function matFor(kind: ParticleKind): THREE.Material {
  switch (kind) {
    case 'sparkle':
      return new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    case 'heart':
    case 'note':
      return new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.25 });
    case 'confetti':
      return new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });
    case 'puff':
      return new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, emissive: new THREE.Color('#ffe8f2'), emissiveIntensity: 0.35 });
    case 'drop':
      return new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.08, clearcoat: 1 });
    case 'bubble':
      return makeBubbleMaterial('#ffffff', 1.1);
  }
}

const KINDS: ParticleKind[] = ['sparkle', 'heart', 'confetti', 'puff', 'drop', 'note', 'bubble'];
const BILLBOARD: Partial<Record<ParticleKind, boolean>> = { sparkle: true, heart: true, note: true };

export function Particles() {
  const refs = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const mats = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, matFor(k)])) as Record<ParticleKind, THREE.Material>, []);
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(), qz: new THREE.Quaternion(), z: new THREE.Vector3(0, 0, 1) }),
    [],
  );
  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const camQ = state.camera.quaternion;
    for (const kind of KINDS) {
      const mesh = refs.current[kind];
      if (!mesh) continue;
      const pool = pools[kind];
      let i = 0;
      while (i < pool.n) {
        pool.life[i] += dt;
        if (pool.life[i] >= pool.max[i]) {
          // swap-remove
          const last = pool.n - 1;
          if (i !== last) {
            for (let c = 0; c < 3; c++) {
              pool.pos[i * 3 + c] = pool.pos[last * 3 + c];
              pool.vel[i * 3 + c] = pool.vel[last * 3 + c];
              pool.rot[i * 3 + c] = pool.rot[last * 3 + c];
              pool.spin[i * 3 + c] = pool.spin[last * 3 + c];
            }
            pool.life[i] = pool.life[last];
            pool.max[i] = pool.max[last];
            pool.size[i] = pool.size[last];
            pool.grav[i] = pool.grav[last];
            pool.drag[i] = pool.drag[last];
            pool.color[i].copy(pool.color[last]);
          }
          pool.n--;
          continue;
        }
        const drag = Math.exp(-pool.drag[i] * dt);
        pool.vel[i * 3] *= drag;
        pool.vel[i * 3 + 1] = pool.vel[i * 3 + 1] * drag + pool.grav[i] * dt;
        pool.vel[i * 3 + 2] *= drag;
        pool.pos[i * 3] += pool.vel[i * 3] * dt;
        pool.pos[i * 3 + 1] += pool.vel[i * 3 + 1] * dt;
        pool.pos[i * 3 + 2] += pool.vel[i * 3 + 2] * dt;
        pool.rot[i * 3] += pool.spin[i * 3] * dt;
        pool.rot[i * 3 + 1] += pool.spin[i * 3 + 1] * dt;
        pool.rot[i * 3 + 2] += pool.spin[i * 3 + 2] * dt;
        const u = pool.life[i] / pool.max[i];
        let sc = pool.size[i];
        if (kind === 'puff') sc *= 0.6 + u * 1.1;
        const fadeIn = Math.min(1, u * 8);
        const fadeOut = 1 - Math.max(0, (u - 0.65) / 0.35);
        sc *= fadeIn * fadeOut;
        if (kind === 'sparkle') sc *= 0.75 + 0.25 * Math.sin(pool.life[i] * 25 + i);
        tmp.p.set(pool.pos[i * 3], pool.pos[i * 3 + 1], pool.pos[i * 3 + 2]);
        if (BILLBOARD[kind]) {
          tmp.qz.setFromAxisAngle(tmp.z, pool.rot[i * 3 + 2]);
          tmp.q.copy(camQ).multiply(tmp.qz);
        } else {
          tmp.e.set(pool.rot[i * 3], pool.rot[i * 3 + 1], pool.rot[i * 3 + 2]);
          tmp.q.setFromEuler(tmp.e);
        }
        tmp.s.setScalar(Math.max(0.0001, sc));
        if (kind === 'drop') {
          // stretch along velocity a little
          tmp.s.y *= 1 + Math.min(1.2, Math.abs(pool.vel[i * 3 + 1]) * 0.08);
          tmp.q.identity();
        }
        tmp.m.compose(tmp.p, tmp.q, tmp.s);
        mesh.setMatrixAt(i, tmp.m);
        tmpC.copy(pool.color[i]);
        mesh.setColorAt(i, tmpC);
        i++;
      }
      mesh.count = pool.n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });
  return (
    <group>
      {KINDS.map((k) => (
        <instancedMesh
          key={k}
          ref={(m) => {
            refs.current[k] = m;
            if (m && !m.instanceColor) {
              m.setColorAt(0, new THREE.Color('#ffffff'));
              m.count = 0;
            }
          }}
          args={[geoFor(k), mats[k], CAP[k]]}
          frustumCulled={false}
          raycast={() => null}
        />
      ))}
    </group>
  );
}
