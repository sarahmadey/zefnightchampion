// Stop 3 — Send Pip sliding down a jam slide. Pip climbs a wafer ladder up a
// cake tower, whooshes down a glossy spiral jam chute and splashes into the
// jam pool, then shakes off happily.

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { StopFrame, useStop } from './common';
import { STOP_DEFS, localToWorld } from '../world/stopDefs';
import { cachedGeo, merge, paint, roundedBox, pipedSwirl } from '../three/geometry';
import { jam, matte, vcolor } from '../three/materials';
import { HintHand, Glow } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pip, pipReact, zef, zefPlay } from '../game/actors';
import { pipSpot } from '../game/nav';
import { TAU, clamp, ease, lerp } from '../three/util';
import { cakeGeometry } from '../world/regions/Garden';

const ID = 3;
const TOP_Y = 2.75;
const HELIX_R = 1.5;
const TURNS = 1.15;
// the slide starts on the side facing the camera and spirals clockwise
const START_A = 2.28;
const DIR = -1;

function helixPoint(u: number, out = new THREE.Vector3()) {
  const a = START_A + DIR * u * TURNS * TAU;
  const y = lerp(TOP_Y, 0.45, u);
  return out.set(Math.cos(a) * HELIX_R, y, Math.sin(a) * HELIX_R);
}

function chuteGeometry() {
  return cachedGeo('jam-chute', () => {
    const segs = 120;
    const ring = 12;
    const pos: number[] = [];
    const idx: number[] = [];
    const P = new THREE.Vector3();
    const Q = new THREE.Vector3();
    const T = new THREE.Vector3();
    const N = new THREE.Vector3();
    const U = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      helixPoint(u, P);
      if (i < segs) {
        helixPoint(u + 0.002, Q);
        T.subVectors(Q, P).normalize();
      } else {
        helixPoint(u - 0.002, Q);
        T.subVectors(P, Q).normalize();
      }
      N.crossVectors(T, up).normalize();
      U.crossVectors(N, T).normalize();
      for (let j = 0; j <= ring; j++) {
        // a U-shaped trough opening upward
        const a = Math.PI + 0.35 + (j / ring) * (Math.PI - 0.7);
        const r = 0.34;
        pos.push(P.x + (Math.cos(a) * N.x + Math.sin(a) * U.x) * r, P.y + (Math.cos(a) * N.y + Math.sin(a) * U.y) * r, P.z + (Math.cos(a) * N.z + Math.sin(a) * U.z) * r);
      }
    }
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < ring; j++) {
        const a = i * (ring + 1) + j;
        const b = a + ring + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}

function supportsGeometry() {
  return cachedGeo('jam-supports', () => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 1; i < 6; i++) {
      const p = helixPoint(i / 6);
      const c = new THREE.CylinderGeometry(0.06, 0.07, p.y - 0.3, 8);
      c.translate(p.x * 1.08, (p.y - 0.3) / 2, p.z * 1.08);
      parts.push(c);
    }
    return paint(merge(parts), '#ffe3ef');
  });
}

const LADDER_A = START_A - DIR * 0.55;
function ladderEnds() {
  const bottom = new THREE.Vector3(Math.cos(LADDER_A) * 1.95, 0, Math.sin(LADDER_A) * 1.95);
  const top = new THREE.Vector3(Math.cos(LADDER_A) * 1.2, TOP_Y, Math.sin(LADDER_A) * 1.2);
  return { bottom, top };
}

function ladderGeometry() {
  return cachedGeo('wafer-ladder', () => {
    const { bottom, top } = ladderEnds();
    const parts: THREE.BufferGeometry[] = [];
    const side = new THREE.Vector3(-Math.sin(LADDER_A), 0, Math.cos(LADDER_A));
    for (const s of [-1, 1]) {
      const a = bottom.clone().addScaledVector(side, s * 0.28);
      const b = top.clone().addScaledVector(side, s * 0.28);
      const len = a.distanceTo(b);
      const rail = new THREE.CylinderGeometry(0.05, 0.05, len, 8);
      rail.translate(0, len / 2, 0);
      const dir = b.clone().sub(a).normalize();
      rail.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      rail.translate(a.x, a.y, a.z);
      parts.push(paint(rail, '#ffffff'));
    }
    for (let i = 1; i < 8; i++) {
      const p = bottom.clone().lerp(top, i / 8);
      const step = roundedBox(0.62, 0.06, 0.16, 0.03, 2);
      step.rotateY(-Math.atan2(side.z, side.x));
      step.translate(p.x, p.y, p.z);
      parts.push(paint(step, '#e9b25c'));
    }
    return merge(parts);
  });
}

export function Stop03JamSlide() {
  const s = useStop(ID);
  const d = STOP_DEFS[ID];
  const [ox, , oz] = d.object;
  const pool = useMemo(() => {
    const end = helixPoint(1);
    return new THREE.Vector3(end.x * 1.25, 0, end.z * 1.25);
  }, []);
  const ripples = useRef<(THREE.Mesh | null)[]>([]);
  const st = useMemo(() => ({ t: -1, run: 0, ripple: [9, 9, 9], trailT: 0 }), []);
  const local = (p: THREE.Vector3) => localToWorld(ID, [p.x + ox, p.y, p.z + oz]);

  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    // ripples on the jam pool
    st.ripple = st.ripple.map((r) => r + dt);
    ripples.current.forEach((m, i) => {
      if (!m) return;
      const r = st.ripple[i];
      m.visible = r < 1.6;
      m.scale.setScalar(0.2 + r * 0.9);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - r / 1.6);
    });
    if (st.t < 0) return;
    st.t += dt;
    const t = st.t;
    const { bottom, top } = ladderEnds();
    const wait = pipSpot.pos.clone();
    if (t < 1.0) {
      const p = local(bottom);
      pip.pos.lerp(p, Math.min(1, dt * 4));
      pip.heading = Math.atan2(p.x - pip.pos.x, p.z - pip.pos.z) || pip.heading;
      pip.speed = 2;
    } else if (t < 2.6) {
      const u = (t - 1.0) / 1.6;
      const p = local(bottom.clone().lerp(top, u));
      pip.pos.copy(p);
      pip.pos.y += Math.abs(Math.sin(u * Math.PI * 7)) * 0.08;
      pip.speed = 1.2;
      const tp = local(top);
      pip.heading = Math.atan2(tp.x - pip.pos.x, tp.z - pip.pos.z);
    } else if (t < 3.1) {
      pip.speed = 0;
      pip.pose = 'slide';
      const start = local(helixPoint(0));
      pip.pos.lerp(start.setY(start.y + 0.05), Math.min(1, dt * 8));
      if (pip.reaction.name === 'none') pipReact('wave', 0.6);
    } else if (t < 5.3) {
      const u = ease.inCubic(clamp((t - 3.1) / 2.2, 0, 1)) * 0.75 + clamp((t - 3.1) / 2.2, 0, 1) * 0.25;
      const p = local(helixPoint(u));
      const q = local(helixPoint(Math.min(1, u + 0.01)));
      pip.pos.copy(p).setY(p.y - 0.16);
      pip.heading = Math.atan2(q.x - p.x, q.z - p.z) + (st.run % 3 === 2 ? Math.PI : 0);
      pip.speed = 0;
      st.trailT += dt;
      if (st.trailT > 0.08) {
        st.trailT = 0;
        burst('sparkle', pip.pos.clone().setY(pip.pos.y + 0.3), { count: 2, speed: 0.4, up: 0.3, size: 0.12 });
      }
    } else if (t < 6.6) {
      if (pip.pose === 'slide') {
        pip.pose = 'stand';
        const splashAt = local(pool).setY(0.25);
        burst('drop', splashAt, { count: 26, speed: 3, up: 3.5, colors: ['#d7143a', '#ff4f6d', '#a00b26'], size: 0.08 });
        burst('sparkle', splashAt, { count: 16 });
        sfx.play('splash');
        sfx.play('giggle');
        st.ripple = [0, 0.25, 0.5];
        zefPlay('clap', 1.4);
        zef.expression = 'happy';
        setTimeout(() => (zef.expression = 'smile'), 1600);
        pipReact(st.run % 2 ? 'giggle' : 'flip', 1.2);
      }
      const p = local(pool);
      const u = (t - 5.3) / 1.3;
      pip.pos.set(p.x, -0.25 + Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) * 0.3, p.z);
      if (u > 0.5 && u < 0.55) burst('drop', pip.pos.clone().setY(0.4), { count: 10, speed: 2, up: 1.5, colors: ['#d7143a', '#ff4f6d'], size: 0.05 });
    } else if (t < 7.8) {
      pip.pos.lerp(wait, Math.min(1, dt * 3));
      pip.heading = Math.atan2(wait.x - pip.pos.x, wait.z - pip.pos.z) || pip.heading;
      pip.speed = 1.8;
    } else {
      st.t = -1;
      st.run++;
      pip.mode = 'stay';
      pip.speed = 0;
      pip.pose = 'stand';
    }
  });

  const tap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!s.ask()) return;
    if (st.t < 0) {
      st.t = 0;
      pip.mode = 'scripted';
      pip.reaction.name = 'none';
      sfx.play('whoosh');
      zef.look = local(new THREE.Vector3(0, TOP_Y, 0));
      zefPlay('point', 1.2);
      burst('sparkle', e.point, { count: 10 });
    } else {
      burst('sparkle', e.point, { count: 8 });
      sfx.play('pop');
    }
  };

  const rippleMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffb3c4', transparent: true, opacity: 0.6, depthWrite: false }), []);

  return (
    <StopFrame id={ID}>
      <group position={[ox, 0, oz]}>
        <mesh geometry={cakeGeometry(3, 1.0, 9)} material={vcolor(0.6, 'cake')} castShadow receiveShadow />
        <mesh geometry={chuteGeometry()} castShadow>
          <meshPhysicalMaterial attach="material" color="#e01b3a" roughness={0.08} clearcoat={1} clearcoatRoughness={0.04} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={supportsGeometry()} material={vcolor(0.5, 'supports')} />
        <mesh geometry={ladderGeometry()} material={vcolor(0.5, 'ladder')} castShadow />
        {/* jam pool */}
        <group position={[pool.x, 0, pool.z]}>
          <mesh material={matte('#fff0f5', 0.5)} position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.0, 0.16, 10, 32]} />
          </mesh>
          <mesh geometry={cachedGeo('pool-rim', () => pipedSwirl({ radius: 0.2, height: 0.25, thickness: 0.08, turns: 2 }))} material={matte('#ffffff', 0.5)} position={[0.95, 0.15, 0.3]} />
          <mesh material={jam('#c8102e')} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.98, 36]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} ref={(m) => (ripples.current[i] = m)} material={rippleMat} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
              <ringGeometry args={[0.85, 1, 32]} />
            </mesh>
          ))}
        </group>
        <Glow color="#ff8fa3" size={1.6} opacity={0.3} position={[helixPoint(0).x, TOP_Y + 0.4, helixPoint(0).z]} />
        {/* tap anywhere on the slide, tower or pool */}
        <mesh visible={false} position={[0, 1.4, 0]} onPointerDown={tap}>
          <cylinderGeometry args={[2.1, 2.1, 3.2, 12]} />
        </mesh>
        <mesh visible={false} position={[pool.x, 0.3, pool.z]} onPointerDown={tap}>
          <cylinderGeometry args={[1.2, 1.2, 0.6, 12]} />
        </mesh>
        <HintHand visible={s.hint} gesture="tap" from={[helixPoint(0.45).x * 1.1, helixPoint(0.45).y + 0.35, helixPoint(0.45).z * 1.1]} scale={1.2} />
      </group>
    </StopFrame>
  );
}

