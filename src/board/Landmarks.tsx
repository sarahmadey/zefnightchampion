// One big landmark per land: a jungle waterfall and giant tree, a friendly
// puffing volcano, the lagoon sea with a plesiosaur, canyon mesas, snowy
// peaks with an igloo, a glowing crystal cluster, and a rainbow over the meadow.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_RULES, type QuestRules } from '../state/progress';
import { groundHeight, landDepth, landZ, themeOf } from './layout';
import { makeFlowMaterial, makeGlowPointsMaterial, sharedTime } from '../three/shaders';
import { cachedGeo, curveFrom, lathe, lumpy, merge, paint, tube } from '../three/geometry';
import { crystalGeometry, mesaGeometry, palmGeometry } from './props';
import { burst } from '../three/Particles';
import { TAU, mulberry32, randRange } from '../three/util';
import { frameDt } from '../game/actors';
import { motion } from '../game/settings';

const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
const vcGlow = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: new THREE.Color('#8f6cf0'), emissiveIntensity: 0.6 });

function colored(g: THREE.BufferGeometry, f: (p: THREE.Vector3) => THREE.Color) {
  const n = g.index ? g.toNonIndexed() : g;
  paint(n, f);
  return n;
}

const waterfallMat = makeFlowMaterial({ deep: '#4dabf7', shallow: '#a5e3ff', foam: '#ffffff', speed: 1.6, sparkle: 1, gloss: 0.6, scale: 0.6 });
const poolMat = makeFlowMaterial({ deep: '#3b9be0', shallow: '#8fdcff', foam: '#ffffff', speed: 0.3, sparkle: 0.8, gloss: 0.7, scale: 0.3 });

function Jungle({ z0 }: { z0: number }) {
  const cliff = useMemo(
    () =>
      cachedGeo('jungle-cliff', () => {
        const base = new THREE.SphereGeometry(1, 28, 20);
        base.scale(3.6, 5, 2.4);
        const g = lumpy(base, 0.35, 0.7, 3);
        g.translate(0, 3.2, 0);
        return colored(g, (p) => new THREE.Color('#7d8a8f').lerp(new THREE.Color('#5fa84b'), p.y > 7.0 || (Math.sin(p.x * 3 + p.y) > 0.6 && p.z > 1.4) ? 0.85 : 0));
      }),
    [],
  );
  const tree = useMemo(
    () =>
      cachedGeo('jungle-tree', () => {
        const trunk = colored(
          tube(curveFrom([[0, 0, 0], [0.3, 3, 0], [-0.2, 6, 0.2], [0.1, 8.5, 0]]), { segments: 18, radial: 10, radius: (t) => 0.75 * (1 - t * 0.55) }),
          () => new THREE.Color('#7a4e25'),
        );
        const parts = [trunk];
        const rng = mulberry32(77);
        for (let i = 0; i < 9; i++) {
          const s = new THREE.IcosahedronGeometry(randRange(rng, 1.4, 2.4), 2);
          s.translate(randRange(rng, -2.4, 2.4), 8.5 + randRange(rng, -0.8, 1.4), randRange(rng, -2.2, 2.2));
          parts.push(colored(s, (p) => new THREE.Color('#2b8a3e').lerp(new THREE.Color('#69db7c'), Math.min(1, (p.y - 7.5) / 3))));
        }
        for (let i = 0; i < 5; i++) {
          const a = i * 1.3;
          const vine = tube(curveFrom([[Math.cos(a) * 2, 8, Math.sin(a) * 2], [Math.cos(a) * 2.2, 5.5, Math.sin(a) * 2.2], [Math.cos(a) * 2.1, 3.5 + (i % 2), Math.sin(a) * 2.1]]), { segments: 10, radial: 4, radius: () => 0.06 });
          parts.push(colored(vine, () => new THREE.Color('#37b24d')));
        }
        return merge(parts);
      }),
    [],
  );
  const pool = useRef<THREE.Mesh>(null!);
  const st = useRef({ t: 0 });
  useFrame((_, raw) => {
    const dt = frameDt(raw);
    st.current.t += dt;
    if (st.current.t > 0.5 && !motion.reduced) {
      st.current.t = 0;
      burst('puff', new THREE.Vector3(-12.2, groundHeight(-12.2, z0 - 1) + 0.2, z0 - 0.4), { count: 2, colors: ['#ffffff', '#e7f5ff'], up: 0.6, life: 1.4, size: 0.4 });
    }
  });
  const gy = groundHeight(-13, z0 - 3);
  return (
    <group>
      <mesh geometry={cliff} material={vc} position={[-14, gy - 1, z0 - 3]} castShadow receiveShadow raycast={() => null} />
      <mesh material={waterfallMat} position={[-12.15, gy + 3.3, z0 - 1.05]} rotation={[0, 0.08, Math.PI / 2]} raycast={() => null}>
        <planeGeometry args={[8.2, 1.8, 1, 1]} />
      </mesh>
      <mesh ref={pool} material={poolMat} position={[-11.8, gy + 0.05, z0 - 0.4]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[2.0, 32]} />
      </mesh>
      <mesh geometry={tree} material={vc} position={[14, groundHeight(14, z0 + 4) - 0.2, z0 + 4]} castShadow raycast={() => null} />
    </group>
  );
}

const lavaMat = makeFlowMaterial({ deep: '#e8590c', shallow: '#ffd43b', foam: '#fff3bf', speed: 0.2, sparkle: 0.3, gloss: 0.2, scale: 0.4 });

function Volcano({ z0, d }: { z0: number; d: number }) {
  const cone = useMemo(
    () =>
      cachedGeo('volcano', () => {
        const g = lathe(
          [
            [0, 0],
            [9, 0],
            [7.5, 2.5],
            [5, 6],
            [3.2, 9.2],
            [2.6, 9.5],
            [2.2, 9.0],
            [0, 8.6],
          ],
          40,
          24,
        );
        return colored(g, (p) => {
          const top = Math.hypot(p.x, p.z) < 2.4 && p.y > 8.4;
          if (top) return new THREE.Color('#ff922b');
          return new THREE.Color('#8a5a44').lerp(new THREE.Color('#5c3d33'), Math.min(1, p.y / 9)).lerp(new THREE.Color('#ff6b3d'), Math.max(0, Math.sin(Math.atan2(p.z, p.x) * 5) - 0.85) * 3 * (p.y / 9));
        });
      }),
    [],
  );
  const pos = new THREE.Vector3(-17, groundHeight(-17, z0 - d * 0.25) - 1.5, z0 - d * 0.25);
  const st = useRef({ t: 0 });
  useFrame((_, raw) => {
    st.current.t += frameDt(raw);
    if (st.current.t > 1.1) {
      st.current.t = 0;
      burst('puff', pos.clone().add(new THREE.Vector3(0, 9.6, 0)), { count: 3, colors: ['#ced4da', '#f1f3f5', '#ffd8a8'], up: 1.6, speed: 0.6, life: 3.2, size: 1.3, gravity: 0.15 });
    }
  });
  const pools = useMemo(() => {
    const rng = mulberry32(12);
    return [0, 1, 2].map(() => {
      const x = (rng() < 0.5 ? -1 : 1) * randRange(rng, 6.5, 10);
      const z = z0 + randRange(rng, -d * 0.35, d * 0.35);
      return new THREE.Vector3(x, groundHeight(x, z) + 0.03, z);
    });
  }, [z0, d]);
  return (
    <group>
      <mesh geometry={cone} material={vc} position={pos} castShadow raycast={() => null} />
      <pointLight position={[pos.x, pos.y + 10, pos.z]} color="#ff922b" intensity={30} distance={20} />
      {pools.map((p, i) => (
        <mesh key={i} material={lavaMat} position={p} rotation={[-Math.PI / 2, 0, i]} raycast={() => null}>
          <circleGeometry args={[1.1 + i * 0.2, 24]} />
        </mesh>
      ))}
    </group>
  );
}

const seaMat = makeFlowMaterial({ deep: '#1c7ed6', shallow: '#66d9e8', foam: '#ffffff', speed: 0.25, sparkle: 1, gloss: 0.8, scale: 0.08 });
const nessieMat = new THREE.MeshPhysicalMaterial({ color: '#38d9a9', roughness: 0.5, sheen: 0.5, clearcoat: 0.2 });
const eyeMat = new THREE.MeshBasicMaterial({ color: '#1d1430' });

function Lagoon({ z0, d }: { z0: number; d: number }) {
  const nessie = useRef<THREE.Group>(null!);
  const neck = useMemo(() => cachedGeo('nessie-neck', () => tube(curveFrom([[0, -0.5, 0], [0, 1.2, 0.2], [0.1, 2.4, 0.9], [0, 2.7, 1.5]]), { segments: 16, radial: 10, radius: (t) => 0.45 - t * 0.2 })), []);
  useFrame(() => {
    const t = sharedTime.value;
    nessie.current.position.y = -0.2 + Math.sin(t * 0.9) * 0.2;
    nessie.current.rotation.y = -1.1 + Math.sin(t * 0.4) * 0.3;
  });
  return (
    <group>
      <mesh material={seaMat} position={[34, -0.45, z0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[46, d + 30, 1, 1]} />
      </mesh>
      <group ref={nessie} position={[17, 0, z0 - d * 0.15]}>
        <mesh geometry={neck} material={nessieMat} castShadow raycast={() => null} />
        <mesh material={nessieMat} position={[0, 2.75, 1.65]} scale={[0.5, 0.42, 0.62]} raycast={() => null}>
          <sphereGeometry args={[1, 18, 14]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={eyeMat} position={[0.25 * s, 2.95, 2.0]} raycast={() => null}>
            <sphereGeometry args={[0.08, 10, 8]} />
          </mesh>
        ))}
        {[0, 1].map((i) => (
          <mesh key={i} material={nessieMat} position={[0, -0.1, -1.4 - i * 1.3]} scale={[0.6, 0.55 - i * 0.12, 0.6]} raycast={() => null}>
            <sphereGeometry args={[1, 14, 10, 0, TAU, 0, Math.PI / 2]} />
          </mesh>
        ))}
      </group>
      <mesh geometry={palmGeometry(1)} material={vc} position={[22, -0.2, z0 + d * 0.25]} raycast={() => null} />
    </group>
  );
}

function Canyon({ z0, d }: { z0: number; d: number }) {
  const arch = useMemo(
    () =>
      cachedGeo('canyon-arch', () =>
        colored(tube(curveFrom([[-3, 0, 0], [-2.6, 4, 0], [0, 6, 0], [2.6, 4, 0], [3, 0, 0]]), { segments: 30, radial: 12, radius: () => 0.9 }), (p) =>
          new THREE.Color('#d9480f').lerp(new THREE.Color('#ffa94d'), (Math.sin(p.y * 2.6) + 1) * 0.3),
        ),
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={mesaGeometry(0)} material={vc} position={[-22, groundHeight(-22, z0) - 1, z0 - d * 0.1]} scale={1.5} raycast={() => null} />
      <mesh geometry={mesaGeometry(1)} material={vc} position={[24, groundHeight(24, z0) - 1, z0 + d * 0.2]} scale={1.3} raycast={() => null} />
      <mesh geometry={mesaGeometry(2)} material={vc} position={[-14, -1, z0 - d * 0.5 - 10]} scale={1.8} raycast={() => null} />
      <mesh geometry={arch} material={vc} position={[13, groundHeight(13, z0 - 2) - 0.4, z0 - 2]} rotation={[0, 1.2, 0]} castShadow raycast={() => null} />
    </group>
  );
}

const snowPointsMat = makeGlowPointsMaterial('#ffffff', 10, 0.9);

function Snowy({ z0, d }: { z0: number; d: number }) {
  const peaks = useMemo(
    () =>
      cachedGeo('snow-peak', () =>
        colored(lathe([[0, 0], [8, 0], [5, 5], [2, 10], [0.3, 12.4], [0, 12.5]], 9, 12), (p) =>
          p.y > 6.5 + Math.sin(Math.atan2(p.z, p.x) * 5) * 0.8 ? new THREE.Color('#ffffff') : new THREE.Color('#7b8db0'),
        ),
      ),
    [],
  );
  const igloo = useMemo(
    () =>
      cachedGeo('igloo', () => {
        const dome = new THREE.SphereGeometry(1.6, 20, 12, 0, TAU, 0, Math.PI / 2);
        const door = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 14, 1, false, 0, Math.PI);
        door.rotateX(Math.PI / 2);
        door.rotateZ(Math.PI / 2);
        door.rotateY(Math.PI / 2);
        door.translate(0, 0.0, 1.5);
        return colored(merge([dome, door]), (p) => (Math.sin(p.y * 7) > 0.85 ? new THREE.Color('#d0ebff') : new THREE.Color('#ffffff')));
      }),
    [],
  );
  const flakes = useMemo(() => {
    const rng = mulberry32(4);
    const n = 260;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const scale = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = randRange(rng, -16, 16);
      pos[i * 3 + 1] = randRange(rng, 0, 12);
      pos[i * 3 + 2] = z0 + randRange(rng, -d / 2 - 4, d / 2 + 4);
      seed[i] = rng();
      scale[i] = randRange(rng, 0.6, 1.4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('scale', new THREE.BufferAttribute(scale, 1));
    return g;
  }, [z0, d]);
  useFrame((_, raw) => {
    const dt = frameDt(raw) * (motion.reduced ? 0.3 : 1);
    const p = flakes.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - dt * (0.6 + (i % 5) * 0.12);
      if (y < 0) y += 12;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(sharedTime.value + i) * dt * 0.2);
    }
    p.needsUpdate = true;
  });
  return (
    <group>
      <mesh geometry={peaks} material={vc} position={[-20, -1, z0 - d * 0.3]} scale={1.6} raycast={() => null} />
      <mesh geometry={peaks} material={vc} position={[22, -1, z0 - d * 0.1]} scale={1.3} rotation={[0, 1, 0]} raycast={() => null} />
      <mesh geometry={peaks} material={vc} position={[2, -2, z0 - d * 0.5 - 18]} scale={2.0} rotation={[0, 2, 0]} raycast={() => null} />
      <mesh geometry={igloo} material={vc} position={[10.5, groundHeight(10.5, z0 + 3), z0 + 3]} rotation={[0, -1.2, 0]} castShadow raycast={() => null} />
      <points geometry={flakes} material={snowPointsMat} frustumCulled={false} raycast={() => null} />
    </group>
  );
}

const fireflyMat = makeGlowPointsMaterial('#fff3a8', 26, 1);

function Crystal({ z0, d }: { z0: number; d: number }) {
  const flies = useMemo(() => {
    const rng = mulberry32(9);
    const n = 70;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const scale = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = randRange(rng, -14, 14);
      pos[i * 3 + 1] = randRange(rng, 0.6, 4);
      pos[i * 3 + 2] = z0 + randRange(rng, -d / 2, d / 2);
      seed[i] = rng();
      scale[i] = randRange(rng, 0.6, 1.2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('scale', new THREE.BufferAttribute(scale, 1));
    return g;
  }, [z0, d]);
  return (
    <group>
      <mesh geometry={crystalGeometry(3, '#b197fc')} material={vcGlow} position={[-15, groundHeight(-15, z0), z0 - 3]} scale={4.5} castShadow raycast={() => null} />
      <mesh geometry={crystalGeometry(2, '#63e6be')} material={vcGlow} position={[15, groundHeight(15, z0 + 4), z0 + 4]} scale={3.6} raycast={() => null} />
      <pointLight position={[-14, 5, z0 - 3]} color="#b197fc" intensity={25} distance={18} />
      <points geometry={flies} material={fireflyMat} frustumCulled={false} raycast={() => null} />
    </group>
  );
}

const rainbowColors = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];

function Meadow({ z0, d }: { z0: number; d: number }) {
  const bow = useMemo(
    () =>
      cachedGeo('rainbow-arc', () => {
        const parts = rainbowColors.map((c, i) => {
          const t = new THREE.TorusGeometry(16 - i * 0.9, 0.48, 8, 64, Math.PI);
          return colored(t, () => new THREE.Color(c));
        });
        return merge(parts);
      }),
    [],
  );
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, fog: false }), []);
  return (
    <group>
      <mesh geometry={bow} material={mat} position={[2, -2, z0 - d / 2 - 14]} raycast={() => null} />
    </group>
  );
}

export function Landmark({ land, rules = DEFAULT_RULES }: { land: number; rules?: QuestRules }) {
  const z0 = landZ(land, rules);
  const d = landDepth(land, rules);
  switch (themeOf(land)) {
    case 0:
      return <Jungle z0={z0} />;
    case 1:
      return <Volcano z0={z0} d={d} />;
    case 2:
      return <Lagoon z0={z0} d={d} />;
    case 3:
      return <Canyon z0={z0} d={d} />;
    case 4:
      return <Snowy z0={z0} d={d} />;
    case 5:
      return <Crystal z0={z0} d={d} />;
    default:
      return <Meadow z0={z0} d={d} />;
  }
}
