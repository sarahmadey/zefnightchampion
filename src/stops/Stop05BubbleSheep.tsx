// Stop 5 — Drag floating bubbles to make silly bubble-sheep shapes. Bubbles
// drift near a fluffy pedestal; dragged (or tapped) bubbles stick together,
// and five of them turn into a wobbly sheep with a face, ears and stick legs
// that baas, hops and floats off to the sky. A bubble wand blows new ones.

import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { StopFrame, createDrag, useStop, type DragOpts } from './common';
import { STOP_DEFS, localToWorld } from '../world/stopDefs';
import { cachedGeo, paint, puffGeometry } from '../three/geometry';
import { gloss, marshmallowVC, matte } from '../three/materials';
import { makeBubbleMaterial } from '../three/shaders';
import { HintHand } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pipReact, zef, zefPlay } from '../game/actors';
import { TAU, clamp, mulberry32, randRange } from '../three/util';
import { stopFrame } from '../game/route';

const ID = 5;
const NEED = 5;

interface Bubble {
  pos: THREE.Vector3;
  home: THREE.Vector3;
  r: number;
  state: 'float' | 'drag' | 'fly' | 'stuck' | 'gone';
  offset: THREE.Vector3;
  wob: number;
  ph: number;
  spawn: number;
}

interface SheepLook {
  head: number;
  ears: 'up' | 'down';
  legs: number;
  eyes: [number, number];
  horn: boolean;
}

const LOOKS: SheepLook[] = [
  { head: 1, ears: 'down', legs: 1, eyes: [1, 1], horn: false },
  { head: 1.3, ears: 'up', legs: 0.7, eyes: [1.4, 0.8], horn: false },
  { head: 0.8, ears: 'down', legs: 1.5, eyes: [1, 1], horn: true },
  { head: 1.1, ears: 'up', legs: 1.1, eyes: [0.8, 1.5], horn: false },
];

export function Stop05BubbleSheep() {
  const s = useStop(ID);
  const d = STOP_DEFS[ID];
  const [ox, oy, oz] = d.object;
  const camera = useThree((st) => st.camera);
  const bubbleMat = useMemo(() => makeBubbleMaterial('#ffffff', 1.25), []);
  const cluster = useMemo(() => new THREE.Vector3(ox, oy - 0.05, oz), [ox, oy, oz]);
  const rng = useMemo(() => mulberry32(55), []);
  const makeBubble = (i: number, spawn = 0): Bubble => {
    const a = (i / 6) * TAU + rng() * 0.5;
    const home = new THREE.Vector3(ox + Math.cos(a) * randRange(rng, 1.1, 1.7), oy + randRange(rng, -0.2, 0.9), oz + Math.sin(a) * randRange(rng, 0.9, 1.5));
    return { pos: spawn ? new THREE.Vector3(ox + 1.3, 0.9, oz + 0.6) : home.clone(), home, r: randRange(rng, 0.24, 0.32), state: 'float', offset: new THREE.Vector3(), wob: 0, ph: rng() * TAU, spawn };
  };
  const bubbles = useMemo<Bubble[]>(() => Array.from({ length: 7 }, (_, i) => makeBubble(i)), []);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const hits = useRef<(THREE.Mesh | null)[]>([]);
  const sheep = useRef<THREE.Group>(null!);
  const legsRef = useRef<THREE.Group>(null!);
  const st = useMemo(() => ({ made: 0, sheep: 0, sheepT: 0, floatAway: 0, dragIdx: -1, stuck: 0 }), []);
  const [look, setLook] = useState<SheepLook>(LOOKS[0]);
  const yaw = useMemo(() => stopFrame(ID).yaw, []);

  // a vertical plane facing the camera through a point (local coords)
  const planeFor = (p: THREE.Vector3) => {
    const worldP = localToWorld(ID, [p.x, p.y, p.z]);
    const n = new THREE.Vector3().subVectors(camera.position, worldP).setY(0).normalize();
    return new THREE.Plane().setFromNormalAndCoplanarPoint(n, worldP);
  };
  const toLocal = (w: THREE.Vector3) => {
    const f = stopFrame(ID);
    const rel = w.clone().sub(f.origin);
    return new THREE.Vector3(rel.dot(f.right), rel.y, -rel.dot(f.forward));
  };

  const attach = (b: Bubble) => {
    b.state = 'fly';
    sfx.play('pop');
    const stuckOnes = bubbles.filter((x) => x.state === 'stuck' || x.state === 'fly').length;
    // pick a spot on the cluster: first in the middle, then around it
    const a = stuckOnes * 2.1;
    b.offset.set(stuckOnes === 0 ? 0 : Math.cos(a) * 0.3, stuckOnes === 0 ? 0 : Math.sin(stuckOnes * 1.7) * 0.18 + 0.05, stuckOnes === 0 ? 0 : Math.sin(a) * 0.24);
  };

  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const t = state.clock.elapsedTime;
    let stuck = 0;
    bubbles.forEach((b, i) => {
      const m = meshes.current[i];
      const h = hits.current[i];
      if (b.spawn > 0) {
        b.spawn -= dt;
        if (m) m.visible = false;
        if (h) h.scale.setScalar(0.0001);
        return;
      }
      if (b.state === 'float') {
        const target = b.home.clone().add(new THREE.Vector3(Math.sin(t * 0.6 + b.ph) * 0.15, Math.sin(t * 0.9 + b.ph) * 0.12, Math.cos(t * 0.5 + b.ph) * 0.12));
        b.pos.lerp(target, Math.min(1, dt * 1.5));
      } else if (b.state === 'fly') {
        const target = cluster.clone().add(b.offset);
        b.pos.lerp(target, Math.min(1, dt * 7));
        if (b.pos.distanceTo(target) < 0.03) {
          b.state = 'stuck';
          b.wob = 1;
          burst('sparkle', localToWorld(ID, [b.pos.x, b.pos.y, b.pos.z]), { count: 5, size: 0.1 });
          sfx.play('chime', bubbles.filter((x) => x.state === 'stuck').length + 3);
        }
      } else if (b.state === 'stuck') {
        stuck++;
        b.pos.copy(cluster).add(b.offset);
        if (st.sheep > 0) b.pos.y += st.floatAway * 4 + Math.abs(Math.sin(st.sheepT * 5)) * 0.15 * (st.floatAway > 0 ? 0 : 1);
      }
      b.wob = Math.max(0, b.wob - dt * 2);
      if (m) {
        m.visible = b.state !== 'gone';
        m.position.copy(b.pos);
        const w = 1 + Math.sin(t * 12 + b.ph) * 0.08 * b.wob + Math.sin(t * 2 + b.ph) * 0.02;
        m.scale.set(b.r * w, (b.r / w) * (b.state === 'stuck' ? 0.95 : 1), b.r * w);
      }
      if (h) {
        // hit spheres stay invisible; shrink them away when the bubble can't be grabbed
        h.position.copy(b.pos);
        h.scale.setScalar(b.state === 'float' || b.state === 'drag' ? 1 : 0.0001);
      }
    });
    st.stuck = stuck;

    // five stuck bubbles become a sheep!
    if (st.sheep === 0 && stuck >= NEED) {
      st.sheep = 1;
      st.sheepT = 0;
      st.floatAway = 0;
      setLook(LOOKS[st.made % LOOKS.length]);
      st.made++;
      sfx.play('baa');
      burst('sparkle', localToWorld(ID, [cluster.x, cluster.y + 0.3, cluster.z]), { count: 26, size: 0.18 });
      burst('heart', localToWorld(ID, [cluster.x, cluster.y + 0.5, cluster.z]), { count: 4 });
      zef.expression = 'happy';
      zefPlay('clap', 1.6);
      pipReact('giggle', 1.4);
      setTimeout(() => (zef.expression = 'smile'), 1800);
    }
    if (st.sheep > 0) {
      st.sheepT += dt;
      if (st.sheepT > 6.5 && st.floatAway === 0) st.floatAway = 0.001;
      if (st.floatAway > 0) {
        st.floatAway += dt * 0.35;
        if (st.floatAway > 1.2) {
          // the sheep has floated away: blow fresh bubbles
          st.sheep = 0;
          st.floatAway = 0;
          bubbles.forEach((b, i) => {
            if (b.state === 'stuck') Object.assign(b, makeBubble(i, 0.4 + i * 0.35));
          });
          sfx.play('whoosh');
        }
      }
    }
    sheep.current.visible = st.sheep > 0;
    if (st.sheep > 0) {
      const hop = st.floatAway > 0 ? 0 : Math.abs(Math.sin(st.sheepT * 5)) * 0.15;
      sheep.current.position.set(cluster.x, cluster.y + hop + st.floatAway * 4, cluster.z);
      sheep.current.rotation.y = Math.sin(st.sheepT * 1.5) * 0.4 + 0.6;
      const pop = clamp(st.sheepT * 3, 0, 1);
      sheep.current.scale.setScalar(pop);
      legsRef.current.children.forEach((l, k) => (l.rotation.x = Math.sin(st.sheepT * 10 + k * Math.PI) * 0.4 * (st.floatAway > 0 ? 0.3 : 1)));
    }
  });

  const optsRef = useRef<((i: number) => DragOpts) | null>(null);
  optsRef.current = (i: number) => ({
      plane: () => planeFor(bubbles[i].pos),
      onStart: () => {
        if (!s.ask()) return false;
        const b = bubbles[i];
        if (b.state !== 'float') return false;
        b.state = 'drag';
        st.dragIdx = i;
        sfx.play('tap');
      },
      onMove: (info) => {
        const b = bubbles[i];
        const p = toLocal(info.point);
        b.pos.copy(p);
        b.pos.y = clamp(b.pos.y, 0.4, 3.2);
      },
      onEnd: (info) => {
        const b = bubbles[i];
        st.dragIdx = -1;
        if (b.state !== 'drag') return;
        const near = b.pos.distanceTo(cluster) < 1.25;
        const tapped = info.total.length() < 10;
        if ((near || tapped) && st.sheep === 0) attach(b);
        else {
          b.state = 'float';
          b.home.copy(b.pos);
          b.wob = 1;
        }
      },
    });
  const drags = useMemo(() => bubbles.map((_, i) => createDrag(() => optsRef.current!(i))), [bubbles]);

  const tapSheep = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!s.ask() || st.sheep === 0) return;
    sfx.play('baa');
    burst('heart', e.point, { count: 3 });
    if (st.floatAway === 0) st.sheepT = Math.max(st.sheepT, 5.5);
  };

  const free = bubbles.findIndex((b) => b.state === 'float' && b.spawn <= 0);
  const hintFrom = free >= 0 ? bubbles[free].home : new THREE.Vector3(ox + 1, oy, oz);
  void yaw;

  return (
    <StopFrame id={ID}>
      {/* fluffy pedestal where the sheep forms */}
      <mesh geometry={cachedGeo('sheep-pedestal', () => paint(puffGeometry(515, 6, 0.8, 3), (p) => new THREE.Color('#ffe3f1').lerp(new THREE.Color('#ffffff'), THREE.MathUtils.smoothstep(p.y, -0.2, 0.3))))} material={marshmallowVC()} position={[ox, 0.25, oz]} scale={[1.0, 0.5, 1.0]} castShadow />
      {/* bubble wand */}
      <group position={[ox + 1.5, 0, oz + 0.7]} rotation={[0, 0, -0.25]}>
        <mesh material={matte('#ffffff', 0.4)} position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 1.0, 8]} />
        </mesh>
        <mesh material={gloss('#ff8fc4', 0.3, 0.6)} position={[0, 1.15, 0]}>
          <torusGeometry args={[0.18, 0.04, 8, 20]} />
        </mesh>
      </group>
      {bubbles.map((_, i) => (
        <group key={i}>
          <mesh ref={(m) => (meshes.current[i] = m)} material={bubbleMat} raycast={() => null} renderOrder={3}>
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
          <mesh ref={(m) => (hits.current[i] = m)} visible={false} {...drags[i]}>
            <sphereGeometry args={[0.55, 10, 8]} />
          </mesh>
        </group>
      ))}
      {/* the sheep's face, ears, legs and tail appear around the bubble cluster */}
      <group ref={sheep} visible={false} onPointerDown={tapSheep}>
        <group position={[0, 0.05, 0.42]} scale={look.head}>
          <mesh material={matte('#3b2a3a', 0.6)} scale={[0.85, 1, 0.8]}>
            <sphereGeometry args={[0.2, 18, 14]} />
          </mesh>
          {[-1, 1].map((sx, k) => (
            <group key={sx} position={[0.075 * sx, 0.04, 0.15]}>
              <mesh material={matte('#ffffff', 0.3)} scale={look.eyes[k]}>
                <sphereGeometry args={[0.05, 12, 10]} />
              </mesh>
              <mesh material={matte('#111111', 0.3)} position={[0, -0.005, 0.035 * look.eyes[k]]} scale={look.eyes[k]}>
                <sphereGeometry args={[0.025, 10, 8]} />
              </mesh>
            </group>
          ))}
          <mesh material={matte('#ff8fb1', 0.5)} position={[0, -0.09, 0.14]} scale={[1.3, 0.6, 0.6]}>
            <sphereGeometry args={[0.04, 10, 8]} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={`e${sx}`} material={matte('#3b2a3a', 0.6)} position={[0.19 * sx, look.ears === 'up' ? 0.14 : 0.0, 0]} rotation={[0, 0, sx * (look.ears === 'up' ? -0.5 : 1.1)]} scale={[0.5, 1.2, 0.35]}>
              <sphereGeometry args={[0.1, 10, 8]} />
            </mesh>
          ))}
          {look.horn && (
            <mesh material={gloss('#ffd43b', 0.3, 0.6)} position={[0, 0.22, 0.02]}>
              <coneGeometry args={[0.04, 0.16, 10]} />
            </mesh>
          )}
        </group>
        <group ref={legsRef}>
          {[
            [-0.17, -0.12],
            [0.17, -0.12],
            [-0.17, 0.16],
            [0.17, 0.16],
          ].map(([x, z], k) => (
            <group key={k} position={[x, -0.2, z]}>
              <mesh material={matte('#3b2a3a', 0.6)} position={[0, -0.12 * look.legs, 0]} scale={[1, look.legs, 1]}>
                <capsuleGeometry args={[0.035, 0.18, 4, 8]} />
              </mesh>
            </group>
          ))}
        </group>
        <mesh material={matte('#ffffff', 0.4)} position={[0, 0.05, -0.42]}>
          <sphereGeometry args={[0.08, 10, 8]} />
        </mesh>
      </group>
      <HintHand visible={s.hint} gesture="drag" from={[hintFrom.x, hintFrom.y, hintFrom.z]} to={[cluster.x, cluster.y + 0.1, cluster.z]} scale={1.2} />
    </StopFrame>
  );
}
