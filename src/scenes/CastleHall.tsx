// The grand caramel-fountain hall inside the castle. Zef can walk around and
// tap: the fountain (a caramel surge), the gumdrop chandelier (spins and
// changes colour), the cake throne (Zef sits and gets a crown), the licorice
// organ (plays a tune), the gingerbread guards (salute), the moonlit garden
// doorway and the doors back outside.

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useRoom, walkToThen, type RoomSpec } from './roomCommon';
import { cachedGeo, curveFrom, extrude, gumdropGeometry, heartShape, lathe, merge, paint, roundedBox, strawberryGeometry, tube } from '../three/geometry';
import { emissive, gloss, jelly, matte, pattern, vcolor } from '../three/materials';
import { makeFlowMaterial } from '../three/shaders';
import { Glow, Wobbly } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pipReact, zef, zefPlay } from '../game/actors';
import { useGame } from '../state/store';
import { leaveCastle } from '../game/director';
import { Spring, TAU } from '../three/util';
import { motion } from '../game/settings';

export const HALL: RoomSpec = {
  bounds: { minX: -6.6, maxX: 6.6, minZ: -6.2, maxZ: 5.6 },
  obstacles: [{ x: 0, z: -1.5, r: 2.7 }],
  start: new THREE.Vector3(0, 0, 4.8),
  camOffset: new THREE.Vector3(0, 6.2, 9.2),
  camXRange: [-2.2, 2.2],
  camZRange: [-3, 4.5],
  lookAhead: 3.2,
  fit: 9,
};

const CARAMEL = '#d98a2b';

function floorGeometry() {
  return cachedGeo('hall-floor', () => {
    const g = new THREE.PlaneGeometry(18, 18, 18, 18);
    g.rotateX(-Math.PI / 2);
    const nonIndexed = g.toNonIndexed();
    const pos = nonIndexed.getAttribute('position') as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const a = new THREE.Color('#fff2dc');
    const b = new THREE.Color('#7a4528');
    for (let i = 0; i < pos.count; i += 3) {
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const c = (Math.floor(cx + 9) + Math.floor(cz + 9)) % 2 === 0 ? a : b;
      for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
    }
    nonIndexed.setAttribute('color', new THREE.BufferAttribute(col, 3));
    nonIndexed.computeVertexNormals();
    return nonIndexed;
  });
}

function wallsGeometry() {
  return cachedGeo('hall-walls', () => {
    const parts: THREE.BufferGeometry[] = [];
    const back = roundedBox(18, 9, 0.6, 0.2, 2);
    back.translate(0, 4.5, -7.6);
    parts.push(paint(back, '#ffc9dc'));
    for (const sx of [-1, 1]) {
      const side = roundedBox(0.6, 9, 16, 0.2, 2);
      side.translate(sx * 8.2, 4.5, 0);
      parts.push(paint(side, '#ffd6e5'));
      // wafer pilasters
      for (let z = -6; z <= 6; z += 3) {
        const p = roundedBox(0.5, 8.6, 0.7, 0.15, 2);
        p.translate(sx * 7.85, 4.3, z);
        parts.push(paint(p, '#f2c27a'));
      }
    }
    for (let x = -6; x <= 6; x += 3) {
      const p = roundedBox(0.7, 8.6, 0.5, 0.15, 2);
      p.translate(x, 4.3, -7.25);
      parts.push(paint(p, '#f2c27a'));
    }
    // frosting cornice along the top
    parts.push(paint(tube(curveFrom([[-8, 8.6, -7.2], [0, 8.6, -7.2], [8, 8.6, -7.2]]), { segments: 120, radial: 8, radius: (t) => 0.22 * (0.8 + 0.3 * Math.abs(Math.sin(t * 90))) }), '#ffffff'));
    for (const sx of [-1, 1]) parts.push(paint(tube(curveFrom([[sx * 7.8, 8.6, -7], [sx * 7.8, 8.6, 0], [sx * 7.8, 8.6, 7]]), { segments: 110, radial: 8, radius: (t) => 0.22 * (0.8 + 0.3 * Math.abs(Math.sin(t * 80))) }), '#ffffff'));
    return merge(parts);
  });
}

function windowGeometry() {
  return cachedGeo('hall-window', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.7, 0);
    s.lineTo(0.7, 0);
    s.lineTo(0.7, 2.2);
    s.absarc(0, 2.2, 0.7, 0, Math.PI, false);
    s.lineTo(-0.7, 0);
    return extrude(s, 0.08, 0.03, 16);
  });
}

function fountainGeometry() {
  return cachedGeo('hall-fountain', () => {
    const basin = lathe(
      [
        [0, 0],
        [2.3, 0],
        [2.45, 0.2],
        [2.4, 0.7],
        [2.15, 0.72],
        [2.1, 0.4],
        [0.5, 0.35],
        [0.42, 1.4],
        [1.3, 1.55],
        [1.38, 1.75],
        [1.15, 1.78],
        [0.3, 1.6],
        [0.24, 2.5],
        [0.65, 2.6],
        [0.7, 2.78],
        [0.5, 2.8],
        [0.12, 2.75],
        [0.1, 3.3],
        [0, 3.35],
      ],
      48,
      60,
    );
    paint(basin, (p) => new THREE.Color('#fff1f6').lerp(new THREE.Color('#ffc2da'), Math.min(1, Math.abs(Math.sin(p.y * 3)) * 0.6)));
    return basin;
  });
}

/** Caramel curtains spilling from the fountain's bowls. */
function fallGeometry(r0: number, r1: number, y0: number, y1: number) {
  return cachedGeo(`hall-fall-${r0}-${y0}`, () => {
    const g = new THREE.CylinderGeometry(r0, r1, y0 - y1, 48, 6, true);
    g.translate(0, (y0 + y1) / 2, 0);
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    const len = new Float32Array(uv.count);
    for (let i = 0; i < uv.count; i++) {
      // flow runs downward: use vertical uv as "along"
      len[i] = (1 - uv.getY(i)) * (y0 - y1) * 3;
      uv.setXY(i, 1 - uv.getY(i), uv.getX(i));
    }
    g.setAttribute('flowLen', new THREE.BufferAttribute(len, 1));
    return g;
  });
}

function poolGeometry(r: number, y: number) {
  return cachedGeo(`hall-pool-${r}`, () => {
    const g = new THREE.CircleGeometry(r, 48);
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, 0);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    const len = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const rr = Math.hypot(pos.getX(i), pos.getZ(i)) / r;
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      len[i] = rr * 3 + a * 0.3;
      uv.setXY(i, rr, 0.5 + 0.4 * Math.sin(a * 3));
    }
    g.setAttribute('flowLen', new THREE.BufferAttribute(len, 1));
    return g;
  });
}

function Fountain() {
  const mats = useMemo(
    () => [
      makeFlowMaterial({ deep: '#a85a12', shallow: '#f0a84a', foam: '#ffd9a0', speed: 1.2, sparkle: 0.8, gloss: 1.5, scale: 1 }),
      makeFlowMaterial({ deep: '#b8661a', shallow: '#f5b860', foam: '#ffe2b0', speed: 0.3, sparkle: 0.9, gloss: 1.6, scale: 1 }),
    ],
    [],
  );
  const st = useMemo(() => ({ surge: 0, dropT: 0 }), []);
  const spout = useRef<THREE.Mesh>(null!);
  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    st.surge = Math.max(0, st.surge - dt * 0.35);
    mats[0].uniforms.speed.value = 1.2 + st.surge * 2.5;
    spout.current.scale.set(1, 1 + st.surge * 1.5 + Math.sin(state.clock.elapsedTime * 6) * 0.05, 1);
    st.dropT += dt * (1 + st.surge * 8) * motion.scale;
    if (st.dropT > 0.25) {
      st.dropT = 0;
      burst('drop', new THREE.Vector3(0, 3.6 + st.surge * 1.5, -1.5), { count: st.surge > 0.1 ? 4 : 1, colors: [CARAMEL, '#f0a84a'], speed: 1.2 + st.surge * 2, up: 1.5 + st.surge * 3, size: 0.06 });
    }
  });
  const tap = () => {
    st.surge = 1;
    sfx.play('bloop');
    setTimeout(() => sfx.play('bloop'), 150);
    setTimeout(() => sfx.play('splash'), 450);
    burst('drop', new THREE.Vector3(0, 3.6, -1.5), { count: 30, colors: [CARAMEL, '#f0a84a', '#ffd9a0'], speed: 3, up: 5, size: 0.08 });
    burst('sparkle', new THREE.Vector3(0, 3.8, -1.5), { count: 16 });
    zef.expression = 'wow';
    zefPlay('lookUp', 1.4);
    pipReact('surprised', 1.2);
    setTimeout(() => (zef.expression = 'smile'), 1600);
  };
  return (
    <group position={[0, 0, -1.5]}>
      <mesh geometry={fountainGeometry()} material={vcolor(0.25, 'fountain')} castShadow receiveShadow />
      <mesh geometry={poolGeometry(2.12, 0.6)} material={mats[1]} />
      <mesh geometry={poolGeometry(1.15, 1.7)} material={mats[1]} />
      <mesh geometry={poolGeometry(0.5, 2.72)} material={mats[1]} />
      <mesh geometry={fallGeometry(1.33, 1.6, 1.74, 0.62)} material={mats[0]} />
      <mesh geometry={fallGeometry(0.68, 0.9, 2.76, 1.72)} material={mats[0]} />
      <mesh ref={spout} material={gloss(CARAMEL, 0.1, 1)} position={[0, 3.35, 0]}>
        <sphereGeometry args={[0.16, 14, 10]} />
      </mesh>
      <Glow color="#ffc56b" size={4} opacity={0.25} position={[0, 2, 0]} />
      <mesh
        visible={false}
        position={[0, 1.6, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          tap();
        }}
      >
        <cylinderGeometry args={[2.6, 2.6, 3.6, 16]} />
      </mesh>
    </group>
  );
}

const CHANDELIER_PALETTES = [
  ['#ff6b8b', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'],
  ['#fff3bf', '#ffd8a8', '#ffc9c9', '#eebefa', '#d0ebff'],
  ['#ff922b', '#f783ac', '#9775fa', '#3bc9db', '#a9e34b'],
];

function Chandelier() {
  const g = useRef<THREE.Group>(null!);
  const lights = useRef<(THREE.Mesh | null)[]>([]);
  const st = useMemo(() => ({ spin: 0, a: 0, palette: 0, swing: new Spring(0, 30, 2) }), []);
  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    st.spin *= Math.exp(-0.8 * dt);
    st.a += (0.15 + st.spin) * dt;
    const sw = st.swing.update(dt);
    g.current.rotation.set(sw * 0.15, st.a, sw * 0.1);
    lights.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.2 + Math.sin(state.clock.elapsedTime * 3 + i) * 0.3;
    });
  });
  const tap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    st.spin += 3;
    st.swing.kick(3);
    st.palette = (st.palette + 1) % CHANDELIER_PALETTES.length;
    lights.current.forEach((m, i) => {
      if (!m) return;
      const c = CHANDELIER_PALETTES[st.palette][i % 5];
      (m.material as THREE.MeshStandardMaterial).color.set(c);
      (m.material as THREE.MeshStandardMaterial).emissive.set(c);
    });
    [0, 2, 4, 7].forEach((n, k) => setTimeout(() => sfx.play('chime', n + 5), k * 90));
    burst('sparkle', e.point, { count: 20 });
  };
  return (
    <group position={[0, 7.4, -1.5]}>
      <mesh material={gloss('#ffd23f', 0.3, 0.8)} position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.8, 6]} />
      </mesh>
      <group ref={g}>
        <mesh material={gloss('#ffd23f', 0.25, 0.8)} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.5, 0.07, 10, 40]} />
        </mesh>
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * TAU;
          const c = CHANDELIER_PALETTES[0][i % 5];
          return (
            <group key={i} position={[Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5]}>
              <mesh ref={(m) => (lights.current[i] = m)} geometry={gumdropGeometry(16)} position={[0, 0.05, 0]} scale={0.32}>
                <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.3} toneMapped={false} />
              </mesh>
            </group>
          );
        })}
        <Glow color="#ffe8a8" size={4.5} opacity={0.3} />
      </group>
      <mesh visible={false} onPointerDown={tap}>
        <sphereGeometry args={[2.2, 10, 8]} />
      </mesh>
    </group>
  );
}

function throneGeometry() {
  return cachedGeo('hall-throne', () => {
    const parts: THREE.BufferGeometry[] = [];
    const seat = lathe(
      [
        [0, 0],
        [1.0, 0],
        [1.02, 0.5],
        [0.98, 0.85],
        [0, 0.88],
      ],
      36,
      10,
    );
    paint(seat, (p) => (Math.abs(p.y - 0.45) < 0.06 ? new THREE.Color('#e3263f') : new THREE.Color('#fff1e0')));
    parts.push(seat);
    const back = extrude(heartShape(2.6), 0.35, 0.1, 24);
    back.rotateY(Math.PI);
    back.translate(0, 2.0, -0.75);
    parts.push(paint(back, '#ff8fb8'));
    const cushion = roundedBox(1.5, 0.22, 1.2, 0.1, 3);
    cushion.translate(0, 0.98, 0.05);
    parts.push(paint(cushion, '#b197fc'));
    const cherry = new THREE.SphereGeometry(0.28, 16, 12);
    cherry.translate(0, 3.25, -0.75);
    parts.push(paint(cherry, '#e3123a'));
    return merge(parts);
  });
}

function organGeometry() {
  return cachedGeo('hall-organ', () => {
    const parts: THREE.BufferGeometry[] = [];
    const body = roundedBox(2.6, 1.1, 1.0, 0.15, 3);
    body.translate(0, 0.55, 0);
    parts.push(paint(body, '#5b2f18'));
    for (let k = 0; k < 14; k++) {
      const key = roundedBox(0.16, 0.06, 0.4, 0.02, 1);
      key.translate(-1.04 + k * 0.16, 1.13, 0.35);
      parts.push(paint(key, k % 3 === 1 ? '#2b1a1f' : '#ffffff'));
    }
    return merge(parts);
  });
}

function Organ() {
  const pipes = useRef<(THREE.Group | null)[]>([]);
  const st = useMemo(() => ({ springs: Array.from({ length: 7 }, () => new Spring(0, 200, 8)) }), []);
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    pipes.current.forEach((p, i) => {
      if (!p) return;
      const v = st.springs[i].update(dt);
      p.scale.set(1 + v * 0.3, 1 - v * 0.4 + 0, 1 + v * 0.3);
    });
  });
  const tune = [0, 2, 4, 5, 4, 2, 4, 7];
  const play = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    tune.forEach((n, k) =>
      setTimeout(() => {
        sfx.play('organ', n);
        st.springs[(n + k) % 7].kick(-5);
        burst('note', new THREE.Vector3(-6.4 + ((n + k) % 7) * 0.32 - 1, 3.4, -4), { count: 1 });
      }, k * 220),
    );
    zefPlay('clap', 2);
    pipReact('dance', 2.2);
  };
  return (
    <group position={[-6.4, 0, -4]} rotation={[0, Math.PI / 2, 0]}>
      <mesh geometry={organGeometry()} material={vcolor(0.45, 'organ')} castShadow />
      {Array.from({ length: 7 }, (_, i) => {
        const h = 1.4 + Math.sin((i / 6) * Math.PI) * 1.6;
        return (
          <group key={i} ref={(g) => (pipes.current[i] = g)} position={[-0.96 + i * 0.32, 1.1, -0.3]}>
            <mesh material={pattern({ a: i % 2 ? '#2b1a1f' : '#e3182f', b: i % 2 ? '#e3182f' : '#2b1a1f', mode: 'helix', freq: 5, twist: 0.4 })} position={[0, h / 2, 0]}>
              <cylinderGeometry args={[0.12, 0.12, h, 14]} />
            </mesh>
            <mesh material={gloss('#ffd23f', 0.3, 0.7)} position={[0, h, 0]}>
              <torusGeometry args={[0.12, 0.03, 6, 14]} />
            </mesh>
          </group>
        );
      })}
      <mesh visible={false} position={[0, 1.6, 0]} onPointerDown={play}>
        <boxGeometry args={[3, 3.4, 1.6]} />
      </mesh>
    </group>
  );
}

function Guard({ position, rotY }: { position: [number, number, number]; rotY: number }) {
  const arm = useRef<THREE.Group>(null!);
  const st = useMemo(() => ({ t: -1 }), []);
  const bodyGeo = useMemo(
    () =>
      cachedGeo('guard-body', () => {
        const s = new THREE.Shape();
        const pts: [number, number][] = [
          [-0.3, 0], [-0.32, 0.6], [-0.5, 0.65], [-0.48, 0.85], [-0.28, 0.9], [-0.25, 1.1], [-0.3, 1.35], [-0.18, 1.6],
          [0, 1.65], [0.18, 1.6], [0.3, 1.35], [0.25, 1.1], [0.28, 0.9], [0.48, 0.85], [0.5, 0.65], [0.32, 0.6], [0.3, 0],
        ];
        s.moveTo(pts[0][0], pts[0][1]);
        pts.slice(1).forEach(([x, y]) => s.lineTo(x, y));
        const g = extrude(s, 0.18, 0.06, 4);
        paint(g, '#c98a50');
        const icing: THREE.BufferGeometry[] = [];
        for (const y of [0.45, 0.75, 1.0]) {
          const b = new THREE.SphereGeometry(0.05, 8, 6);
          b.translate(0, y, 0.13);
          icing.push(paint(b, ['#ff6b8b', '#69db7c', '#4dabf7'][Math.round(y * 3) % 3]));
        }
        for (const sx of [-0.09, 0.09]) {
          const e = new THREE.SphereGeometry(0.035, 8, 6);
          e.translate(sx, 1.38, 0.13);
          icing.push(paint(e, '#ffffff'));
        }
        const smile = new THREE.TorusGeometry(0.07, 0.015, 6, 12, Math.PI);
        smile.rotateZ(Math.PI);
        smile.translate(0, 1.27, 0.13);
        icing.push(paint(smile, '#ffffff'));
        return merge([g, ...icing]);
      }),
    [],
  );
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    if (st.t >= 0) {
      st.t += dt;
      const k = st.t < 1.4 ? Math.sin(Math.min(1, st.t * 3) * Math.PI * 0.5) : Math.max(0, 1 - (st.t - 1.4) * 2);
      arm.current.rotation.z = -k * 2.4;
      if (st.t > 2) st.t = -1;
    }
  });
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Wobbly
        sound="drum"
        particles="sparkle"
        hit={0.8}
        hitOffset={[0, 0.9, 0]}
        onTap={() => {
          st.t = 0;
          setTimeout(() => sfx.play('fanfare'), 200);
        }}
      >
        <mesh geometry={bodyGeo} material={vcolor(0.6, 'guard')} castShadow />
        <group ref={arm} position={[0.45, 0.78, 0]}>
          <mesh material={pattern({ a: '#ffffff', b: '#ff3b5c', mode: 'helix', freq: 1, twist: 8 })} position={[0.05, 0.6, 0.12]}>
            <cylinderGeometry args={[0.035, 0.035, 1.6, 8]} />
          </mesh>
        </group>
        <mesh material={matte('#ff4f8a', 0.6)} position={[0, 1.72, 0]} scale={[1, 0.5, 1]}>
          <sphereGeometry args={[0.2, 12, 8]} />
        </mesh>
      </Wobbly>
    </group>
  );
}

function Throne({ onSit }: { onSit: () => void }) {
  return (
    <group position={[0, 0, -6.1]}>
      <mesh geometry={throneGeometry()} material={vcolor(0.45, 'throne')} castShadow receiveShadow />
      <mesh
        visible={false}
        position={[0, 1.4, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSit();
        }}
      >
        <boxGeometry args={[2.4, 3.2, 1.8]} />
      </mesh>
      {[-1.6, 1.6].map((x) => (
        <group key={x} position={[x, 0, 0.3]}>
          <mesh geometry={strawberryGeometry(4, 30)} material={vcolor(0.3, 'berry')} position={[0, 0.62 * 0.6, 0]} scale={0.6} />
        </group>
      ))}
    </group>
  );
}

function Doorway({ position, rotY, color, glow, onTap, label }: { position: [number, number, number]; rotY: number; color: string; glow: string; onTap: () => void; label: string }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh geometry={windowGeometry()} material={gloss(color, 0.4, 0.4)} scale={[1.45, 1.25, 1]} position={[0, 0, -0.06]} />
      <mesh geometry={windowGeometry()} material={emissive(glow, 0.9)} scale={[1.25, 1.15, 1]} position={[0, 0, 0.02]} />
      <Glow color={glow} size={4} opacity={0.4} position={[0, 2, 0.4]} />
      <mesh
        visible={false}
        position={[0, 1.8, 0.5]}
        name={label}
        onPointerDown={(e) => {
          e.stopPropagation();
          onTap();
        }}
      >
        <boxGeometry args={[2.6, 3.8, 1.2]} />
      </mesh>
    </group>
  );
}

export function CastleHall() {
  const { onFloor } = useRoom(HALL, true);
  const floorMat = useMemo(() => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, clearcoat: 0.6 }), []);
  const winColors = ['#ff6b8b', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'];
  const sitting = useRef(false);

  const sitOnThrone = () => {
    if (useGame.getState().cutscene) return;
    if (sitting.current) {
      sitting.current = false;
      zef.scripted = false;
      zef.crown = false;
      zef.pos.set(0, 0, -4.3);
      zefPlay('jump', 0.8);
      return;
    }
    walkToThen(HALL, new THREE.Vector3(0, 0, -4.4), () => {
      sitting.current = true;
      zef.scripted = true;
      zef.pos.set(0, 0.92, -5.95);
      zef.heading = 0;
      zefPlay('sit', 999, true);
      zef.crown = true;
      zef.expression = 'happy';
      sfx.play('fanfare');
      burst('confetti', new THREE.Vector3(0, 3, -5.4), { count: 50 });
      burst('sparkle', new THREE.Vector3(0, 2.4, -5.6), { count: 24, colors: ['#ffd23f', '#fff3bf'] });
      pipReact('cheer', 1.6);
      setTimeout(() => (zef.expression = 'smile'), 2200);
    });
  };

  const goGarden = () => {
    if (useGame.getState().cutscene) return;
    if (sitting.current) sitOnThrone();
    walkToThen(HALL, new THREE.Vector3(5.6, 0, -5.4), () => {
      useGame.getState().set({ fade: 1 });
      setTimeout(() => {
        useGame.getState().set({ room: 'garden' });
        setTimeout(() => useGame.getState().set({ fade: 0 }), 250);
      }, 550);
    });
  };

  const goOutside = () => {
    if (useGame.getState().cutscene) return;
    zef.crown = false;
    zef.scripted = false;
    walkToThen(HALL, new THREE.Vector3(-5.8, 0, 3.6), () => void leaveCastle());
  };

  return (
    <group>
      <color attach="background" args={['#3b2236']} />
      <fog attach="fog" args={['#3b2236', 18, 40]} />
      <hemisphereLight args={['#fff1e6', '#a0688a', 1.3]} />
      <directionalLight position={[-4, 9, 6]} intensity={1.8} color="#ffe6c8" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-radius={4} shadow-bias={-0.0005} />
      <pointLight position={[0, 6.5, -1.5]} intensity={18} distance={14} color="#ffc56b" />

      <mesh geometry={floorGeometry()} material={floorMat} receiveShadow onPointerDown={onFloor} />
      {/* carpet runner */}
      <mesh material={matte('#e3456f', 0.85)} position={[0, 0.015, 0.3]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[1.8, 12]} />
      </mesh>
      <mesh geometry={wallsGeometry()} material={vcolor(0.75, 'hall-walls')} receiveShadow />
      {/* stained candy windows */}
      {[-4.5, -1.5, 1.5, 4.5].map((x, i) => (
        <group key={x} position={[x, 3.6, -7.25]}>
          <mesh geometry={windowGeometry()} material={emissive(winColors[i], 0.75)} />
          <Glow color={winColors[i]} size={3} opacity={0.3} position={[0, 2, 0.5]} />
        </group>
      ))}
      {/* candy cane pillars */}
      {[-5, 5].flatMap((x) => [-3.5, 0.5, 4.5].map((z) => [x, z] as [number, number])).map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh material={pattern({ a: '#ffffff', b: '#ff3b5c', mode: 'helix', freq: 2, twist: 1.6 })} position={[0, 4.2, 0]} castShadow>
            <cylinderGeometry args={[0.38, 0.42, 8.4, 24]} />
          </mesh>
          <mesh material={gloss('#ffd23f', 0.3, 0.7)} position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.6, 0.65, 0.3, 24]} />
          </mesh>
          <mesh geometry={gumdropGeometry(20)} material={jelly('#ff8fb8')} position={[0, 8.4, 0]} scale={0.6} />
        </group>
      ))}
      {/* bunting */}
      <mesh geometry={cachedGeo('hall-bunting', () => {
        const parts: THREE.BufferGeometry[] = [];
        const cols = ['#ff6b8b', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'];
        for (let i = 0; i < 20; i++) {
          const t = i / 19;
          const x = -7 + t * 14;
          const y = 7.2 - Math.sin(t * Math.PI) * 1.2;
          const tri = new THREE.ConeGeometry(0.25, 0.5, 3);
          tri.rotateZ(Math.PI);
          tri.translate(x, y - 0.25, -6.8);
          parts.push(paint(tri, cols[i % cols.length]));
        }
        return merge(parts);
      })} material={vcolor(0.6, 'bunting')} />
      <Fountain />
      <Chandelier />
      <Throne onSit={sitOnThrone} />
      <Organ />
      <Guard position={[3.9, 0, -6.4]} rotY={0} />
      <Guard position={[7.1, 0, -4.2]} rotY={-Math.PI / 2} />
      <Doorway position={[5.6, 0, -7.2]} rotY={0} color="#8fb4ff" glow="#b8d2ff" onTap={goGarden} label="garden-door" />
      <Doorway position={[-7.75, 0, 3.4]} rotY={Math.PI / 2} color="#7a4124" glow="#ffd27a" onTap={goOutside} label="exit-door" />
      {/* lollipop candles */}
      {[-6.8, 6.8].map((x) => (
        <group key={x} position={[x, 0, 5.4]}>
          <mesh material={pattern({ a: '#ffffff', b: '#7b5cff', mode: 'helix', freq: 1, twist: 4 })} position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 1.8, 10]} />
          </mesh>
          <mesh material={emissive('#ffcf6b', 2)} position={[0, 1.95, 0]} scale={[1, 1.6, 1]}>
            <sphereGeometry args={[0.1, 10, 8]} />
          </mesh>
          <Glow color="#ffcf6b" size={1.2} opacity={0.7} position={[0, 1.95, 0]} />
        </group>
      ))}
    </group>
  );
}
