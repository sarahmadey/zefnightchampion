// Things that appear during a morning event: the big star that flies to the
// board, the mystery egg that cracks open, the glowing high-five target, and
// the friendly pterodactyl that flies Zef to the Underpants Store.

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cachedGeo, curveFrom, extrude, lathe, merge, paint, starShape, tube } from '../three/geometry';
import { burst } from '../three/Particles';
import { Glow } from '../three/bits';
import { clamp, damp, ease, mulberry32, TAU } from '../three/util';
import { frameDt } from '../game/actors';
import { sfx } from '../audio/sfx';

export const fx = {
  star: { active: false, t: 0, dur: 1.3, to: new THREE.Vector3(), from: new THREE.Vector3(), started: false, done: null as null | (() => void) },
  egg: { visible: false, pos: new THREE.Vector3(), wobble: 0, crack: 0, hatch: 0, pop: 0 },
  hand: { visible: false, pos: new THREE.Vector3(), follow: null as null | { hand: THREE.Vector3 } },
  ptero: { visible: false, pos: new THREE.Vector3(), heading: 0, flap: 1, carry: false },
};

let eggTap: (() => void) | null = null;
let handTap: (() => void) | null = null;
export function onEggTap(fn: (() => void) | null) {
  eggTap = fn;
}
export function onHandTap(fn: (() => void) | null) {
  handTap = fn;
}

/** Fly a star from in front of the camera to a board space. Resolves when it lands. */
export function flyStar(to: THREE.Vector3): Promise<void> {
  return new Promise((resolve) => {
    fx.star.active = true;
    fx.star.started = false;
    fx.star.t = 0;
    fx.star.to.copy(to);
    fx.star.done = resolve;
  });
}

const starMat = new THREE.MeshPhysicalMaterial({ color: '#ffd23f', metalness: 0.4, roughness: 0.15, clearcoat: 1, emissive: new THREE.Color('#ffb703'), emissiveIntensity: 0.6 });

function FlyingStar() {
  const ref = useRef<THREE.Group>(null!);
  const camera = useThree((s) => s.camera);
  const geo = useMemo(() => cachedGeo('big-star', () => extrude(starShape(5, 0.5, 0.22, 0.25), 0.16, 0.06, 6)), []);
  const ctrl = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, raw) => {
    const s = fx.star;
    const g = ref.current;
    if (!s.active) {
      g.visible = false;
      return;
    }
    const dt = frameDt(raw);
    if (!s.started) {
      s.started = true;
      camera.getWorldDirection(fwd);
      s.from.copy(camera.position).addScaledVector(fwd, 3.2);
      s.from.y += 0.3;
      sfx.play('star');
    }
    s.t += dt / s.dur;
    const t = clamp(s.t, 0, 1);
    // hover and spin in front of the camera, then swoop down to the space
    const hold = 0.35;
    if (t < hold) {
      const k = ease.outBack(t / hold);
      g.position.copy(s.from);
      g.scale.setScalar(0.2 + k * 0.9);
    } else {
      const u = ease.inOutSine((t - hold) / (1 - hold));
      ctrl.copy(s.from).lerp(s.to, 0.5);
      ctrl.y += 2.2;
      const a = s.from.clone().lerp(ctrl, u);
      const b = ctrl.clone().lerp(s.to, u);
      g.position.copy(a.lerp(b, u));
      g.scale.setScalar(1.1 - u * 0.75);
    }
    g.visible = true;
    g.rotation.set(t < hold ? 0 : -u2(t, hold) * 1.4, t * 14, 0);
    g.lookAt(camera.position);
    g.rotateZ(t * 8);
    if (s.t >= 1) {
      s.active = false;
      g.visible = false;
      burst('sparkle', s.to.clone().setY(s.to.y + 0.3), { count: 26, speed: 3, colors: ['#fff3a8', '#ffd43b', '#ffffff'] });
      sfx.play('ding');
      const done = s.done;
      s.done = null;
      done?.();
    }
  });
  return (
    <group ref={ref} visible={false}>
      <mesh geometry={geo} material={starMat} raycast={() => null} />
      <Glow color="#ffe066" size={2.4} opacity={0.6} />
    </group>
  );
}

function u2(t: number, hold: number) {
  return clamp((t - hold) / (1 - hold), 0, 1);
}

// ------------------------------------------------------------------ egg

function eggHalf(top: boolean) {
  return cachedGeo(`egg-${top ? 'top' : 'bot'}`, () => {
    const pts: [number, number][] = [];
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const ang = t * Math.PI;
      const y = -Math.cos(ang);
      const r = Math.sin(ang) * (1 - 0.18 * y);
      pts.push([Math.max(0, r) * 0.36, (y + 1) * 0.45]);
    }
    const g = new THREE.LatheGeometry(
      pts.filter(([, y]) => (top ? y >= 0.44 : y <= 0.46)).map(([x, y]) => new THREE.Vector2(x, y)),
      28,
    );
    // a zig-zag crack edge
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (Math.abs(y - 0.45) < 0.02) {
        const a = Math.atan2(p.getZ(i), p.getX(i));
        p.setY(i, 0.45 + Math.sin(a * 7) * 0.05 * (top ? 1 : 1));
      }
    }
    g.computeVertexNormals();
    const rng = mulberry32(top ? 3 : 4);
    const spots: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU;
      const y = top ? 0.5 + rng() * 0.3 : 0.12 + rng() * 0.28;
      const r = Math.sqrt(Math.max(0, 1 - Math.pow(y / 0.45 - 1, 2))) * 0.36 * (1 - 0.18 * (y / 0.45 - 1));
      const s = new THREE.SphereGeometry(0.045 + rng() * 0.03, 8, 6);
      s.scale(1, 1, 0.3);
      s.lookAt(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
      s.translate(Math.cos(a) * r, y, Math.sin(a) * r);
      spots.push(paint(s.toNonIndexed(), '#6fcf97'));
    }
    return merge([paint(g.toNonIndexed(), '#fff8e7'), ...spots]);
  });
}

const eggMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.6, sheen: 0.4 });
const crackMat = new THREE.MeshBasicMaterial({ color: '#5c4a3a' });

function crackGeo(i: number) {
  return cachedGeo(`egg-crack-${i}`, () => {
    const a0 = i * 2.1;
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= 6; k++) {
      const y = 0.75 - k * 0.07;
      const a = a0 + (k % 2 ? 0.12 : -0.12);
      const r = 0.37 * Math.sin(Math.acos(Math.min(1, Math.abs(y / 0.45 - 1)))) + 0.005;
      pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    return tube(curveFrom(pts, 0), { segments: 12, radial: 4, radius: () => 0.012 });
  });
}

function Egg() {
  const g = useRef<THREE.Group>(null!);
  const top = useRef<THREE.Group>(null!);
  const cracks = useRef<THREE.Group>(null!);
  const st = useRef({ t: 0, topV: 0, topY: 0, spin: 0 });
  useFrame((_, raw) => {
    const e = fx.egg;
    const dt = frameDt(raw);
    g.current.visible = e.visible;
    if (!e.visible) {
      st.current.topY = 0;
      return;
    }
    const s = st.current;
    s.t += dt;
    g.current.position.copy(e.pos);
    const wob = e.wobble * Math.sin(s.t * 22) * 0.18;
    g.current.rotation.set(0, 0, wob);
    const pop = ease.outBack(clamp(e.pop, 0, 1));
    g.current.scale.setScalar(Math.max(0.001, pop));
    e.wobble = damp(e.wobble, 0.15, 2.5, dt);
    cracks.current.children.forEach((c, i) => (c.visible = e.crack > i));
    if (e.hatch > 0) {
      s.topY += dt * 3.2 * (1 + e.hatch);
      top.current.position.y = s.topY;
      top.current.rotation.z = s.topY * 1.6;
      top.current.position.x = s.topY * 0.4;
    } else {
      top.current.position.set(0, 0, 0);
      top.current.rotation.set(0, 0, 0);
    }
  });
  return (
    <group ref={g} visible={false}>
      <mesh geometry={eggHalf(false)} material={eggMat} castShadow raycast={() => null} />
      <group ref={top}>
        <mesh geometry={eggHalf(true)} material={eggMat} castShadow raycast={() => null} />
      </group>
      <group ref={cracks}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={crackGeo(i)} material={crackMat} raycast={() => null} />
        ))}
      </group>
      <Glow color="#fff6c2" size={2.2} opacity={0.45} position={[0, 0.45, 0]} />
      <mesh
        position={[0, 0.45, 0]}
        visible={false}
        onPointerDown={(ev) => {
          ev.stopPropagation();
          eggTap?.();
        }}
      >
        <sphereGeometry args={[0.95, 10, 8]} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------- high five

const ringMat = new THREE.MeshBasicMaterial({ color: '#fff3a3', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });

function HandTarget() {
  const g = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const camera = useThree((s) => s.camera);
  const st = useRef({ t: 0 });
  useFrame((_, raw) => {
    const h = fx.hand;
    g.current.visible = h.visible;
    if (!h.visible) return;
    st.current.t += frameDt(raw);
    if (h.follow) h.pos.copy(h.follow.hand);
    g.current.position.copy(h.pos);
    g.current.quaternion.copy(camera.quaternion);
    const u = (st.current.t % 1.1) / 1.1;
    ring.current.scale.setScalar(0.6 + u * 0.9);
    ringMat.opacity = 0.9 * (1 - u);
  });
  return (
    <group ref={g} visible={false}>
      <mesh ref={ring} material={ringMat} raycast={() => null}>
        <ringGeometry args={[0.36, 0.46, 40]} />
      </mesh>
      <Glow color="#fff3a3" size={1.3} opacity={0.55} />
      <mesh
        visible={false}
        onPointerDown={(e) => {
          e.stopPropagation();
          handTap?.();
        }}
      >
        <sphereGeometry args={[0.95, 10, 8]} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------- pterodactyl

const pteroMat = new THREE.MeshPhysicalMaterial({ color: '#9b6dff', roughness: 0.5, sheen: 0.5, clearcoat: 0.2 });
const wingMat = new THREE.MeshPhysicalMaterial({ color: '#c8a8ff', roughness: 0.6, side: THREE.DoubleSide, sheen: 0.6 });
const beakMat = new THREE.MeshPhysicalMaterial({ color: '#ffd43b', roughness: 0.4, clearcoat: 0.5 });
const pEye = new THREE.MeshBasicMaterial({ color: '#1d1430' });

function wingGeo() {
  return cachedGeo('ptero-wing', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(0.9, 0.35, 2.1, 0.1);
    s.quadraticCurveTo(1.6, -0.2, 1.5, -0.45);
    s.quadraticCurveTo(1.0, -0.3, 0.8, -0.6);
    s.quadraticCurveTo(0.4, -0.35, 0, -0.4);
    s.lineTo(0, 0);
    const g = extrude(s, 0.03, 0.01, 12);
    g.rotateX(Math.PI / 2);
    return g;
  });
}

function Pterodactyl() {
  const g = useRef<THREE.Group>(null!);
  const left = useRef<THREE.Group>(null!);
  const right = useRef<THREE.Group>(null!);
  const st = useRef({ t: 0 });
  const body = useMemo(
    () =>
      cachedGeo('ptero-body', () => {
        const b = lathe([[0, -0.5], [0.22, -0.35], [0.28, 0.0], [0.2, 0.35], [0, 0.5]], 18, 12);
        b.rotateX(Math.PI / 2);
        return b;
      }),
    [],
  );
  const crest = useMemo(() => cachedGeo('ptero-crest', () => tube(curveFrom([[0, 0, 0], [0, 0.1, -0.2], [0, 0.25, -0.45]]), { segments: 8, radial: 6, radius: (t) => 0.08 * (1 - t) + 0.01 })), []);
  useFrame((_, raw) => {
    const p = fx.ptero;
    g.current.visible = p.visible;
    if (!p.visible) return;
    st.current.t += frameDt(raw);
    g.current.position.copy(p.pos);
    g.current.rotation.set(0, p.heading, 0);
    const a = Math.sin(st.current.t * 9 * p.flap) * 0.7 * p.flap;
    left.current.rotation.z = a;
    right.current.rotation.z = -a;
  });
  return (
    <group ref={g} visible={false}>
      <group scale={1.4}>
        <mesh geometry={body} material={pteroMat} castShadow raycast={() => null} />
        <group position={[0, 0.12, 0.45]}>
          <mesh material={pteroMat} scale={[0.2, 0.18, 0.24]} raycast={() => null}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
          <mesh material={beakMat} position={[0, -0.02, 0.3]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
            <coneGeometry args={[0.07, 0.4, 12]} />
          </mesh>
          <mesh geometry={crest} material={pteroMat} position={[0, 0.12, -0.05]} raycast={() => null} />
          {[-1, 1].map((s) => (
            <mesh key={s} material={pEye} position={[0.13 * s, 0.06, 0.12]} raycast={() => null}>
              <sphereGeometry args={[0.035, 8, 6]} />
            </mesh>
          ))}
        </group>
        <group ref={left} position={[0.2, 0.05, 0.05]}>
          <mesh geometry={wingGeo()} material={wingMat} raycast={() => null} />
        </group>
        <group ref={right} position={[-0.2, 0.05, 0.05]} scale={[-1, 1, 1]}>
          <mesh geometry={wingGeo()} material={wingMat} raycast={() => null} />
        </group>
      </group>
    </group>
  );
}

export function EventProps() {
  return (
    <>
      <FlyingStar />
      <Egg />
      <HandTarget />
      <Pterodactyl />
    </>
  );
}
