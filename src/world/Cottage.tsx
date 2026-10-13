// Zef's candy cottage: gingerbread walls, a pink frosting roof with icing
// drips and a gumdrop ridge, a chocolate door, glowing sugar-glass windows,
// a striped chimney puffing marshmallow smoke, lollipop trees and a fence.

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  cachedGeo,
  caneCurve,
  curveFrom,
  dripsAlong,
  extrude,
  gumdropGeometry,
  heartShape,
  lollipopDisc,
  lumpy,
  merge,
  paint,
  pipedSwirl,
  roundedBox,
  tube,
} from '../three/geometry';
import { emissive, gloss, jelly, matte, pattern, vcolor } from '../three/materials';
import { Glow, Wobbly } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { stopFrame, stopLocalToWorld } from '../game/route';
import { frameDt } from '../game/actors';
import { mulberry32, randRange } from '../three/util';
import { motion } from '../game/settings';

const W = 4.6;
const D = 3.8;
const H = 2.6;

function wallsGeo() {
  return cachedGeo('cottage-walls', () => {
    const g = roundedBox(W, H, D, 0.22, 4);
    g.translate(0, H / 2, 0);
    lumpy(g, 0.025, 2.5, 4);
    const rng = mulberry32(5);
    const base = new THREE.Color('#d6955a');
    const dark = new THREE.Color('#b8743d');
    paint(g, () => new THREE.Color().copy(base).lerp(dark, rng() < 0.12 ? 0.8 : rng() * 0.25));
    return g;
  });
}

function gableGeo() {
  return cachedGeo('cottage-gable', () => {
    const s = new THREE.Shape();
    s.moveTo(-W / 2 + 0.05, 0);
    s.lineTo(W / 2 - 0.05, 0);
    s.lineTo(0, 1.55);
    s.lineTo(-W / 2 + 0.05, 0);
    const g = extrude(s, D - 0.3, 0.05, 1);
    g.translate(0, H - 0.02, 0);
    paint(g, '#d18f55');
    return g;
  });
}

function roofGeo() {
  return cachedGeo('cottage-roof', () => {
    const slab = (side: number) => {
      const g = roundedBox(2.95, 0.3, D + 0.9, 0.12, 3);
      g.rotateZ(-side * 0.6);
      g.translate(side * 1.2, H + 0.85, 0);
      return g;
    };
    const g = merge([slab(-1), slab(1)]);
    return paint(g, '#ff97c1');
  });
}

function eaveDripsGeo() {
  return cachedGeo('cottage-drips', () => {
    const y = H + 0.03;
    const z = D / 2 + 0.45;
    const parts = [
      dripsAlong([-2.45, y, z], [2.45, y, z], 14, 0.35, 0.07, 11),
      dripsAlong([-2.45, y, -z], [2.45, y, -z], 14, 0.35, 0.07, 12),
      dripsAlong([-2.42, y, -z], [-2.42, y, z], 12, 0.3, 0.07, 13),
      dripsAlong([2.42, y, -z], [2.42, y, z], 12, 0.3, 0.07, 14),
    ];
    // icing along the roof ridge and gable edges
    parts.push(
      tube(curveFrom([[0, H + 1.72, -z], [0, H + 1.72, 0], [0, H + 1.72, z]]), {
        segments: 60,
        radial: 8,
        radius: (t) => 0.1 * (0.8 + 0.3 * Math.abs(Math.sin(t * 40))),
      }),
    );
    return paint(merge(parts), '#ffffff');
  });
}

function cornerPipingGeo() {
  return cachedGeo('cottage-piping', () => {
    const parts: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (W / 2 - 0.02);
        const z = sz * (D / 2 - 0.02);
        parts.push(
          tube(curveFrom([[x, 0.05, z], [x, H / 2, z], [x, H - 0.05, z]]), {
            segments: 30,
            radial: 8,
            radius: (t) => 0.08 * (0.75 + 0.35 * Math.abs(Math.sin(t * 22))),
          }),
        );
      }
    }
    // a frosting band around the base
    const base = new THREE.TorusGeometry(1, 0.08, 6, 4);
    base.rotateX(Math.PI / 2);
    base.rotateY(Math.PI / 4);
    base.scale((W / 2) * 1.414, 1, (D / 2) * 1.414);
    base.translate(0, 0.06, 0);
    parts.push(base);
    return paint(merge(parts), '#ffffff');
  });
}

function shinglesGeo() {
  return cachedGeo('cottage-shingles', () => {
    const rng = mulberry32(21);
    const colors = ['#ffd1e4', '#c9f1ff', '#fff2a8', '#d9c8ff', '#c8f5d6'];
    const parts: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 7; col++) {
          const g = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14);
          const along = -D / 2 - 0.2 + (col + (row % 2) * 0.5) * 0.66;
          if (along > D / 2 + 0.3) continue;
          const u = 0.35 + row * 0.55;
          const x = side * (2.5 - u * Math.cos(0.6));
          const y = H + 0.17 + u * Math.sin(0.6);
          g.rotateZ(-side * 0.6);
          g.translate(x, y, along);
          paint(g, colors[Math.floor(rng() * colors.length)]);
          parts.push(g);
        }
      }
    }
    return merge(parts);
  });
}

function doorShape(w: number, h: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h - w / 2);
  s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, 0);
  return s;
}

function CottageDoor() {
  const hinge = useRef<THREE.Group>(null!);
  const st = useMemo(() => ({ open: 0, target: 0, timer: 0 }), []);
  const doorGeo = useMemo(() => cachedGeo('cottage-door', () => extrude(doorShape(1.1, 1.85), 0.1, 0.03, 16)), []);
  const frameGeo = useMemo(
    () =>
      cachedGeo('cottage-doorframe', () => {
        const pts: [number, number, number][] = [];
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * Math.PI;
          pts.push([Math.cos(a) * 0.66, 1.3 + Math.sin(a) * 0.66, 0]);
        }
        const arch = tube(curveFrom([[0.66, 0, 0], [0.66, 0.65, 0], ...pts, [-0.66, 0.65, 0], [-0.66, 0, 0]]), {
          segments: 90,
          radial: 8,
          radius: (t) => 0.075 * (0.8 + 0.3 * Math.abs(Math.sin(t * 60))),
        });
        return arch;
      }),
    [],
  );
  const heartGeo = useMemo(() => cachedGeo('cottage-doorheart', () => extrude(heartShape(0.32), 0.04, 0.015, 10)), []);
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    if (st.timer > 0) {
      st.timer -= dt;
      if (st.timer <= 0) {
        st.target = 0;
        sfx.play('creak');
      }
    }
    st.open = THREE.MathUtils.damp(st.open, st.target, 4, dt);
    hinge.current.rotation.y = -st.open * 1.6;
  });
  const tap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    st.target = st.target > 0.5 ? 0 : 1;
    st.timer = st.target > 0.5 ? 4 : 0;
    sfx.play('creak');
    burst('sparkle', e.point, { count: 10 });
  };
  return (
    <group position={[0, 0, -D / 2 - 0.02]}>
      <mesh geometry={frameGeo} material={gloss('#ffffff', 0.4, 0.4)} />
      {/* warm light inside, seen when the door opens */}
      <mesh position={[0, 0.9, 0.06]}>
        <planeGeometry args={[1.1, 1.8]} />
        <meshBasicMaterial color="#ffd27a" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <group ref={hinge} position={[-0.55, 0, -0.06]}>
        <group position={[0.55, 0, 0]}>
          <mesh geometry={doorGeo} material={gloss('#6e3b22', 0.4, 0.5)} castShadow onPointerDown={tap} />
          <mesh geometry={heartGeo} material={emissive('#ffb3c9', 0.9)} position={[0, 1.35, -0.07]} />
          <mesh material={pattern({ a: '#ffffff', b: '#ff4f8a', mode: 'spiral', freq: 3, twist: 18 })} position={[0.36, 0.95, -0.1]}>
            <cylinderGeometry args={[0.09, 0.09, 0.05, 24]} />
          </mesh>
        </group>
      </group>
      {/* invisible bigger tap target */}
      <mesh visible={false} position={[0, 0.95, -0.2]} onPointerDown={tap}>
        <boxGeometry args={[1.4, 2.0, 0.4]} />
      </mesh>
    </group>
  );
}

function Window({ x, y }: { x: number; y: number }) {
  const glow = useRef<THREE.Sprite>(null!);
  const st = useMemo(() => ({ t: 0, flash: 0 }), []);
  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    st.flash = Math.max(0, st.flash - dt * 0.8);
    const flicker = 0.85 + Math.sin(state.clock.elapsedTime * 2.1 + x) * 0.05;
    glow.current.scale.setScalar(1.5 + st.flash * 1.5);
    (glow.current.material as THREE.SpriteMaterial).opacity = 0.35 * flicker + st.flash * 0.4;
  });
  return (
    <Wobbly
      position={[x, y, -D / 2 - 0.04]}
      sound="sparkle"
      particles="sparkle"
      onTap={() => {
        st.flash = 1;
      }}
    >
      <mesh material={emissive('#ffe2a0', 0.9)} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.05, 28]} />
      </mesh>
      <mesh material={gloss('#ffffff', 0.4, 0.3)}>
        <torusGeometry args={[0.38, 0.07, 10, 28]} />
      </mesh>
      <mesh material={gloss('#d81f3c', 0.35, 0.6)} position={[0, 0, -0.03]}>
        <boxGeometry args={[0.06, 0.72, 0.04]} />
      </mesh>
      <mesh material={gloss('#d81f3c', 0.35, 0.6)} position={[0, 0, -0.03]}>
        <boxGeometry args={[0.72, 0.06, 0.04]} />
      </mesh>
      {/* flower box */}
      <mesh material={matte('#ff8fb8', 0.6)} position={[0, -0.5, -0.12]}>
        <boxGeometry args={[0.85, 0.18, 0.22]} />
      </mesh>
      {[-0.28, 0, 0.28].map((fx, i) => (
        <mesh key={i} geometry={cachedGeo('mini-swirl', () => pipedSwirl({ radius: 0.09, height: 0.1, thickness: 0.035, turns: 2 }))} material={matte(['#fff27a', '#ffffff', '#b9f2ff'][i], 0.5)} position={[fx, -0.4, -0.12]} />
      ))}
      <Glow ref={glow} color="#ffcf6b" size={1.5} opacity={0.35} position={[0, 0, -0.15]} />
    </Wobbly>
  );
}

function Chimney() {
  const st = useMemo(() => ({ t: 0, hearts: 0 }), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    st.t += dt;
    const every = motion.reduced ? 2.2 : 0.9;
    if (st.t > every) {
      st.t = 0;
      ref.current.getWorldPosition(pos);
      pos.y += 0.9;
      burst('puff', pos, { count: 1, speed: 0.2, up: 0.9, life: 3.2, size: 0.32, gravity: 0.15 });
    }
  });
  return (
    <group ref={ref} position={[1.25, H + 1.15, 0.7]}>
      <Wobbly
        sound="bloop"
        particles="heart"
        hit={0.8}
        hitOffset={[0, 0.6, 0]}
        onTap={() => {
          const p = new THREE.Vector3();
          ref.current.getWorldPosition(p);
          p.y += 1;
          burst('heart', p, { count: 8, up: 1.6, size: 0.18 });
          burst('puff', p, { count: 4, up: 1.2, size: 0.4 });
        }}
      >
        <mesh material={pattern({ a: '#ffffff', b: '#ff5a7a', mode: 'helix', freq: 4, twist: 5 })} position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.36, 1.3, 28]} />
        </mesh>
        <mesh material={gloss('#ffffff', 0.4, 0.3)} position={[0, 0.98, 0]}>
          <torusGeometry args={[0.36, 0.1, 10, 28]} />
        </mesh>
      </Wobbly>
    </group>
  );
}

function LollipopTree({ position, color, seed }: { position: [number, number, number]; color: string; seed: number }) {
  const mat = useMemo(() => pattern({ a: '#ffffff', b: color, mode: 'spiral', freq: 2, twist: 9 }), [color]);
  return (
    <Wobbly position={position} spin sound="squeak" particles="sparkle" hit={0.9} hitOffset={[0, 1.8, 0]}>
      <mesh material={matte('#fff8ee', 0.5)} position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 1.8, 10]} />
      </mesh>
      <mesh geometry={cachedGeo('lolli-disc', () => lollipopDisc(0.62, 0.16))} material={mat} position={[0, 2.25, 0]} rotation={[0, seed, 0]} castShadow />
      <mesh material={gloss('#ff6fa5', 0.3, 0.6)} position={[0, 1.66, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.08, 0.035, 6, 14]} />
      </mesh>
    </Wobbly>
  );
}

function fenceGeo() {
  return cachedGeo('wafer-fence', () => {
    const parts: THREE.BufferGeometry[] = [];
    const rng = mulberry32(3);
    const run = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.ceil(len / 0.42);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        const h = 0.75 + randRange(rng, -0.05, 0.05);
        const p = roundedBox(0.2, h, 0.08, 0.04, 2);
        p.translate(x, h / 2, z);
        p.rotateY(0);
        parts.push(p);
      }
      const rail = roundedBox(len, 0.08, 0.06, 0.03, 2);
      rail.rotateY(-Math.atan2(z1 - z0, x1 - x0));
      rail.translate((x0 + x1) / 2, 0.5, (z0 + z1) / 2);
      parts.push(rail);
    };
    run(-6.5, -1.5, -3.2, -2.6);
    run(3.2, -2.6, 6.5, -1.5);
    run(-6.5, -1.5, -6.8, 3.5);
    run(6.5, -1.5, 6.8, 3.5);
    return paint(merge(parts), '#f2c27a');
  });
}

function caneGeo() {
  return cachedGeo('porch-cane', () =>
    tube(caneCurve(1.9, 0.28), { segments: 80, radial: 12, radius: () => 0.075 }),
  );
}

export function Cottage() {
  const frame = useMemo(() => stopFrame(0), []);
  const pos = useMemo(() => stopLocalToWorld(0, [0, 0, 7.6]), []);
  const caneMat = useMemo(() => pattern({ a: '#ffffff', b: '#ff3b5c', mode: 'uv', freq: 26, twist: 1 }), []);
  const ridge = useMemo(() => {
    const colors = ['#ff5a7a', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc', '#ffa94d'];
    return Array.from({ length: 6 }, (_, i) => ({ z: -D / 2 - 0.2 + (i + 0.5) * ((D + 0.4) / 6), color: colors[i] }));
  }, []);
  return (
    <group position={pos} rotation={[0, frame.yaw, 0]}>
      <mesh geometry={wallsGeo()} material={vcolor(0.85, 'cookie')} castShadow receiveShadow />
      <mesh geometry={gableGeo()} material={vcolor(0.85, 'cookie')} castShadow />
      <mesh geometry={roofGeo()} material={vcolor(0.55, 'roof')} castShadow />
      <mesh geometry={shinglesGeo()} material={vcolor(0.35, 'shingles')} />
      <mesh geometry={eaveDripsGeo()} material={vcolor(0.4, 'icing')} />
      <mesh geometry={cornerPipingGeo()} material={vcolor(0.4, 'icing')} />
      {ridge.map((r, i) => (
        <Wobbly key={i} position={[0, H + 1.78, r.z]} sound="chime" soundArg={i + 3} particles="sparkle" hit={0.35}>
          <mesh geometry={gumdropGeometry()} material={jelly(r.color)} scale={0.45} />
        </Wobbly>
      ))}
      {/* round attic window on the front gable */}
      <mesh material={emissive('#ffd98a', 0.8)} position={[0, H + 0.62, -D / 2 + 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.06, 24]} />
      </mesh>
      <mesh material={gloss('#ffffff', 0.4, 0.3)} position={[0, H + 0.62, -D / 2 + 0.06]}>
        <torusGeometry args={[0.32, 0.06, 8, 24]} />
      </mesh>
      <CottageDoor />
      <Window x={-1.45} y={1.35} />
      <Window x={1.45} y={1.35} />
      <Chimney />
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} geometry={caneGeo()} material={caneMat} position={[x, 0, -D / 2 - 0.35]} rotation={[0, x < 0 ? Math.PI : 0, 0]} castShadow />
      ))}
      <mesh geometry={fenceGeo()} material={vcolor(0.7, 'fence')} castShadow />
      <LollipopTree position={[-4.6, 0, -0.5]} color="#ff4f8a" seed={0.3} />
      <LollipopTree position={[4.7, 0, 0.6]} color="#7b5cff" seed={1.2} />
      <LollipopTree position={[-5.4, 0, 2.6]} color="#20c997" seed={2.2} />
      {/* gumdrop bushes */}
      {[
        [-3.2, -2.3, '#ff6b8b'],
        [-2.6, -2.5, '#ffd43b'],
        [2.7, -2.5, '#69db7c'],
        [3.3, -2.3, '#4dabf7'],
      ].map(([x, z, c], i) => (
        <Wobbly key={i} position={[x as number, 0, z as number]} sound="boing" soundArg={i} particles="sparkle" hit={0.45}>
          <mesh geometry={gumdropGeometry()} material={jelly(c as string)} scale={[0.75, 0.7, 0.75]} castShadow />
        </Wobbly>
      ))}
      {/* doorstep */}
      <mesh material={matte('#ffe0ec', 0.6)} position={[0, 0.06, -D / 2 - 0.55]} receiveShadow>
        <cylinderGeometry args={[0.9, 0.95, 0.12, 32]} />
      </mesh>
    </group>
  );
}

