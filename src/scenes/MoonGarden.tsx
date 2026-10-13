// The secret moonlit candy garden behind the castle hall. Under a big moon
// and twinkling stars Zef can tap glowing candy flowers (they bloom and
// sing), the moon pond (a moon-fish leaps), the licorice swing (Zef swings),
// the sleepy marshmallow owl (it hoots awake), the moon (it winks) and the
// sky (shooting stars).

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useRoom, walkToThen, type RoomSpec } from './roomCommon';
import { cachedGeo, cuppedPetal, curveFrom, lollipopDisc, puffGeometry, tube, twistRope } from '../three/geometry';
import { emissive, gloss, marshmallow, matte, pattern } from '../three/materials';
import { makeFlowMaterial, makeSkyMaterial } from '../three/shaders';
import { Glow } from '../three/bits';
import { SceneEnv } from '../three/SceneEnv';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pipReact, zef, zefPlay } from '../game/actors';
import { useGame } from '../state/store';
import { Spring, TAU, clamp } from '../three/util';
import { Fireflies } from '../world/regions/Woods';

export const GARDEN: RoomSpec = {
  bounds: { minX: -7, maxX: 7, minZ: -6.5, maxZ: 5.5 },
  obstacles: [
    { x: -3.6, z: -2.2, r: 2.0 },
    { x: 3.8, z: -3.6, r: 1.3 },
  ],
  start: new THREE.Vector3(0, 0, 4.6),
  camOffset: new THREE.Vector3(0, 4.4, 8.8),
  camXRange: [-2.5, 2.5],
  camZRange: [-3, 4.2],
  lookAhead: 3.4,
  fit: 9,
};

const POND = new THREE.Vector3(-3.6, 0, -2.2);
const SWING = new THREE.Vector3(3.8, 0, -3.6);
const MOON_POS = new THREE.Vector3(-5.5, 7.0, -22);

function NightSky() {
  const mat = useMemo(
    () =>
      makeSkyMaterial({
        zenith: '#0e1240',
        mid: '#2b2470',
        horizon: '#7a4fa0',
        ground: '#1b1338',
        sun: '#c8d6ff',
        sunDir: MOON_POS.clone().normalize(),
        night: true,
      }),
    [],
  );
  return (
    <mesh material={mat} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[200, 32, 20]} />
    </mesh>
  );
}

function Moon() {
  const face = useRef<THREE.Group>(null!);
  const st = useMemo(() => ({ wink: -1, spring: new Spring(0, 80, 5) }), []);
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    const v = st.spring.update(dt);
    face.current.scale.setScalar(1 + v * 0.08);
    if (st.wink >= 0) st.wink += dt;
    if (st.wink > 1) st.wink = -1;
  });
  const winkScale = () => (st.wink >= 0 ? Math.abs(Math.cos(clamp(st.wink, 0, 1) * Math.PI)) : 1);
  const eye = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    eye.current.scale.y = Math.max(0.1, winkScale());
  });
  const tap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    st.wink = 0;
    st.spring.kick(4);
    sfx.play('chime', 9);
    burst('sparkle', e.point, { count: 20, colors: ['#fff6c8', '#ffffff', '#c8d6ff'], size: 0.5, speed: 4 });
  };
  return (
    <group position={MOON_POS} ref={face} onPointerDown={tap}>
      <mesh material={emissive('#fff3c8', 1.1)} scale={0.75}>
        <sphereGeometry args={[4, 32, 24]} />
      </mesh>
      {/* a sleepy, friendly face */}
      <mesh ref={eye} material={matte('#d9c58a', 0.9)} position={[-0.9, 0.45, 2.82]} scale={[1, 1, 0.3]}>
        <sphereGeometry args={[0.32, 12, 10]} />
      </mesh>
      <mesh material={matte('#d9c58a', 0.9)} position={[0.9, 0.45, 2.82]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.32, 0.08, 6, 14, Math.PI]} />
      </mesh>
      <mesh material={matte('#d9c58a', 0.9)} position={[0, -0.5, 2.85]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.6, 0.08, 6, 20, Math.PI]} />
      </mesh>
      <Glow color="#fff1c2" size={16} opacity={0.4} />
    </group>
  );
}

function flowerHeadGeometry() {
  return cachedGeo('moon-flower-petal', () => cuppedPetal(0.5, 0.26, 0.08, 0.02));
}

function GlowFlower({ position, color, note }: { position: [number, number, number]; color: string; note: number }) {
  const petals = useRef<(THREE.Mesh | null)[]>([]);
  const core = useRef<THREE.Mesh>(null!);
  const glow = useRef<THREE.Sprite>(null!);
  const st = useMemo(() => ({ bloom: 0.35, target: 0.35, hold: 0, spring: new Spring(0, 180, 7) }), []);
  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    if (st.hold > 0) {
      st.hold -= dt;
      if (st.hold <= 0) st.target = 0.35;
    }
    st.bloom = THREE.MathUtils.damp(st.bloom, st.target, 4, dt);
    const sp = st.spring.update(dt);
    petals.current.forEach((p, k) => {
      if (!p) return;
      const a = (k / 6) * TAU;
      p.rotation.set(0, -a, 0);
      p.rotateX(-(1.5 - st.bloom * 1.2) + Math.sin(state.clock.elapsedTime * 1.5 + k) * 0.03);
      p.scale.setScalar(1 + sp * 0.2);
    });
    (core.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + st.bloom * 1.8;
    (glow.current.material as THREE.SpriteMaterial).opacity = 0.2 + st.bloom * 0.5;
  });
  const tap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    st.target = 1.05;
    st.hold = 6;
    st.spring.kick(5);
    sfx.play('chime', note);
    burst('sparkle', e.point, { count: 14, colors: [color, '#ffffff'] });
    burst('note', e.point.clone().setY(e.point.y + 0.5), { count: 1, colors: [color] });
  };
  return (
    <group position={position}>
      <mesh material={matte('#2f8a6a', 0.6)} position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 1.2, 8]} />
      </mesh>
      <group position={[0, 1.25, 0]}>
        {Array.from({ length: 6 }, (_, k) => (
          <mesh key={k} ref={(m) => (petals.current[k] = m)} geometry={flowerHeadGeometry()}>
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <mesh ref={core} position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.13, 14, 10]} />
          <meshStandardMaterial color="#fff6c8" emissive="#ffe08a" emissiveIntensity={1} toneMapped={false} />
        </mesh>
        <Glow ref={glow} color={color} size={2} opacity={0.4} />
      </group>
      <mesh visible={false} position={[0, 1.0, 0]} onPointerDown={tap}>
        <sphereGeometry args={[0.85, 10, 8]} />
      </mesh>
    </group>
  );
}

function MoonPond() {
  const fish = useRef<THREE.Group>(null!);
  const st = useMemo(() => ({ jump: -1 }), []);
  const mat = useMemo(() => makeFlowMaterial({ deep: '#141a5a', shallow: '#3b4fb8', foam: '#c8d6ff', speed: 0.15, sparkle: 1.4, gloss: 1.2, scale: 1 }), []);
  const geo = useMemo(
    () =>
      cachedGeo('moon-pond', () => {
        const g = new THREE.CircleGeometry(1.85, 48);
        g.rotateX(-Math.PI / 2);
        const pos = g.getAttribute('position') as THREE.BufferAttribute;
        const uv = g.getAttribute('uv') as THREE.BufferAttribute;
        const len = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) {
          len[i] = Math.atan2(pos.getZ(i), pos.getX(i)) * 0.6;
          uv.setXY(i, 0.5, 0.5 - Math.hypot(pos.getX(i), pos.getZ(i)) / 3.8);
        }
        g.setAttribute('flowLen', new THREE.BufferAttribute(len, 1));
        return g;
      }),
    [],
  );
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    if (st.jump >= 0) {
      st.jump += dt;
      const u = st.jump / 1.4;
      fish.current.visible = u < 1;
      fish.current.position.set(-1.1 + u * 2.2, Math.sin(u * Math.PI) * 1.8, 0.2);
      fish.current.rotation.z = -Math.cos(u * Math.PI) * 1.1;
      if (u >= 1) {
        st.jump = -1;
        sfx.play('splash');
        burst('drop', new THREE.Vector3(POND.x + 1.1, 0.2, POND.z + 0.2), { count: 14, colors: ['#8fa8ff', '#ffffff'], size: 0.05 });
      }
    } else fish.current.visible = false;
  });
  const tap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (st.jump >= 0) return;
    st.jump = 0;
    sfx.play('bloop');
    burst('drop', new THREE.Vector3(POND.x - 1.1, 0.2, POND.z + 0.2), { count: 12, colors: ['#8fa8ff', '#ffffff'], size: 0.05 });
    burst('sparkle', new THREE.Vector3(POND.x, 1.6, POND.z), { count: 18, colors: ['#c8d6ff', '#fff6c8'] });
    zef.look = new THREE.Vector3(POND.x, 1.5, POND.z);
    zefPlay('point', 1.4);
    pipReact('surprised', 1.2);
  };
  return (
    <group position={POND}>
      <mesh material={matte('#e9e1ff', 0.6)} position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.9, 0.18, 10, 40]} />
      </mesh>
      <mesh geometry={geo} material={mat} position={[0, 0.06, 0]} />
      {/* the moon's reflection */}
      <mesh material={emissive('#fff3c8', 0.6)} position={[0.5, 0.075, -0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 24]} />
      </mesh>
      {[[-0.9, 0.7], [0.8, 0.9], [-0.2, -1.1]].map(([x, z], i) => (
        <mesh key={i} material={matte('#c98a50', 0.8)} position={[x, 0.08, z]} rotation={[-Math.PI / 2, 0, i]}>
          <circleGeometry args={[0.3, 16, 0.3, TAU - 0.6]} />
        </mesh>
      ))}
      <group ref={fish} visible={false}>
        <mesh material={emissive('#b8c8ff', 1.1)} scale={[1.3, 0.7, 0.5]}>
          <sphereGeometry args={[0.22, 14, 10]} />
        </mesh>
        <mesh material={emissive('#ffd6f0', 1.1)} position={[-0.32, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.15, 0.22, 3]} />
        </mesh>
        <Glow color="#c8d6ff" size={1.2} opacity={0.7} />
      </group>
      <mesh visible={false} position={[0, 0.3, 0]} onPointerDown={tap}>
        <cylinderGeometry args={[2.1, 2.1, 0.8, 16]} />
      </mesh>
    </group>
  );
}

function Swing() {
  const seat = useRef<THREE.Group>(null!);
  const st = useMemo(() => ({ amp: 0.08, t: 0, riding: -1 }), []);
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    st.t += dt;
    st.amp = Math.max(0.06, st.amp * Math.exp(-0.12 * dt));
    const a = Math.sin(st.t * 1.9) * st.amp;
    seat.current.rotation.x = a;
    if (st.riding >= 0) {
      st.riding += dt;
      const p = new THREE.Vector3(0, -2.55, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), a);
      zef.pos.set(SWING.x + p.x, 3.0 + p.y + 0.05, SWING.z + p.z);
      zef.heading = 0;
      if (st.riding > 6) {
        st.riding = -1;
        zef.scripted = false;
        zef.action.name = 'none';
        zef.pos.set(SWING.x, 0, SWING.z + 1.4);
      }
    }
  });
  const tap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (st.riding >= 0) {
      st.amp = Math.min(0.75, st.amp + 0.2);
      sfx.play('whoosh');
      return;
    }
    walkToThen(GARDEN, new THREE.Vector3(SWING.x, 0, SWING.z + 1.1), () => {
      zef.scripted = true;
      zefPlay('swing', 999, true);
      st.riding = 0;
      st.amp = 0.55;
      zef.expression = 'happy';
      sfx.play('whoosh');
      pipReact('cheer', 1.2);
      setTimeout(() => (zef.expression = 'smile'), 3000);
    });
  };
  const ropes = useMemo(
    () =>
      cachedGeo('swing-ropes', () =>
        twistRope(curveFrom([[0, 0, 0], [0, -1.2, 0], [0, -2.5, 0]]), 0.04, 14, 30),
      ),
    [],
  );
  return (
    <group position={SWING}>
      {/* candy arch frame */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} material={pattern({ a: '#ffffff', b: '#c77dff', mode: 'helix', freq: 1, twist: 4 })} position={[sx * 1.0, 1.5, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 3.0, 10]} />
        </mesh>
      ))}
      <mesh material={pattern({ a: '#ffffff', b: '#c77dff', mode: 'helix', freq: 1, twist: 4 })} position={[0, 3.0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 2.2, 10]} />
      </mesh>
      <group ref={seat} position={[0, 3.0, 0]}>
        {[-0.32, 0.32].map((x) => (
          <mesh key={x} geometry={ropes} material={gloss('#e3182f', 0.3, 0.6)} position={[x, 0, 0]} />
        ))}
        <mesh material={gloss('#ff8fb8', 0.35, 0.5)} position={[0, -2.55, 0]}>
          <boxGeometry args={[0.85, 0.08, 0.4]} />
        </mesh>
      </group>
      <mesh visible={false} position={[0, 1.4, 0]} onPointerDown={tap}>
        <boxGeometry args={[2.4, 3.2, 1.6]} />
      </mesh>
    </group>
  );
}

function Owl() {
  const eyes = useRef<THREE.Group>(null!);
  const wings = useRef<(THREE.Mesh | null)[]>([]);
  const st = useMemo(() => ({ awake: 0, t: -1 }), []);
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    if (st.t >= 0) {
      st.t += dt;
      if (st.t > 4) st.t = -1;
    }
    const target = st.t >= 0 ? 1 : 0;
    st.awake = THREE.MathUtils.damp(st.awake, target, 6, dt);
    eyes.current.scale.y = 0.12 + st.awake * 0.88;
    const flap = st.t >= 0 && st.t < 1.2 ? Math.sin(st.t * 22) * 0.6 : 0;
    wings.current.forEach((w, k) => w && (w.rotation.z = (k ? -1 : 1) * (0.2 + Math.abs(flap))));
  });
  const tap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    st.t = 0;
    sfx.play('hoot');
    burst('sparkle', e.point, { count: 10, colors: ['#ffffff', '#c8d6ff'] });
  };
  return (
    <group position={[5.6, 2.6, -1.0]}>
      <mesh geometry={cachedGeo('owl-body', () => puffGeometry(91, 4, 0.35, 3))} material={marshmallow('#f4ecff')} scale={[0.75, 0.9, 0.7]} />
      <group ref={eyes} position={[0, 0.25, 0.42]}>
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * 0.17, 0, 0]}>
            <mesh material={matte('#ffffff', 0.4)}>
              <sphereGeometry args={[0.13, 14, 10]} />
            </mesh>
            <mesh material={gloss('#2a1d4a', 0.1, 1)} position={[0, 0, 0.1]}>
              <sphereGeometry args={[0.065, 10, 8]} />
            </mesh>
          </group>
        ))}
      </group>
      <mesh material={gloss('#ffb347', 0.3, 0.5)} position={[0, 0.08, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.06, 0.14, 8]} />
      </mesh>
      {[-1, 1].map((sx, k) => (
        <mesh key={sx} ref={(m) => (wings.current[k] = m)} material={marshmallow('#e6dcff')} position={[sx * 0.48, -0.05, 0]} scale={[0.25, 0.55, 0.4]}>
          <sphereGeometry args={[0.5, 12, 10]} />
        </mesh>
      ))}
      {/* branch of a lollipop tree */}
      <mesh material={matte('#fff3e6', 0.5)} position={[0, -0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 1.6, 8]} />
      </mesh>
      <mesh material={matte('#fff3e6', 0.5)} position={[0.8, -1.8, -0.2]}>
        <cylinderGeometry args={[0.1, 0.12, 2.6, 8]} />
      </mesh>
      <mesh visible={false} onPointerDown={tap}>
        <sphereGeometry args={[0.9, 10, 8]} />
      </mesh>
    </group>
  );
}

function ShootingStars() {
  const st = useMemo(() => ({ list: [] as { p: THREE.Vector3; v: THREE.Vector3; t: number }[] }), []);
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    st.list.forEach((s) => {
      s.t += dt;
      s.p.addScaledVector(s.v, dt);
      burst('sparkle', s.p.clone(), { count: 1, speed: 0.2, up: 0, gravity: -0.5, life: 0.9, size: 0.35, colors: ['#fff6c8', '#ffffff', '#c8d6ff'] });
    });
    st.list = st.list.filter((s) => s.t < 1.4);
  });
  const tap = (e: ThreeEvent<PointerEvent>) => {
    if (useGame.getState().cutscene) return;
    e.stopPropagation();
    const start = new THREE.Vector3(-14 + Math.random() * 10, 16 + Math.random() * 4, -26);
    st.list.push({ p: start, v: new THREE.Vector3(14, -5, 2), t: 0 });
    sfx.play('sparkle');
    zef.look = start.clone();
    zefPlay('lookUp', 1.6);
  };
  return (
    <mesh visible={false} position={[0, 18, -30]} onPointerDown={tap}>
      <sphereGeometry args={[40, 12, 8, 0, TAU, 0, Math.PI * 0.42]} />
    </mesh>
  );
}

export function MoonGarden() {
  const { onFloor } = useRoom(GARDEN, true);
  const flowers = useMemo(
    () => [
      { p: [-6.2, 0, 1.5], c: '#ff9fd8', n: 0 },
      { p: [-5.4, 0, 3.6], c: '#9fd8ff', n: 2 },
      { p: [-1.2, 0, -5.2], c: '#c8a6ff', n: 4 },
      { p: [1.0, 0, -5.6], c: '#fff09f', n: 5 },
      { p: [6.3, 0, 1.2], c: '#9fffd0', n: 7 },
      { p: [5.6, 0, 3.6], c: '#ffb89f', n: 9 },
      { p: [-0.4, 0, -2.6], c: '#ff9fb4', n: 3 },
    ] as { p: [number, number, number]; c: string; n: number }[],
    [],
  );
  const stones = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < 9; i++) out.push([Math.sin(i * 0.7) * 1.2, 4.4 - i * 1.05]);
    return out;
  }, []);
  const goBack = () => {
    if (useGame.getState().cutscene) return;
    zef.scripted = false;
    walkToThen(GARDEN, new THREE.Vector3(6.0, 0, 3.4), () => {
      useGame.getState().set({ fade: 1 });
      setTimeout(() => {
        useGame.getState().set({ room: 'hall' });
        setTimeout(() => useGame.getState().set({ fade: 0 }), 250);
      }, 550);
    });
  };
  return (
    <group>
      <SceneEnv background="#120f33" fog={{ color: '#1b1440', near: 20, far: 70 }} />
      <NightSky />
      <Moon />
      <hemisphereLight args={['#8fa8ff', '#2a1d4a', 1.0]} />
      <directionalLight position={[-6, 12, -10]} intensity={1.2} color="#c8d6ff" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-radius={5} />
      <ambientLight intensity={0.25} color="#6a5aa8" />
      {/* lawn */}
      <mesh material={matte('#2f3f7a', 0.95)} rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerDown={onFloor}>
        <circleGeometry args={[16, 64]} />
      </mesh>
      {/* glowing stepping stones */}
      {stones.map(([x, z], i) => (
        <mesh key={i} material={emissive(['#ffd6f0', '#d6e4ff', '#fff3c4'][i % 3], 0.45)} position={[x, 0.03, z]} raycast={() => null}>
          <cylinderGeometry args={[0.4, 0.42, 0.05, 20]} />
        </mesh>
      ))}
      {/* frosted hedge wall */}
      {Array.from({ length: 18 }, (_, i) => {
        const a = Math.PI * 0.05 + (i / 17) * Math.PI * 0.9;
        return (
          <mesh key={i} geometry={cachedGeo('hedge-puff', () => puffGeometry(71, 5, 0.6, 2))} material={marshmallow('#4a3f8a', '#8f7fe0')} position={[Math.cos(a) * 10, 0.6, -Math.sin(a) * 8 + 1]} scale={1.4} />
        );
      })}
      {/* lollipop trees with glowing swirls */}
      {[
        [-7.5, -4],
        [7.8, -5],
        [-8.2, 3],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh material={matte('#fff3e6', 0.5)} position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.1, 0.12, 3.2, 8]} />
          </mesh>
          <mesh geometry={cachedGeo('garden-lolli', () => lollipopDisc(1.1, 0.25))} position={[0, 3.8, 0]}>
            <meshStandardMaterial color={['#ff9fd8', '#9fd8ff', '#c8a6ff'][i]} emissive={['#ff6fb8', '#5fb8ff', '#9a6bff'][i]} emissiveIntensity={0.6} />
          </mesh>
          <Glow color={['#ff9fd8', '#9fd8ff', '#c8a6ff'][i]} size={3} opacity={0.35} position={[0, 3.8, 0.3]} />
        </group>
      ))}
      {flowers.map((f, i) => (
        <GlowFlower key={i} position={f.p} color={f.c} note={f.n} />
      ))}
      <MoonPond />
      <Swing />
      <Owl />
      <ShootingStars />
      <Fireflies count={40} zMin={-6} zMax={5} spread={7} color="#c8d6ff" />
      {/* archway back to the hall */}
      <group position={[6.9, 0, 3.4]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh geometry={cachedGeo('garden-arch', () => tube(curveFrom(Array.from({ length: 13 }, (_, i) => {
          const a = (i / 12) * Math.PI;
          return [Math.cos(a) * 1.6, 1.8 + Math.sin(a) * 1.6, 0] as [number, number, number];
        }).concat([]), 0.5), { segments: 60, radial: 10, radius: () => 0.16 }))} material={gloss('#ffd23f', 0.3, 0.6)} />
        {[-1.6, 1.6].map((x) => (
          <mesh key={x} material={gloss('#ffd23f', 0.3, 0.6)} position={[x, 0.9, 0]}>
            <cylinderGeometry args={[0.16, 0.18, 1.8, 10]} />
          </mesh>
        ))}
        <mesh material={emissive('#ffcf87', 0.8)} position={[0, 1.9, -0.05]}>
          <planeGeometry args={[3.0, 3.6]} />
        </mesh>
        <mesh
          visible={false}
          position={[0, 1.8, 0]}
          onPointerDown={(e) => {
            e.stopPropagation();
            goBack();
          }}
        >
          <boxGeometry args={[3.6, 4, 1.4]} />
        </mesh>
      </group>
    </group>
  );
}
