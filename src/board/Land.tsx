// One land of the board: ground with a dirt path, stepping stones (with a
// star sticker on every space Zef has reached), the prize chest at the end,
// a rope bridge over the river to the next land, and themed decorations.

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_RULES, landRange, type QuestRules } from '../state/progress';
import { BRIDGE, bridgeEnds, groundHeight, landCurve, landDepth, landZ, spacePos } from './layout';
import { InstancedSet, distToPath, landScatter, swaying } from './decor';
import { themeFor, type DecorSpec } from './themes';
import { nestGeometry, stoneGeometry } from './props';
import { ropeGeometry, stickerGeometry } from './prizeIcons';
import { Chest } from './Chest';
import { Landmark } from './Landmarks';
import { makeFlowMaterial, sharedTime } from '../three/shaders';
import { cachedGeo, roundedBox } from '../three/geometry';
import { fbm2, smoothstep } from '../three/util';
import type { Prize } from '../game/rewards';

const C = new THREE.Color();
const C2 = new THREE.Color();

function landGround(land: number, rules: QuestRules): THREE.BufferGeometry {
  return cachedGeo(`ground-${land}-${rules.firstPrize}-${rules.prizeEvery}`, () => {
    const theme = themeFor(land);
    const d = landDepth(land, rules);
    const z0 = landZ(land, rules);
    const w = 52;
    const home = land === 0 ? 16 : 0;
    const depth = d + 6 + home;
    const segX = 78;
    const segZ = Math.round(depth * 1.6);
    const g = new THREE.PlaneGeometry(w, depth, segX, segZ);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, z0 + home / 2);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const g0 = new THREE.Color(theme.ground[0]);
    const g1 = new THREE.Color(theme.ground[1]);
    const g2 = new THREE.Color(theme.ground[2]);
    const path = new THREE.Color(theme.path);
    const cliff = new THREE.Color(theme.ground[2]).multiplyScalar(0.62);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dz = Math.abs(z - z0);
      let h = groundHeight(x, z);
      const drop = home && z > z0 ? 0 : smoothstep(d / 2 + 0.4, d / 2 + 2.6, dz);
      // near the bridges the bank stays up so the bridge lands on solid ground
      const bank = Math.abs(x) < 1.6 ? 0.25 : 1;
      h -= drop * 2.6 * bank;
      pos.setY(i, h);
      const n = fbm2(x * 0.18 + land * 3.1, z * 0.18, 3);
      C.copy(g0).lerp(g1, smoothstep(0.35, 0.65, n));
      C2.copy(g2);
      C.lerp(C2, smoothstep(0.62, 0.8, fbm2(x * 0.5, z * 0.5 + land, 2)) * 0.5);
      const pd = distToPath(land, x, z, rules);
      C.lerp(path, (1 - smoothstep(0.75, 1.15, pd)) * 0.92);
      C.lerp(cliff, drop * 0.8);
      colors[i * 3] = C.r;
      colors[i * 3 + 1] = C.g;
      colors[i * 3 + 2] = C.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  });
}

const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });

const decorMats = new Map<string, THREE.MeshStandardMaterial>();
function decorMaterial(spec: DecorSpec): THREE.MeshStandardMaterial {
  const key = `${spec.sway ?? 0}:${spec.glow ?? ''}`;
  let m = decorMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    if (spec.glow) {
      m.emissive = new THREE.Color(spec.glow);
      m.emissiveIntensity = 0.45;
      m.roughness = 0.3;
    }
    if (spec.sway) swaying(m, spec.sway, key);
    decorMats.set(key, m);
  }
  return m;
}

function Decor({ land, rules }: { land: number; rules: QuestRules }) {
  const theme = themeFor(land);
  const sets = useMemo(
    () =>
      theme.decor.map((spec, i) => ({
        spec,
        items: landScatter(land, { seed: 300 + i * 37, count: spec.count, scale: spec.scale, clear: spec.clear, maxX: spec.maxX, edge: spec.edge, minSpacing: 0.8 }, rules),
      })),
    [land, rules, theme],
  );
  return (
    <group>
      {sets.map(({ spec, items }, i) => (
        <InstancedSet key={i} geometry={spec.geo()} material={decorMaterial(spec)} items={items} castShadow={!!spec.shadow} />
      ))}
    </group>
  );
}

const stoneMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3 });
const stickerMat = new THREE.MeshPhysicalMaterial({
  color: '#ffcf33',
  roughness: 0.18,
  metalness: 0.35,
  clearcoat: 1,
  emissive: new THREE.Color('#ffb703'),
  emissiveIntensity: 0.35,
});

function Stones({ land, stars, rules }: { land: number; stars: number; rules: QuestRules }) {
  const theme = themeFor(land);
  const { start, end } = landRange(land, rules);
  const stones = useRef<THREE.InstancedMesh>(null!);
  const stickers = useRef<THREE.InstancedMesh>(null!);
  const n = end - start - 1; // the chest has its own platform
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const col = new THREE.Color();
    for (let k = 1; k <= n; k++) {
      const p = spacePos(start + k, rules);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 1.3);
      m.compose(new THREE.Vector3(p.x, p.y - 0.17, p.z), q, s);
      stones.current.setMatrixAt(k - 1, m);
      stones.current.setColorAt(k - 1, col.set(theme.stones[k % 3]));
    }
    stones.current.instanceMatrix.needsUpdate = true;
    if (stones.current.instanceColor) stones.current.instanceColor.needsUpdate = true;
    stones.current.computeBoundingSphere();
  }, [land, n, rules, start, theme]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let count = 0;
    for (let k = 1; k <= n; k++) {
      if (start + k > stars) break;
      const p = spacePos(start + k, rules);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 0.7);
      m.compose(new THREE.Vector3(p.x, p.y + 0.06, p.z), q, new THREE.Vector3(0.95, 1, 0.95));
      stickers.current.setMatrixAt(count++, m);
    }
    stickers.current.count = count;
    stickers.current.instanceMatrix.needsUpdate = true;
    stickers.current.computeBoundingSphere();
  }, [stars, land, n, rules, start]);
  return (
    <group>
      <instancedMesh ref={stones} args={[stoneGeometry(), stoneMat, n]} receiveShadow raycast={() => null} />
      <instancedMesh ref={stickers} args={[stickerGeometry(), stickerMat, n]} raycast={() => null} />
    </group>
  );
}

/** A soft pulsing ring on the next stone: that's where Zef hops next. */
export function NextRing({ stars, rules }: { stars: number; rules: QuestRules }) {
  const ref = useRef<THREE.Mesh>(null!);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff3a3', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }), []);
  useFrame(() => {
    const p = spacePos(stars + 1, rules);
    const t = sharedTime.value;
    ref.current.position.set(p.x, p.y + 0.06, p.z);
    const k = 1 + Math.sin(t * 3) * 0.08;
    ref.current.scale.set(k, k, k);
    mat.opacity = 0.55 + Math.sin(t * 3) * 0.25;
  });
  return (
    <mesh ref={ref} material={mat} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <ringGeometry args={[0.66, 0.8, 40]} />
    </mesh>
  );
}

const plankMat = new THREE.MeshStandardMaterial({ color: '#b07a45', roughness: 0.85 });
const ropeMat = new THREE.MeshStandardMaterial({ color: '#d9b77a', roughness: 0.9 });
const postMat = new THREE.MeshStandardMaterial({ color: '#8d5a2b', roughness: 0.85 });

function Bridge({ land, rules }: { land: number; rules: QuestRules }) {
  const [a, b] = useMemo(() => bridgeEnds(land, rules), [land, rules]);
  const planks = useRef<THREE.InstancedMesh>(null!);
  const count = 16;
  const ropes = useMemo(() => {
    const dir = b.clone().sub(a).setY(0).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    return [-1, 1].map((s) => {
      const pa = a.clone().addScaledVector(side, 0.75 * s).add(new THREE.Vector3(0, 0.75, 0)).addScaledVector(dir, 0.6);
      const pb = b.clone().addScaledVector(side, 0.75 * s).add(new THREE.Vector3(0, 0.75, 0)).addScaledVector(dir, -0.4);
      return { geo: ropeGeometry(pa, pb, 0.45), pa, pb };
    });
  }, [a, b]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const dir = b.clone().sub(a).setY(0).normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const p = a.clone().lerp(b, 0.04 + t * 0.92);
      p.y += -Math.sin(t * Math.PI) * 0.35 + 0.02;
      q.setFromEuler(new THREE.Euler(0, yaw + (i % 2 ? 0.04 : -0.04), 0));
      m.compose(p, q, new THREE.Vector3(1, 1, 1));
      planks.current.setMatrixAt(i, m);
    }
    planks.current.instanceMatrix.needsUpdate = true;
    planks.current.computeBoundingSphere();
  }, [a, b]);
  return (
    <group>
      <instancedMesh ref={planks} args={[cachedGeo('plank', () => roundedBox(1.5, 0.08, 0.5, 0.03, 2)), plankMat, count]} castShadow receiveShadow raycast={() => null} />
      {ropes.map((r, i) => (
        <group key={i}>
          <mesh geometry={r.geo} material={ropeMat} raycast={() => null} />
          {[r.pa, r.pb].map((p, k) => (
            <mesh key={k} material={postMat} position={[p.x, p.y - 0.45, p.z]} castShadow raycast={() => null}>
              <cylinderGeometry args={[0.07, 0.09, 1.1, 8]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

const riverMat = makeFlowMaterial({ deep: '#2f8fd8', shallow: '#7fd3f7', foam: '#ffffff', speed: 0.35, sparkle: 0.8, gloss: 0.7, scale: 0.15 });

function River({ land, rules }: { land: number; rules: QuestRules }) {
  const z = landZ(land, rules) - landDepth(land, rules) / 2 - BRIDGE / 2;
  return (
    <mesh material={riverMat} position={[0, -1.6, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[60, BRIDGE + 5, 1, 1]} />
    </mesh>
  );
}

const nestMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
const shellMat = new THREE.MeshPhysicalMaterial({ color: '#fffaf0', roughness: 0.4, clearcoat: 0.6 });

function Nest({ rules }: { rules: QuestRules }) {
  const p = spacePos(0, rules);
  return (
    <group position={[p.x, groundHeight(p.x, p.z) - 0.02, p.z]}>
      <mesh geometry={nestGeometry()} material={nestMat} receiveShadow castShadow raycast={() => null} />
      {[
        [0.45, 0.25, 0.2, 0.4],
        [-0.4, 0.22, 0.35, -0.6],
        [0.1, 0.2, -0.5, 1.2],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} material={shellMat} position={[x, y, z]} rotation={[r, r * 2, 0.4]} raycast={() => null}>
          <sphereGeometry args={[0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      ))}
    </group>
  );
}

export interface LandProps {
  land: number;
  stars: number;
  rules?: QuestRules;
  prize: Prize;
  /** the chest has been opened */
  opened: boolean;
  /** detail level: the land being looked at gets everything */
  full: boolean;
}

export function Land({ land, stars, rules = DEFAULT_RULES, prize, opened, full }: LandProps) {
  const ground = useMemo(() => landGround(land, rules), [land, rules]);
  void landCurve;
  return (
    <group>
      <mesh geometry={ground} material={groundMat} receiveShadow raycast={() => null} />
      <Stones land={land} stars={stars} rules={rules} />
      <Chest land={land} rules={rules} prize={prize} opened={opened} />
      {land === 0 && <Nest rules={rules} />}
      <Bridge land={land} rules={rules} />
      <River land={land} rules={rules} />
      {full && <Decor land={land} rules={rules} />}
      <Landmark land={land} rules={rules} />
    </group>
  );
}
