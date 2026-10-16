// Things that appear during a morning event: the big star that flies to the
// board, the mystery egg that cracks open and the prize that floats out of it,
// the glowing high-five target, balloons to pop, fireworks tapped into the
// sky, bushes for hide-and-seek, fruit for Coach Rex's snack, the dino band's
// music rocks, and the friendly pterodactyl that flies Zef to the Underwear
// Store.

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cachedGeo, curveFrom, extrude, lathe, lumpy, merge, paint, petalShape, sphere, starShape, tube } from '../three/geometry';
import { burst } from '../three/Particles';
import { Glow } from '../three/bits';
import { clamp, damp, ease, mulberry32, TAU } from '../three/util';
import { frameDt } from '../game/actors';
import { sfx } from '../audio/sfx';
import { Ellipsoid, RoundCone, Sculpt, meshSculpt } from '../dino/sdf';
import { skinMaterial } from '../dino/skin';
import { buildAccessory } from '../dino/accessories';
import { ACCESSORIES, type Species } from '../game/rewards';
import { useGame } from '../state/store';
import { bushGeometry } from './props';

export const fx = {
  star: { active: false, t: 0, dur: 1.3, to: new THREE.Vector3(), from: new THREE.Vector3(), started: false, done: null as null | (() => void) },
  egg: { visible: false, pos: new THREE.Vector3(), wobble: 0, crack: 0, hatch: 0, pop: 0 },
  /** the prize out of the egg, shown big and spinning before it goes on */
  prize: { visible: false, index: -1, species: 'trex' as Species, pos: new THREE.Vector3(), size: 1, float: 1 },
  /** balloons to pop: each floats until it's tapped */
  balloons: { active: false, items: [] as { pos: THREE.Vector3; popped: boolean; pop: number }[] },
  /** fireworks on their way up: each bursts when it reaches the sky */
  rockets: [] as { from: THREE.Vector3; to: THREE.Vector3; t: number; colors: string[] }[],
  /** the star to tap during the intro, over the next stone */
  introStar: { visible: false, pos: new THREE.Vector3() },
  /** hide-and-seek bushes */
  bushes: { active: false, items: [] as { pos: THREE.Vector3; wiggle: number; scale: number; heading: number }[] },
  /** Coach Rex's snack: fruit on a big leaf; a tapped one flies into his mouth */
  fruit: {
    active: false,
    pop: 0,
    heading: 0,
    leaf: new THREE.Vector3(),
    items: [] as { pos: THREE.Vector3; from: THREE.Vector3; to: THREE.Vector3; fly: number; flying: boolean; landed: boolean; chewed: boolean }[],
  },
  /** the dino band's music rocks: each one plays a note when tapped */
  rocks: { active: false, pop: 0, items: [] as { pos: THREE.Vector3; bounce: number; glow: number; hint: number }[] },
  hand: { visible: false, pos: new THREE.Vector3(), follow: null as null | { hand: THREE.Vector3 } },
  ptero: { visible: false, pos: new THREE.Vector3(), heading: 0, flap: 1, carry: false },
};

let eggTap: (() => void) | null = null;
let handTap: (() => void) | null = null;
let prizeTap: (() => void) | null = null;
let balloonTap: ((i: number) => void) | null = null;
let skyTap: ((p: THREE.Vector3) => void) | null = null;
let bushTap: ((i: number) => void) | null = null;
let introStarTap: (() => void) | null = null;
let fruitTap: ((i: number) => void) | null = null;
let rockTap: ((i: number) => void) | null = null;
export function onFruitTap(fn: ((i: number) => void) | null) {
  fruitTap = fn;
}
export function onRockTap(fn: ((i: number) => void) | null) {
  rockTap = fn;
}
export function onIntroStarTap(fn: (() => void) | null) {
  introStarTap = fn;
}
export function onBalloonTap(fn: ((i: number) => void) | null) {
  balloonTap = fn;
}
export function onSkyTap(fn: ((p: THREE.Vector3) => void) | null) {
  skyTap = fn;
}
export function onBushTap(fn: ((i: number) => void) | null) {
  bushTap = fn;
}

const FIREWORK_COLORS = [
  ['#ff5c8a', '#ffd1e0', '#ffffff'],
  ['#ffd43b', '#fff3a8', '#ff922b'],
  ['#4dabf7', '#a5d8ff', '#ffffff'],
  ['#69db7c', '#d3f9d8', '#fff3a8'],
  ['#b197fc', '#e5dbff', '#ffd1f0'],
];
let rocketN = 0;

/** Send a firework up to `to`; it bursts there. */
export function launchFirework(to: THREE.Vector3) {
  const from = to.clone();
  from.y = Math.min(to.y - 4, 0.5);
  fx.rockets.push({ from, to: to.clone(), t: 0, colors: FIREWORK_COLORS[rocketN++ % FIREWORK_COLORS.length] });
  sfx.play('firework');
}
export function onEggTap(fn: (() => void) | null) {
  eggTap = fn;
}
export function onPrizeTap(fn: (() => void) | null) {
  prizeTap = fn;
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
      spots.push(paint(s.index ? s.toNonIndexed() : s, '#6fcf97'));
    }
    return merge([paint(g.index ? g.toNonIndexed() : g, '#fff8e7'), ...spots]);
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
          if (!eggTap) return;
          ev.stopPropagation();
          eggTap();
        }}
      >
        <sphereGeometry args={[0.95, 10, 8]} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------- the prize

/** The accessory on its own, centred and one unit across (shoes come as a pair). */
export function showcaseModel(index: number, species: Species): THREE.Group {
  const inner = new THREE.Group();
  if (ACCESSORIES[index].slot === 'feet') {
    for (const side of [-1, 1]) {
      const shoe = buildAccessory(index, species);
      shoe.position.x = side * 0.13;
      shoe.rotation.y = side * -0.2;
      inner.add(shoe);
    }
  } else {
    inner.add(buildAccessory(index, species));
  }
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const k = 1 / Math.max(size.x, size.y, size.z, 0.05);
  inner.scale.setScalar(k);
  inner.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-k);
  const wrap = new THREE.Group();
  wrap.add(inner);
  return wrap;
}

function PrizeShowcase() {
  const g = useRef<THREE.Group>(null!);
  const holder = useRef<THREE.Group>(null!);
  const st = useRef({ key: '', t: 0, spinners: [] as THREE.Object3D[] });
  useFrame((_, raw) => {
    const p = fx.prize;
    const show = p.visible && p.index >= 0 && p.index < ACCESSORIES.length;
    g.current.visible = show;
    if (!show) return;
    const dt = frameDt(raw);
    const s = st.current;
    const key = `${p.index}|${p.species}`;
    if (key !== s.key) {
      holder.current.clear();
      const model = showcaseModel(p.index, p.species);
      holder.current.add(model);
      s.spinners = [];
      model.traverse((o) => o.userData.spin && s.spinners.push(o));
      holder.current.rotation.set(0, 0, 0);
      s.key = key;
    }
    s.t += dt;
    g.current.position.copy(p.pos);
    g.current.position.y += Math.sin(s.t * 2.4) * 0.06 * p.float;
    g.current.scale.setScalar(Math.max(0.001, p.size));
    // turn slowly to show it off, with a little tilt toward the camera
    holder.current.rotation.y += dt * (0.4 + 0.9 * p.float);
    holder.current.rotation.x = 0.18 * p.float;
    for (const o of s.spinners) o.rotation.y += dt * (o.userData.spin as number);
  });
  return (
    <group ref={g} visible={false}>
      <group ref={holder} />
      <Glow color="#fff1a8" size={2.1} opacity={0.5} />
      <mesh
        visible={false}
        onPointerDown={(ev) => {
          if (!prizeTap) return;
          ev.stopPropagation();
          prizeTap();
        }}
      >
        <sphereGeometry args={[0.75, 10, 8]} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------- the intro's star

function IntroStar() {
  const g = useRef<THREE.Group>(null!);
  const st = useRef({ t: 0 });
  const geo = useMemo(() => cachedGeo('big-star', () => extrude(starShape(5, 0.5, 0.22, 0.25), 0.16, 0.06, 6)), []);
  useFrame((_, raw) => {
    const s = fx.introStar;
    g.current.visible = s.visible;
    if (!s.visible) return;
    st.current.t += frameDt(raw);
    const t = st.current.t;
    g.current.position.copy(s.pos);
    g.current.position.y += Math.sin(t * 2.4) * 0.08;
    g.current.rotation.y = t * 1.6;
    g.current.scale.setScalar(1 + Math.sin(t * 5) * 0.07);
  });
  return (
    <group ref={g} visible={false}>
      <mesh geometry={geo} material={starMat} raycast={() => null} />
      <Glow color="#ffe066" size={2.2} opacity={0.55} />
      <mesh
        visible={false}
        onPointerDown={(ev) => {
          if (!introStarTap) return;
          ev.stopPropagation();
          introStarTap();
        }}
      >
        <sphereGeometry args={[0.85, 10, 8]} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------- balloons

const BALLOON_COLORS = ['#ff4d6d', '#ffd43b', '#4dabf7', '#69db7c', '#b197fc', '#ff922b'];
export const MAX_BALLOONS = BALLOON_COLORS.length;
const balloonMats = BALLOON_COLORS.map(
  (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') }),
);
const stringMat = new THREE.MeshStandardMaterial({ color: '#f1f3f5', roughness: 0.8 });

function balloonGeometry() {
  return cachedGeo('balloon', () => {
    const prof: [number, number][] = [
      [0.0, 0.0],
      [0.045, 0.015],
      [0.05, 0.05],
      [0.13, 0.11],
      [0.23, 0.23],
      [0.285, 0.38],
      [0.275, 0.52],
      [0.215, 0.65],
      [0.12, 0.73],
      [0.0, 0.76],
    ];
    const g = new THREE.LatheGeometry(
      prof.map(([r, y]) => new THREE.Vector2(r, y)),
      28,
    );
    g.computeVertexNormals();
    return g;
  });
}

function balloonString() {
  return cachedGeo('balloon-string', () => tube(curveFrom([[0, 0, 0], [0.04, -0.25, 0.02], [-0.03, -0.5, -0.02], [0.02, -0.8, 0]], 0), { segments: 16, radial: 4, radius: () => 0.006 }));
}

function Balloons() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const st = useRef({ t: 0 });
  useFrame((_, raw) => {
    const dt = frameDt(raw);
    st.current.t += dt;
    const b = fx.balloons;
    for (let i = 0; i < MAX_BALLOONS; i++) {
      const g = groups.current[i];
      if (!g) continue;
      const it = b.items[i];
      const show = b.active && !!it && it.pop < 1;
      g.visible = show;
      if (!show) continue;
      if (it.popped) it.pop = Math.min(1, it.pop + dt * 14);
      g.position.copy(it.pos);
      g.position.y += Math.sin(st.current.t * 1.6 + i * 1.3) * 0.08;
      g.rotation.z = Math.sin(st.current.t * 1.1 + i) * 0.1;
      g.scale.setScalar(it.popped ? Math.max(0.001, (1 + it.pop * 0.5) * (1 - it.pop)) : 1);
    }
  });
  return (
    <>
      {BALLOON_COLORS.map((_, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} visible={false}>
          <mesh geometry={balloonGeometry()} material={balloonMats[i]} raycast={() => null} />
          <mesh geometry={balloonString()} material={stringMat} raycast={() => null} />
          <mesh
            visible={false}
            position={[0, 0.38, 0]}
            onPointerDown={(ev) => {
              if (!balloonTap) return;
              ev.stopPropagation();
              balloonTap(i);
            }}
          >
            <sphereGeometry args={[0.46, 10, 8]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// -------------------------------------------------------------- fireworks

/** Rockets fly up and burst; while it's fireworks time, a tap anywhere in the sky sends one up. */
function Fireworks() {
  const catching = useGame((s) => s.awaiting === 'fireworks');
  const camera = useThree((s) => s.camera);
  const catcher = useRef<THREE.Mesh>(null);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, raw) => {
    const dt = frameDt(raw);
    if (catcher.current) {
      camera.getWorldDirection(fwd);
      catcher.current.position.copy(camera.position).addScaledVector(fwd, 16);
      catcher.current.quaternion.copy(camera.quaternion);
    }
    for (let i = fx.rockets.length - 1; i >= 0; i--) {
      const r = fx.rockets[i];
      r.t += dt / 0.5;
      const u = ease.outCubic(clamp(r.t, 0, 1));
      const p = r.from.clone().lerp(r.to, u);
      if (r.t < 1) {
        burst('sparkle', p, { count: 1, speed: 0.3, up: 0, gravity: -2, life: 0.4, size: 0.08, colors: ['#fff3a8', '#ffffff'] });
        continue;
      }
      burst('sparkle', r.to, { count: 70, speed: 7.5, spread: 1.2, up: 0.4, gravity: -1.6, life: 1.5, size: 0.16, drag: 1.4, colors: r.colors });
      burst('sparkle', r.to, { count: 24, speed: 3, spread: 1, up: 0.2, gravity: -1, life: 1.9, size: 0.1, drag: 1.2, colors: ['#ffffff'] });
      fx.rockets.splice(i, 1);
    }
  });
  if (!catching) return null;
  return (
    <mesh
      ref={catcher}
      visible={false}
      onPointerDown={(ev) => {
        if (!skyTap) return;
        ev.stopPropagation();
        skyTap(ev.point.clone());
      }}
    >
      <planeGeometry args={[120, 120]} />
    </mesh>
  );
}

// -------------------------------------------------------------- hide and seek

const bushMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });

function Bushes() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const st = useRef({ t: 0 });
  const geos = useMemo(() => [bushGeometry(2), bushGeometry(5), bushGeometry(8)], []);
  useFrame((_, raw) => {
    const dt = frameDt(raw);
    st.current.t += dt;
    const b = fx.bushes;
    for (let i = 0; i < 3; i++) {
      const g = groups.current[i];
      if (!g) continue;
      const it = b.items[i];
      const show = b.active && !!it && it.scale > 0.01;
      g.visible = show;
      if (!show) continue;
      it.wiggle = Math.max(0, it.wiggle - dt * 1.6);
      g.position.copy(it.pos);
      g.rotation.set(0, it.heading, Math.sin(st.current.t * 26) * 0.12 * it.wiggle);
      g.scale.set(it.scale * (1 + Math.sin(st.current.t * 30) * 0.04 * it.wiggle), it.scale, it.scale);
    }
  });
  return (
    <>
      {geos.map((geo, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} visible={false}>
          <mesh geometry={geo} material={bushMat} castShadow raycast={() => null} />
          <mesh
            visible={false}
            position={[0, 0.55, 0]}
            onPointerDown={(ev) => {
              if (!bushTap) return;
              ev.stopPropagation();
              bushTap(i);
            }}
          >
            <sphereGeometry args={[0.95, 10, 8]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// -------------------------------------------------------------- snack time

/** The fruit on Coach Rex's leaf plate, and the colours of their crumbs. */
export const FRUIT = [
  { id: 'watermelon', crumbs: ['#ff5c6c', '#2b8a3e', '#ffd1d6'] },
  { id: 'apple', crumbs: ['#e03131', '#fff3bf'] },
  { id: 'banana', crumbs: ['#ffd43b', '#fff3bf'] },
  { id: 'orange', crumbs: ['#ff922b', '#ffc078'] },
  { id: 'grapes', crumbs: ['#845ef7', '#d0bfff'] },
];
export const FRUIT_SIZE = 1.35;

const fruitMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 });
const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });

function smallLeaf(len: number, tilt: number, at: [number, number, number]) {
  const g = extrude(petalShape(len, len * 0.5), 0.008, 0.004, 6);
  g.rotateZ(tilt);
  g.translate(...at);
  return paint(g, '#51cf66');
}

function fruitGeometry(kind: number): THREE.BufferGeometry {
  return cachedGeo(`fruit-${kind}`, () => {
    if (kind === 0) {
      // a watermelon slice standing on its rind
      const r = 0.3;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.absarc(0, 0, r, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62, false);
      shape.lineTo(0, 0);
      const slice = paint(extrude(shape, 0.08, 0.015, 20), (q) => {
        const d = Math.hypot(q.x, q.y);
        return new THREE.Color(d > r - 0.025 ? '#2b8a3e' : d > r - 0.06 ? '#e9fac8' : '#ff5c6c');
      });
      const seeds = [
        [-0.05, -0.12],
        [0.05, -0.12],
        [0, -0.18],
        [-0.09, -0.19],
        [0.09, -0.19],
      ].flatMap(([x, y]) =>
        [1, -1].map((side) => {
          const seed = new THREE.SphereGeometry(0.013, 6, 4);
          seed.scale(1, 1.6, 0.5);
          seed.translate(x, y, side * 0.056);
          return paint(seed, '#212529');
        }),
      );
      const g = merge([slice, ...seeds]);
      g.translate(0, r + 0.01, 0);
      return g;
    }
    if (kind === 1) {
      // an apple with a stem and a leaf
      const body = paint(
        lathe(
          [
            [0, 0.015],
            [0.09, 0],
            [0.15, 0.05],
            [0.165, 0.13],
            [0.15, 0.21],
            [0.1, 0.26],
            [0.035, 0.245],
            [0, 0.225],
          ],
          20,
          20,
        ),
        (q) => new THREE.Color('#c92a2a').lerp(new THREE.Color('#ff6b6b'), Math.min(1, Math.max(0, q.y / 0.26)) * 0.6),
      );
      const stem = new THREE.CylinderGeometry(0.01, 0.014, 0.09, 6);
      stem.rotateZ(0.2);
      stem.translate(0, 0.27, 0);
      return merge([body, paint(stem, '#7c4a22'), smallLeaf(0.12, -1.0, [0.01, 0.28, 0])]);
    }
    if (kind === 2) {
      // a banana, curved like a smile
      const g = tube(
        curveFrom([
          [-0.22, 0.13, 0],
          [-0.11, 0.05, 0],
          [0, 0.035, 0],
          [0.11, 0.05, 0],
          [0.22, 0.13, 0],
        ]),
        { segments: 24, radial: 10, radius: (t) => 0.012 + 0.055 * Math.pow(Math.sin(Math.PI * t), 0.6) },
      );
      g.translate(0, 0.035, 0);
      return paint(g, (q) => new THREE.Color(Math.abs(q.x) > 0.19 ? '#5c3d1e' : '#ffd43b'));
    }
    if (kind === 3) {
      // an orange with a dimpled peel
      const body = lumpy(sphere(0.15, 20, 14), 0.006, 22, 4);
      body.translate(0, 0.15, 0);
      const nub = sphere(0.016, 6, 4);
      nub.translate(0, 0.298, 0);
      return merge([paint(body, '#ff922b'), paint(nub, '#5c940d'), smallLeaf(0.1, -1.1, [0, 0.29, 0])]);
    }
    // a little pile of grapes with a stem
    const spots: [number, number, number][] = [
      [-0.1, 0.05, 0.04],
      [0, 0.05, 0.06],
      [0.1, 0.05, 0.04],
      [-0.05, 0.05, -0.05],
      [0.05, 0.05, -0.05],
      [-0.05, 0.13, 0.02],
      [0.05, 0.13, 0.02],
      [0, 0.13, -0.06],
      [0, 0.2, 0],
    ];
    const shades = ['#845ef7', '#7048e8', '#9775fa'];
    const balls = spots.map(([x, y, z], i) => {
      const b = sphere(0.055, 12, 8);
      b.translate(x, y, z);
      return paint(b, shades[i % 3]);
    });
    const stem = tube(
      curveFrom([
        [0, 0.24, 0],
        [0.02, 0.3, 0],
        [0.06, 0.33, 0],
      ]),
      { segments: 6, radial: 5, radius: () => 0.012 },
    );
    return merge([...balls, paint(stem, '#5c3d1e')]);
  });
}

/** The big leaf the fruit sits on, lying flat, long side across the view. */
function leafPlateGeometry() {
  return cachedGeo('leaf-plate', () => {
    const g = extrude(petalShape(2.9, 0.75), 0.03, 0.01, 16);
    g.translate(0, -1.45, 0);
    g.rotateZ(Math.PI / 2);
    g.rotateX(-Math.PI / 2);
    return paint(g, (q) => new THREE.Color(Math.abs(q.z) < 0.03 ? '#94d82d' : '#40c057'));
  });
}

function SnackFruit() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const leaf = useRef<THREE.Mesh>(null);
  const st = useRef({ t: 0 });
  useFrame((_, raw) => {
    const dt = frameDt(raw);
    st.current.t += dt;
    const f = fx.fruit;
    if (leaf.current) {
      leaf.current.visible = f.active && f.pop > 0.01;
      leaf.current.position.copy(f.leaf);
      leaf.current.rotation.y = f.heading;
      leaf.current.scale.setScalar(Math.max(0.001, f.pop));
    }
    for (let i = 0; i < FRUIT.length; i++) {
      const g = groups.current[i];
      if (!g) continue;
      const it = f.items[i];
      const show = f.active && !!it && !it.landed && f.pop > 0.01;
      g.visible = show;
      if (!show) continue;
      if (it.flying) {
        // an arc up and into Coach Rex's mouth, spinning and shrinking as it goes
        it.fly = Math.min(1, it.fly + dt / 0.6);
        const u = it.fly;
        g.position.lerpVectors(it.from, it.to, u);
        g.position.y += Math.sin(u * Math.PI) * 0.9;
        g.rotation.x += dt * 9;
        g.scale.setScalar(FRUIT_SIZE * (1 - 0.55 * u));
        if (u >= 1) it.landed = true;
      } else {
        g.position.copy(it.pos);
        g.position.y += Math.abs(Math.sin(st.current.t * 2.4 + i * 1.3)) * 0.03;
        g.rotation.set(0, f.heading + Math.sin(st.current.t * 1.4 + i) * 0.2, 0);
        g.scale.setScalar(FRUIT_SIZE * Math.max(0.001, f.pop));
      }
    }
  });
  return (
    <>
      <mesh ref={leaf} geometry={leafPlateGeometry()} material={leafMat} visible={false} receiveShadow raycast={() => null} />
      {FRUIT.map((_, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} visible={false}>
          <mesh geometry={fruitGeometry(i)} material={fruitMat} castShadow raycast={() => null} />
          <mesh
            visible={false}
            position={[0, 0.15, 0]}
            onPointerDown={(ev) => {
              if (!fruitTap) return;
              ev.stopPropagation();
              fruitTap(i);
            }}
          >
            <sphereGeometry args={[0.3, 10, 8]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// -------------------------------------------------------------- dino band

/** The music rocks, low note to high, in rainbow order. */
export const ROCK_COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7'];
const rockMats = ROCK_COLORS.map(
  (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, emissive: new THREE.Color(c), emissiveIntensity: 0.1, flatShading: true }),
);

function musicRockGeometry() {
  return cachedGeo('music-rock', () => {
    const g = new THREE.IcosahedronGeometry(0.3, 1);
    g.scale(1, 0.78, 1);
    g.translate(0, 0.22, 0);
    g.computeVertexNormals();
    return g;
  });
}

function MusicRocks() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const st = useRef({ t: 0 });
  useFrame((_, raw) => {
    const dt = frameDt(raw);
    st.current.t += dt;
    const r = fx.rocks;
    for (let i = 0; i < ROCK_COLORS.length; i++) {
      const g = groups.current[i];
      if (!g) continue;
      const it = r.items[i];
      const show = r.active && !!it && r.pop > 0.01;
      g.visible = show;
      if (!show) continue;
      it.bounce = Math.max(0, it.bounce - dt * 3.2);
      it.glow = Math.max(0, it.glow - dt * 2.2);
      it.hint = Math.max(0, it.hint - dt * 1.2);
      // a boing when it's tapped, a little wobble when it wants to be
      const k = Math.sin(it.bounce * Math.PI);
      g.position.copy(it.pos);
      g.position.y += 0.1 * k + Math.sin(st.current.t * 2 + i * 1.1) * 0.015;
      g.scale.set(r.pop * (1 - 0.12 * k), r.pop * (1 + 0.3 * k), r.pop * (1 - 0.12 * k));
      g.rotation.set(0, i * 0.7, Math.sin(st.current.t * 20) * 0.14 * it.hint);
      rockMats[i].emissiveIntensity = 0.1 + it.glow * 1.4;
    }
  });
  return (
    <>
      {ROCK_COLORS.map((_, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} visible={false}>
          <mesh geometry={musicRockGeometry()} material={rockMats[i]} castShadow raycast={() => null} />
          <mesh
            visible={false}
            position={[0, 0.2, 0]}
            onPointerDown={(ev) => {
              if (!rockTap) return;
              ev.stopPropagation();
              rockTap(i);
            }}
          >
            <sphereGeometry args={[0.38, 10, 8]} />
          </mesh>
        </group>
      ))}
    </>
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

const wingMat = new THREE.MeshPhysicalMaterial({ color: '#c8a8ff', roughness: 0.6, side: THREE.DoubleSide, sheen: 0.6 });
const pEye = new THREE.MeshBasicMaterial({ color: '#1d1430' });
const pWhite = new THREE.MeshPhysicalMaterial({ color: '#fbf7ee', roughness: 0.2, clearcoat: 1 });
const pteroSkin = skinMaterial({ body: '#9b6dff', belly: '#efe4ff', marks: '#6b46c8' }, { marks: 1, seed: 3 });

/** A sculpted pterosaur body: long beak, swept-back crest, little tail and tucked feet. */
function pteroGeometry(): THREE.BufferGeometry {
  return cachedGeo('ptero-sculpt', () => {
    const s = new Sculpt();
    const r = { bone: 0, belly: 1, dorsal: [0, 1, 0] as [number, number, number], band: [0, 0, 1] as [number, number, number] };
    const h = { bone: 0, belly: 0, dorsal: [0, 1, 0] as [number, number, number] };
    s.add(new Ellipsoid([0, 0, -0.02], [0.19, 0.17, 0.4], r));
    s.add(new Ellipsoid([0, 0.02, 0.2], [0.21, 0.18, 0.2], r), 0.08);
    s.add(new RoundCone([0, 0.05, 0.3], [0, 0.14, 0.5], 0.11, 0.075, r), 0.06);
    s.add(new Ellipsoid([0, 0.17, 0.58], [0.095, 0.085, 0.12], h), 0.05);
    s.add(new RoundCone([0, 0.15, 0.63], [0, 0.1, 1.0], 0.065, 0.012, h), 0.04);
    s.add(new RoundCone([0, 0.2, 0.55], [0, 0.33, 0.3], 0.05, 0.014, h), 0.04);
    s.add(new RoundCone([0, -0.01, -0.36], [0, -0.03, -0.6], 0.07, 0.012, r), 0.05);
    for (const sd of [-1, 1]) {
      s.add(new RoundCone([0.08 * sd, -0.1, -0.22], [0.08 * sd, -0.2, -0.38], 0.035, 0.022, r), 0.03);
      s.sub(new Ellipsoid([0.075 * sd, 0.2, 0.63], [0.03, 0.03, 0.03], h), 0.01);
    }
    return meshSculpt(s, { cell: 0.012, ao: true });
  });
}

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
  const body = useMemo(() => pteroGeometry(), []);
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
        <mesh geometry={body} material={pteroSkin} castShadow raycast={() => null} />
        {[-1, 1].map((s) => (
          <group key={s} position={[0.075 * s, 0.2, 0.635]}>
            <mesh material={pWhite} raycast={() => null}>
              <sphereGeometry args={[0.032, 14, 10]} />
            </mesh>
            <mesh material={pEye} position={[0.012 * s, 0.002, 0.022]} raycast={() => null}>
              <sphereGeometry args={[0.016, 10, 8]} />
            </mesh>
          </group>
        ))}
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
      <PrizeShowcase />
      <HandTarget />
      <IntroStar />
      <Balloons />
      <Fireworks />
      <Bushes />
      <SnackFruit />
      <MusicRocks />
      <Pterodactyl />
    </>
  );
}
