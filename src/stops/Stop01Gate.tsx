// Stop 1 — Swipe to open a strawberry-flower gate. Woven vine doors covered
// in strawberry blossoms swing open as Zef swipes; behind them a glowing ruby
// strawberry pops up and candy butterflies flutter out.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { StopFrame, useDrag, useStop, useStopWake } from './common';
import { STOP_DEFS } from '../world/stopDefs';
import { cachedGeo, cuppedPetal, curveFrom, extrude, merge, miniStrawberryGeometry, paint, petalShape, strawberryGeometry, tube } from '../three/geometry';
import { emissive, gloss, matte, vcolor, vcolorGloss } from '../three/materials';
import { Glow, HintHand } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pipReact, zef, zefPlay } from '../game/actors';
import { Spring, TAU, clamp, ease } from '../three/util';

const ID = 1;

function postGeometry() {
  return cachedGeo('gate-post', () => {
    const parts: THREE.BufferGeometry[] = [];
    const stem = tube(curveFrom([[0, 0, 0], [0.05, 0.7, 0.03], [-0.04, 1.4, -0.02], [0, 2.05, 0]]), {
      segments: 24,
      radial: 10,
      radius: (t) => 0.12 * (1 - t * 0.25),
    });
    paint(stem, '#3a9a45');
    parts.push(stem);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      const leaf = cuppedPetal(0.45, 0.2, -0.06, 0.02);
      leaf.rotateX(-0.8);
      leaf.rotateY(-a);
      leaf.translate(Math.cos(a) * 0.08, 0.5 + i * 0.35, Math.sin(a) * 0.08);
      paint(leaf, '#4cbf55');
      parts.push(leaf);
    }
    const berry = strawberryGeometry(12, 30);
    berry.scale(0.55, 0.55, 0.55);
    berry.translate(0, 2.4, 0);
    parts.push(berry);
    return merge(parts);
  });
}

function archGeometry() {
  return cachedGeo('gate-arch', () => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push([-1.15 + t * 2.3, 2.0 + Math.sin(t * Math.PI) * 0.75, Math.sin(t * TAU * 2) * 0.05]);
    }
    const vine = tube(curveFrom(pts), { segments: 60, radial: 8, radius: () => 0.08 });
    paint(vine, '#3a9a45');
    const parts: THREE.BufferGeometry[] = [vine];
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const x = -1.15 + t * 2.3;
      const y = 2.0 + Math.sin(t * Math.PI) * 0.75;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        const p = cuppedPetal(0.12, 0.08, 0.02, 0.012);
        p.rotateX(-Math.PI / 2 + 1.2);
        p.rotateZ(a);
        p.translate(x, y + 0.02, 0.09);
        paint(p, '#ffffff');
        parts.push(p);
      }
      const c = new THREE.SphereGeometry(0.04, 8, 6);
      c.translate(x, y + 0.02, 0.12);
      paint(c, '#ffd43b');
      parts.push(c);
      if (i === 2 || i === 4) {
        const b = miniStrawberryGeometry();
        b.rotateX(Math.PI);
        b.scale(0.3, 0.3, 0.3);
        b.translate(x, y - 0.32, 0);
        parts.push(b);
      }
    }
    return merge(parts);
  });
}

function doorLatticeGeometry() {
  return cachedGeo('gate-door', () => {
    const parts: THREE.BufferGeometry[] = [];
    const W = 1.08;
    const H = 1.65;
    const frame = tube(
      curveFrom([
        [0, 0.15, 0],
        [W, 0.15, 0],
        [W, H, 0],
        [0, H, 0],
        [0, 0.15, 0],
      ], 0),
      { segments: 64, radial: 8, radius: () => 0.055 },
    );
    parts.push(frame);
    for (let i = 1; i < 5; i++) {
      const x = (i / 5) * W;
      parts.push(tube(curveFrom([[x, 0.15, 0], [x + 0.05, H * 0.55, 0.02], [x, H, 0]]), { segments: 12, radial: 6, radius: () => 0.035 }));
    }
    for (let i = 0; i < 4; i++) {
      const y = 0.4 + i * 0.35;
      parts.push(tube(curveFrom([[0, y, 0.01], [W * 0.5, y + 0.12, 0.03], [W, y, 0.01]]), { segments: 12, radial: 6, radius: () => 0.03 }));
    }
    return paint(merge(parts), '#2f8a3c');
  });
}

function petalGeo() {
  return cachedGeo('gate-petal', () => extrude(petalShape(0.3, 0.2), 0.02, 0.01, 8));
}

/** A strawberry blossom whose five petals open with `bloom` (0 bud … 1 open). */
function Blossom({ position, bloom, scale = 1 }: { position: [number, number, number]; bloom: { v: number }; scale?: number }) {
  const petals = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const b = clamp(bloom.v, 0, 1.2);
    petals.current.forEach((m, k) => {
      if (!m) return;
      const a = (k / 5) * TAU;
      // closed: petals stand up to form a bud; open: they lie flat facing outward
      m.rotation.set(0, 0, a);
      m.rotateX(1.35 - b * 1.25);
    });
  });
  return (
    <group position={position} scale={scale}>
      {Array.from({ length: 5 }, (_, k) => (
        <mesh key={k} ref={(m) => (petals.current[k] = m)} geometry={petalGeo()} material={matte('#ffffff', 0.4)} />
      ))}
      <mesh material={gloss('#ffd43b', 0.35, 0.4)} position={[0, 0, 0.04]} scale={[1, 1, 0.6]}>
        <sphereGeometry args={[0.08, 12, 10]} />
      </mesh>
    </group>
  );
}

function Butterfly({ phase, color, open }: { phase: number; color: string; open: { v: number } }) {
  const g = useRef<THREE.Group>(null!);
  const wl = useRef<THREE.Mesh>(null!);
  const wr = useRef<THREE.Mesh>(null!);
  const wing = useMemo(() => cachedGeo('bfly-wing', () => extrude(petalShape(0.22, 0.2), 0.01, 0.005, 8)), []);
  const st = useMemo(() => ({ t: phase }), [phase]);
  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    st.t += dt;
    const o = clamp(open.v, 0, 1);
    const t = st.t;
    // rest on the arch when the gate is closed; dance around it when open
    const rest = new THREE.Vector3(-0.5 + phase * 0.35, 2.75, 0.1);
    const fly = new THREE.Vector3(Math.cos(t * 1.3 + phase) * 1.3, 1.6 + Math.sin(t * 1.7 + phase) * 0.6 + o * 0.6, Math.sin(t * 1.1 + phase) * 1.0 - 0.6);
    g.current.position.lerpVectors(rest, fly, ease.inOutSine(o));
    g.current.rotation.y = t * 1.3 + phase;
    const flap = Math.sin(t * (6 + o * 14)) * (0.3 + o * 0.6);
    wl.current.rotation.set(0, 0, 0.6 + flap);
    wr.current.rotation.set(0, 0, -0.6 - flap);
  });
  return (
    <group ref={g}>
      <mesh ref={wl} geometry={wing} material={gloss(color, 0.3, 0.6)} rotation={[0, 0, 0.6]} />
      <mesh ref={wr} geometry={wing} material={gloss(color, 0.3, 0.6)} rotation={[0, 0, -0.6]} />
      <mesh material={matte('#5a2f3e', 0.6)} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.02, 0.12, 4, 6]} />
      </mesh>
    </group>
  );
}

export function Stop01Gate() {
  const s = useStop(ID);
  const d = STOP_DEFS[ID];
  const doorL = useRef<THREE.Group>(null!);
  const doorR = useRef<THREE.Group>(null!);
  const ruby = useRef<THREE.Group>(null!);
  const st = useMemo(
    () => ({ open: 0, target: 0, timer: 0, taps: 0, bloom: { v: s.unlocked ? 1 : 0 }, openRef: { v: 0 }, rubySpring: new Spring(0, 160, 7), wasOpen: false }),
    [],
  );
  const bloomAnim = useRef(-1);
  useStopWake(ID, () => {
    bloomAnim.current = 0;
  });

  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    // flowers bloom when the stop wakes, and stay as buds while asleep
    if (bloomAnim.current >= 0) {
      bloomAnim.current += dt;
      st.bloom.v = ease.outBack(clamp(bloomAnim.current / 1.4, 0, 1));
      if (bloomAnim.current > 1.4) bloomAnim.current = -1;
    } else st.bloom.v = THREE.MathUtils.damp(st.bloom.v, s.unlocked ? 1 : 0, 3, dt);
    if (st.timer > 0) {
      st.timer -= dt;
      if (st.timer <= 0) {
        st.target = 0;
        sfx.play('creak');
      }
    }
    st.open = THREE.MathUtils.damp(st.open, st.target, st.target > st.open ? 7 : 2.5, dt);
    st.openRef.v = st.open;
    const a = ease.outCubic(clamp(st.open, 0, 1)) * 1.65;
    doorL.current.rotation.y = a;
    doorR.current.rotation.y = -a;
    // the ruby strawberry springs up when the gate first opens wide
    const isOpen = st.open > 0.8;
    if (isOpen && !st.wasOpen) {
      st.rubySpring.kick(9);
      sfx.play('magic');
      burst('sparkle', new THREE.Vector3().setFromMatrixPosition(ruby.current.matrixWorld).setY(ruby.current.matrixWorld.elements[13] + 0.6), { count: 30, speed: 3, size: 0.2 });
      zef.expression = 'wow';
      zefPlay('cheer', 1.2);
      pipReact('cheer', 1.2);
      setTimeout(() => (zef.expression = 'smile'), 1600);
    }
    st.wasOpen = isOpen;
    const sp = st.rubySpring.update(dt);
    ruby.current.scale.setScalar(0.85 + st.open * 0.2 + sp * 0.12);
    ruby.current.position.y = 0.2 + st.open * 0.35 + Math.max(0, sp) * 0.1;
    ruby.current.rotation.y += dt * (0.5 + st.open);
  });

  const drag = useDrag({
    onStart: () => s.ask(),
    onMove: (info) => {
      const k = info.delta.length() / 170;
      if (k > 0) {
        st.target = clamp(Math.max(st.target, st.open) + k, 0, 1);
        if (Math.random() < 0.15) sfx.play('squeak');
      }
    },
    onEnd: (info) => {
      s.touch();
      if (info.total.length() < 10) {
        // a tap nudges the doors; three taps open them
        if (st.target > 0.9) {
          st.target = 0;
          sfx.play('creak');
          return;
        }
        st.target = clamp(st.target + 0.36, 0, 1);
        sfx.play('boing', st.taps++ % 3);
        burst('sparkle', info.event.point, { count: 8 });
      }
      if (st.target > 0.35) {
        st.target = 1;
        st.timer = 8;
        sfx.play('creak');
        burst('heart', info.event.point, { count: 5 });
      } else st.target = 0;
    },
  });

  const [ox, , oz] = d.object;
  return (
    <StopFrame id={ID}>
      <group position={[ox, 0, oz]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh geometry={postGeometry()} material={vcolorGloss(0.35, 0.5)} position={[-1.15, 0, 0]} castShadow />
        <mesh geometry={postGeometry()} material={vcolorGloss(0.35, 0.5)} position={[1.15, 0, 0]} castShadow />
        <mesh geometry={archGeometry()} material={vcolorGloss(0.4, 0.4)} castShadow />
        <group ref={doorL} position={[-1.1, 0, 0]}>
          <mesh geometry={doorLatticeGeometry()} material={vcolor(0.5, 'gate-door')} castShadow />
          <Blossom position={[0.55, 1.15, 0.06]} bloom={st.bloom} scale={1.25} />
          <Blossom position={[0.3, 0.55, 0.06]} bloom={st.bloom} scale={0.9} />
          <Blossom position={[0.85, 0.5, 0.06]} bloom={st.bloom} scale={0.75} />
        </group>
        <group ref={doorR} position={[1.1, 0, 0]} scale={[-1, 1, 1]}>
          <mesh geometry={doorLatticeGeometry()} material={vcolor(0.5, 'gate-door')} castShadow />
          <Blossom position={[0.55, 1.15, 0.06]} bloom={st.bloom} scale={1.25} />
          <Blossom position={[0.35, 0.6, 0.06]} bloom={st.bloom} scale={0.85} />
          <Blossom position={[0.85, 0.45, 0.06]} bloom={st.bloom} scale={0.8} />
        </group>
        {/* the secret patch behind the gate */}
        <group position={[0, 0, -1.3]}>
          <mesh material={matte('#5fbf5a', 0.8)} position={[0, 0.03, 0]}>
            <cylinderGeometry args={[1.2, 1.3, 0.06, 32]} />
          </mesh>
          <group ref={ruby} position={[0, 0.2, 0]}>
            <mesh geometry={cachedGeo('ruby-berry', () => strawberryGeometry(77, 60).translate(0, 0.62, 0))} material={vcolorGloss(0.15, 1)} scale={0.9} castShadow />
            <mesh material={emissive('#ff4f6d', 0.6)} position={[0, 0.55, 0]}>
              <sphereGeometry args={[0.18, 12, 10]} />
            </mesh>
            <Glow color="#ff7a90" size={2.4} opacity={0.5} position={[0, 0.6, 0]} />
          </group>
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <mesh key={k} geometry={cachedGeo('mini-berry', () => miniStrawberryGeometry().translate(0, 0.62, 0))} material={vcolorGloss(0.25, 0.8)} position={[Math.cos((k / 6) * TAU) * 0.9, 0, Math.sin((k / 6) * TAU) * 0.9]} scale={0.25} />
          ))}
        </group>
        <Butterfly phase={0} color="#ff9fc4" open={st.openRef} />
        <Butterfly phase={1.4} color="#b9a4ff" open={st.openRef} />
        <Butterfly phase={2.8} color="#ffd166" open={st.openRef} />
        {/* generous swipe area over the doors */}
        <mesh visible={false} position={[0, 1.0, 0.2]} {...drag}>
          <boxGeometry args={[2.8, 2.4, 0.9]} />
        </mesh>
        <HintHand visible={s.hint} gesture="swipe" from={[-0.9, 1.1, 0.6]} to={[0.9, 1.1, 0.6]} scale={1.3} />
      </group>
    </StopFrame>
  );
}
