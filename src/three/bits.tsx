// Reusable little scene pieces: glow halos, blob shadows, tappable wobbly
// props with squash-and-stretch, and a ghost hand that demonstrates gestures.

import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame, type ThreeElements, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { cachedGeo, curveFrom, merge, radialTexture, roundedBox, tube } from './geometry';
import { blobShadowMaterial, glowSpriteMaterial } from './materials';
import { Spring, TAU, clamp, ease } from './util';
import { burst, type ParticleKind } from './Particles';
import { sfx, type SoundName } from '../audio/sfx';
import { frameDt } from '../game/actors';
import { motion } from '../game/settings';

export function Glow({
  color = '#ffe08a',
  size = 1,
  opacity = 0.85,
  ...props
}: { color?: THREE.ColorRepresentation; size?: number; opacity?: number } & ThreeElements['sprite']) {
  const mat = glowSpriteMaterial(radialTexture(), color, opacity);
  return <sprite material={mat} scale={[size, size, size]} raycast={() => null} {...props} />;
}

export function BlobShadow({ size = 1, ...props }: { size?: number } & ThreeElements['mesh']) {
  const geo = useMemo(() => cachedGeo('blob-plane', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), []);
  return (
    <mesh geometry={geo} material={blobShadowMaterial(radialTexture())} scale={[size, 1, size]} raycast={() => null} {...props} />
  );
}

interface WobblyProps {
  children: ReactNode;
  sound?: SoundName | null;
  soundArg?: number;
  particles?: ParticleKind | null;
  particleColors?: THREE.ColorRepresentation[];
  /** invisible hit sphere radius (bigger = easier to tap) */
  hit?: number;
  hitOffset?: [number, number, number];
  onTap?: (e: ThreeEvent<PointerEvent>) => void;
  strength?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  spin?: boolean;
}

/** A prop that squashes, wobbles and sparkles when tapped. */
export function Wobbly({
  children,
  sound = 'boing',
  soundArg = 0,
  particles = 'sparkle',
  particleColors,
  hit,
  hitOffset = [0, 0.5, 0],
  onTap,
  strength = 1,
  spin = false,
  ...props
}: WobblyProps) {
  const inner = useRef<THREE.Group>(null!);
  const spring = useMemo(() => new Spring(0, 260, 9), []);
  const spinS = useMemo(() => ({ v: 0, a: 0 }), []);
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    const v = spring.update(dt);
    const k = clamp(v, -0.6, 0.6);
    inner.current.scale.set(1 + k * 0.55, 1 - k, 1 + k * 0.55);
    if (spin) {
      spinS.v *= Math.exp(-2.5 * dt);
      spinS.a += spinS.v * dt;
      inner.current.rotation.y = spinS.a;
    }
  });
  const handle = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    spring.kick(5.5 * strength);
    if (spin) spinS.v += 14;
    if (sound) sfx.play(sound, soundArg);
    if (particles) {
      const p = e.point.clone();
      burst(particles, p, { colors: particleColors });
    }
    onTap?.(e);
  };
  return (
    <group {...props}>
      <group ref={inner} onPointerDown={hit ? undefined : handle}>
        {children}
      </group>
      {hit ? (
        <mesh visible={false} position={hitOffset} onPointerDown={handle}>
          <sphereGeometry args={[hit, 10, 8]} />
        </mesh>
      ) : null}
    </group>
  );
}

// ------------------------------------------------------------- hint hand

function gloveGeometry() {
  return cachedGeo('glove', () => {
    const parts: THREE.BufferGeometry[] = [];
    const palm = roundedBox(0.2, 0.22, 0.1, 0.05, 3);
    palm.translate(0, 0.16, 0);
    parts.push(palm);
    // pointing index finger (down the -y axis to the tip at the origin)
    parts.push(
      tube(curveFrom([[0.0, 0.07, 0.0], [0.0, 0.035, 0.0], [0.0, 0.0, 0.0]]), {
        segments: 6,
        radial: 10,
        radius: (t) => 0.035 * (t > 0.8 ? Math.sqrt(Math.max(0.05, (1 - t) / 0.2)) : 1),
      }),
    );
    for (let i = 0; i < 3; i++) {
      const s = new THREE.SphereGeometry(0.038, 10, 8);
      s.translate(-0.065 + i * 0.065, 0.06, 0.035);
      parts.push(s);
    }
    const thumb = new THREE.CapsuleGeometry(0.03, 0.06, 4, 8);
    thumb.rotateZ(0.9);
    thumb.translate(0.11, 0.13, 0.02);
    parts.push(thumb);
    const cuff = new THREE.TorusGeometry(0.1, 0.035, 8, 20);
    cuff.rotateX(Math.PI / 2);
    cuff.translate(0, 0.28, 0);
    parts.push(cuff);
    return merge(parts);
  });
}

const gloveMat = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  roughness: 0.5,
  emissive: new THREE.Color('#fff2fb'),
  emissiveIntensity: 0.45,
  transparent: true,
  opacity: 0.92,
});

const ringMat = new THREE.MeshBasicMaterial({
  color: '#fff6c2',
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  toneMapped: false,
});

export type Gesture = 'tap' | 'swipe' | 'drag' | 'spin';

/**
 * A friendly ghost glove that shows how to play: tapping, swiping back and
 * forth, dragging from A to B, or circling.
 */
export function HintHand({
  visible,
  gesture,
  from,
  to,
  scale = 1,
}: {
  visible: boolean;
  gesture: Gesture;
  from: [number, number, number];
  to?: [number, number, number];
  scale?: number;
}) {
  const g = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const st = useRef({ t: 0, show: 0 });
  const geo = useMemo(() => gloveGeometry(), []);
  const ringGeo = useMemo(() => cachedGeo('hint-ring', () => new THREE.TorusGeometry(0.22, 0.025, 8, 40)), []);
  const ringMaterial = useMemo(() => ringMat.clone(), []);
  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const s = st.current;
    s.show = THREE.MathUtils.damp(s.show, visible ? 1 : 0, 6, dt);
    g.current.visible = s.show > 0.02;
    if (!g.current.visible) return;
    s.t += dt * (motion.reduced ? 0.6 : 1);
    const cycle = 1.8;
    const u = (s.t % cycle) / cycle;
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...(to ?? from));
    const p = new THREE.Vector3();
    let press = 0;
    if (gesture === 'tap') {
      p.copy(a);
      press = Math.max(0, Math.sin(u * TAU * 2));
    } else if (gesture === 'swipe') {
      p.lerpVectors(a, b, ease.inOutSine(u < 0.5 ? u * 2 : 2 - u * 2));
      press = 0.6;
    } else if (gesture === 'drag') {
      const k = ease.inOutCubic(clamp(u * 1.4, 0, 1));
      p.lerpVectors(a, b, k);
      press = u < 0.75 ? 0.8 : 0;
    } else {
      const ang = u * TAU;
      const r = a.distanceTo(b) || 0.6;
      p.set(a.x + Math.cos(ang) * r, a.y, a.z + Math.sin(ang) * r * 0.6);
      press = 0.6;
    }
    g.current.position.set(p.x, p.y + 0.12 * (1 - press) + 0.02, p.z);
    g.current.scale.setScalar(s.show * scale);
    g.current.quaternion.copy(state.camera.quaternion);
    ring.current.position.set(0, -0.02, 0);
    const rs = gesture === 'tap' ? 0.6 + u * 1.4 : 0.9;
    ring.current.scale.setScalar(rs);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = gesture === 'tap' ? 0.9 * (1 - u) : 0.5;
  });
  return (
    <group ref={g} visible={false}>
      <mesh geometry={geo} material={gloveMat} raycast={() => null} rotation={[0, 0, 0.35]} />
      <mesh ref={ring} geometry={ringGeo} material={ringMaterial} raycast={() => null} />
    </group>
  );
}
