// The treasure chest at the end of every land, with its prize floating
// above it as a teaser. When Zef reaches it, a tap pops the lid and the
// prize rises up big and bright.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_RULES, type QuestRules } from '../state/progress';
import { chestPos, headingAt } from './layout';
import { landRange } from '../state/progress';
import { prizeGeometry } from './prizeIcons';
import { cachedGeo, lathe, roundedBox } from '../three/geometry';
import { Glow } from '../three/bits';
import { damp } from '../three/util';
import { frameDt } from '../game/actors';
import type { Prize } from '../game/rewards';

/** Driven by the director while a chest opens. */
export const chestAnim = { land: -1, open: 0, rise: 0, wiggle: 0 };

let chestTapHandler: (() => void) | null = null;
export function onChestTap(fn: (() => void) | null) {
  chestTapHandler = fn;
}

const wood = new THREE.MeshStandardMaterial({ color: '#a0612b', roughness: 0.75 });
const woodDark = new THREE.MeshStandardMaterial({ color: '#7a4520', roughness: 0.8 });
const gold = new THREE.MeshPhysicalMaterial({ color: '#ffc63a', metalness: 0.8, roughness: 0.25, clearcoat: 0.6 });
const platformMat = new THREE.MeshPhysicalMaterial({ color: '#fff3d6', roughness: 0.5, clearcoat: 0.3 });
const prizeMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, clearcoat: 0.6, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.08 });

function lidGeo() {
  return cachedGeo('chest-lid', () => {
    const g = new THREE.CylinderGeometry(0.31, 0.31, 0.92, 20, 1, false, 0, Math.PI);
    g.rotateZ(Math.PI / 2);
    g.rotateX(-Math.PI / 2);
    // hinge at the back edge
    g.translate(0, 0, 0.3);
    return g;
  });
}

export function Chest({ land, rules = DEFAULT_RULES, prize, opened }: { land: number; rules?: QuestRules; prize: Prize; opened: boolean }) {
  const pos = chestPos(land, rules);
  const end = landRange(land, rules).end;
  const yaw = useMemo(() => headingAt(end - 1, rules) + Math.PI, [end, rules]);
  const lid = useRef<THREE.Group>(null!);
  const icon = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const st = useRef({ open: opened ? 1 : 0, t: 0 });
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    const s = st.current;
    s.t += dt;
    const active = chestAnim.land === land;
    const openGoal = active ? chestAnim.open : opened ? 1 : 0;
    s.open = damp(s.open, openGoal, 6, dt);
    lid.current.rotation.x = -s.open * 1.9;
    const rise = active ? chestAnim.rise : 0;
    const wig = active ? chestAnim.wiggle : 0;
    body.current.rotation.z = Math.sin(s.t * 18) * 0.06 * wig;
    body.current.position.y = Math.abs(Math.sin(s.t * 9)) * 0.06 * wig;
    const baseY = opened && !active ? 0.75 : 1.55 + Math.sin(s.t * 1.6) * 0.08;
    icon.current.position.y = baseY + rise * 1.4;
    const sc = (opened && !active ? 0.8 : 0.75) * (1 + rise * 0.9);
    icon.current.scale.setScalar(sc);
    icon.current.rotation.y += dt * (0.8 + rise * 2.5);
  });
  return (
    <group position={[pos.x, pos.y - 0.16, pos.z]}>
      <mesh
        geometry={cachedGeo('chest-platform', () => lathe([[0, 0], [1.05, 0], [1.12, 0.08], [1.08, 0.18], [0.95, 0.22], [0, 0.23]], 36, 8))}
        material={platformMat}
        receiveShadow
        raycast={() => null}
      />
      <mesh material={gold} position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[1.0, 0.04, 8, 48]} />
      </mesh>
      <group rotation={[0, yaw, 0]} position={[0, 0.22, 0]}>
        <group ref={body}>
          <mesh geometry={cachedGeo('chest-base', () => roundedBox(0.9, 0.5, 0.6, 0.05))} material={wood} position={[0, 0.25, 0]} castShadow raycast={() => null} />
          {[-0.36, 0.36].map((x) => (
            <mesh key={x} geometry={cachedGeo('chest-band', () => roundedBox(0.08, 0.52, 0.62, 0.02))} material={gold} position={[x, 0.25, 0]} raycast={() => null} />
          ))}
          <group ref={lid} position={[0, 0.5, -0.3]}>
            <mesh geometry={lidGeo()} material={woodDark} castShadow raycast={() => null} />
            {[-0.36, 0.36].map((x) => (
              <mesh key={x} material={gold} position={[x, 0, 0.3]} rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
                <cylinderGeometry args={[0.32, 0.32, 0.07, 20, 1, false, 0, Math.PI]} />
              </mesh>
            ))}
          </group>
          <mesh geometry={cachedGeo('chest-lock', () => roundedBox(0.16, 0.18, 0.06, 0.03))} material={gold} position={[0, 0.46, 0.31]} raycast={() => null} />
        </group>
      </group>
      <group ref={icon} position={[0, 1.55, 0]}>
        <mesh geometry={prizeGeometry(prize.icon)} material={prizeMat} castShadow raycast={() => null} />
        <Glow color="#fff1a8" size={2.2} opacity={0.55} />
      </group>
      {/* a generous tap target over the chest and the prize */}
      <mesh
        position={[0, 0.9, 0]}
        visible={false}
        onPointerDown={(e) => {
          e.stopPropagation();
          chestTapHandler?.();
        }}
      >
        <sphereGeometry args={[1.35, 10, 8]} />
      </mesh>
    </group>
  );
}
