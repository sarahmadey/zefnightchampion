// Stop 8 — Drag licorice strands to braid a little bridge. Three droopy
// licorice ropes hang across a fizzy creek; each back-and-forth drag braids
// them a little further until they tighten into an arched bridge with wafer
// planks, and Pip trots across and back.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { StopFrame, useDrag, useStop } from './common';
import { STOP_DEFS, localToWorld } from '../world/stopDefs';
import { cachedGeo, curveFrom, flowRibbon, gumdropGeometry, roundedBox, tube } from '../three/geometry';
import { gloss, jelly, matte } from '../three/materials';
import { HintHand } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pip, pipReact, zef, zefPlay } from '../game/actors';
import { pipSpot } from '../game/nav';
import { TAU, clamp, ease, lerp, smoothstep } from '../three/util';
import { waterMaterial } from '../world/regions/River';

const ID = 8;
const SPAN = 2.6;
const CROSSINGS = 3.5;
const COLORS = ['#e3182f', '#2b1a1f', '#ff4d6d'];

/** Points of strand k with braid progress p (0 loose … 1 braided) and arch lift. */
function strandPoints(k: number, p: number, lift: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = (u - 0.5) * SPAN;
    const ph = u * CROSSINGS * TAU + (k * TAU) / 3;
    // braided part near the start, loose and sagging beyond the progress line
    const b = 1 - smoothstep(p - 0.08, p + 0.02, u);
    const braidZ = Math.sin(ph) * 0.12;
    const braidY = Math.sin(2 * ph) * 0.05;
    const looseZ = (k - 1) * 0.22;
    const sag = -Math.sin(u * Math.PI) * 0.2;
    const arch = Math.sin(u * Math.PI) * 0.38 * lift;
    const y = 0.35 + lerp(sag, 0, b * lift + (1 - lift) * b * 0.6) + braidY * b + arch;
    pts.push([x, y, lerp(looseZ, braidZ, b)]);
  }
  return pts;
}

function Strand({ k, state }: { k: number; state: { p: number; lift: number; dirty: boolean } }) {
  const ref = useRef<THREE.Mesh>(null!);
  const last = useRef({ p: -1, lift: -1 });
  useFrame(() => {
    if (Math.abs(last.current.p - state.p) < 0.002 && Math.abs(last.current.lift - state.lift) < 0.002) return;
    last.current = { p: state.p, lift: state.lift };
    const g = tube(curveFrom(strandPoints(k, state.p, state.lift)), {
      segments: 80,
      radial: 8,
      radius: (t, a) => 0.055 * (1 + 0.12 * Math.cos(a * 5 + t * 60)) * (Math.min(t, 1 - t) < 0.02 ? 0.7 : 1),
    });
    ref.current.geometry.dispose();
    ref.current.geometry = g;
  });
  return (
    <mesh ref={ref} material={gloss(COLORS[k], 0.25, 0.7)} castShadow>
      <bufferGeometry />
    </mesh>
  );
}

export function Stop08Braid() {
  const s = useStop(ID);
  const d = STOP_DEFS[ID];
  const [ox, , oz] = d.object;
  const st = useMemo(() => ({ p: 0, target: 0, lift: 0, dirty: true, dragAcc: 0, done: false, doneT: 0, walkT: -1, planks: 0 }), []);
  const planks = useRef<(THREE.Mesh | null)[]>([]);
  const bridge = useRef<THREE.Group>(null!);
  // the creek runs along the path direction, the little bridge spans it
  const creek = useMemo(
    () =>
      cachedGeo('braid-creek', () => {
        const pts: [number, number, number][] = [
          [ox + 0.4, 0, oz + 5],
          [ox - 0.2, 0, oz + 2],
          [ox, 0, oz],
          [ox + 0.3, 0, oz - 2.5],
          [ox - 0.3, 0, oz - 5.5],
        ];
        return flowRibbon(curveFrom(pts), () => 0.75, () => 0.03, 60, 6);
      }),
    [ox, oz],
  );
  const waterMat = useMemo(() => waterMaterial(), []);

  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    st.p = THREE.MathUtils.damp(st.p, st.target, 4, dt);
    const wantLift = st.target >= 1 ? 1 : 0;
    st.lift = THREE.MathUtils.damp(st.lift, wantLift, wantLift ? 3 : 5, dt);
    if (st.target >= 1 && !st.done && st.p > 0.97) {
      st.done = true;
      st.doneT = 0;
      sfx.play('fanfare');
      burst('sparkle', localToWorld(ID, [ox, 0.9, oz]), { count: 34, size: 0.2 });
      zef.expression = 'happy';
      zefPlay('celebrate', 1.5);
      setTimeout(() => (zef.expression = 'smile'), 1800);
      st.walkT = 0.8;
    }
    if (st.done) {
      st.doneT += dt;
      st.planks = Math.min(7, st.planks + dt * 6);
      if (st.doneT > 22) reset();
    } else st.planks = Math.max(0, st.planks - dt * 10);
    planks.current.forEach((m, i) => {
      if (!m) return;
      const u = (i + 0.5) / 7;
      const vis = clamp(st.planks - i, 0, 1);
      m.visible = vis > 0.01;
      m.scale.setScalar(ease.outBack(vis));
      m.position.set((u - 0.5) * SPAN, 0.35 + Math.sin(u * Math.PI) * 0.38 * st.lift + 0.1, 0);
      m.rotation.z = Math.cos(u * Math.PI) * 0.45 * st.lift;
    });
    // Pip trots over the new bridge and back
    if (st.walkT >= 0) {
      st.walkT += dt;
      const w = st.walkT - 0.8;
      if (w > 0) {
        if (pip.mode !== 'scripted') pip.mode = 'scripted';
        const u = w < 2.4 ? w / 2.4 : w < 3.2 ? 1 : w < 5.6 ? 1 - (w - 3.2) / 2.4 : -1;
        if (u < 0) {
          st.walkT = -1;
          pip.mode = 'stay';
          pip.speed = 0;
          pipReact('cheer', 1.2);
        } else {
          const e = clamp(u, 0, 1);
          const near = new THREE.Vector3(SPAN * 0.5 + 0.6, 0, 0);
          const far = new THREE.Vector3(-SPAN * 0.5 - 0.6, 0, 0);
          const lx = lerp(near.x, far.x, e);
          const bu = clamp((lx + SPAN / 2) / SPAN, 0, 1);
          const y = Math.abs(lx) < SPAN / 2 ? 0.4 + Math.sin(bu * Math.PI) * 0.38 : 0;
          const wp = localToWorld(ID, [ox + lx, y, oz]);
          pip.pos.copy(wp);
          const dir = w < 2.4 ? -1 : 1;
          const ahead = localToWorld(ID, [ox + lx + dir * 0.3, 0, oz]);
          pip.heading = Math.atan2(ahead.x - wp.x, ahead.z - wp.z);
          pip.speed = w > 2.4 && w < 3.2 ? 0 : 1.6;
          if (w > 2.4 && w < 2.5 && pip.reaction.name === 'none') pipReact('wave', 0.8);
        }
      }
    }
  });

  const reset = () => {
    st.target = 0;
    st.done = false;
    st.doneT = 0;
    st.dragAcc = 0;
    sfx.play('boing', 2);
    burst('sparkle', localToWorld(ID, [ox, 0.6, oz]), { count: 12 });
    if (pip.mode === 'scripted') {
      pip.mode = 'stay';
      pip.pos.copy(pipSpot.pos);
    }
  };

  const step = (amount: number) => {
    if (st.done) return;
    st.target = clamp(st.target + amount, 0, 1);
    sfx.play('squeak');
    burst('sparkle', localToWorld(ID, [ox + (st.target - 0.5) * SPAN, 0.5, oz]), { count: 5, size: 0.12, colors: ['#ff4d6d', '#ffffff'] });
    if (st.target >= 1) pipReact('surprised', 1);
  };

  const drag = useDrag({
    onStart: () => {
      if (!s.ask()) return false;
      if (st.done && st.doneT > 3) {
        reset();
        return false;
      }
    },
    onMove: (info) => {
      st.dragAcc += info.delta.length();
      while (st.dragAcc > 110) {
        st.dragAcc -= 110;
        step(1 / 7);
      }
    },
    onEnd: (info) => {
      s.touch();
      if (info.total.length() < 10) step(1 / 8);
    },
  });

  return (
    <StopFrame id={ID}>
      <mesh geometry={creek} material={waterMat} receiveShadow />
      {/* sugar-crystal banks */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} material={matte('#fff3c4', 0.6)} position={[ox + sx * 0.85, 0.05, oz]} scale={[0.25, 0.12, 10.5]}>
          <sphereGeometry args={[1, 12, 8]} />
        </mesh>
      ))}
      <group ref={bridge} position={[ox, 0, oz]}>
        {[0, 1, 2].map((k) => (
          <Strand key={k} k={k} state={st} />
        ))}
        {/* candy posts the strands are tied to */}
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * (SPAN / 2 + 0.08), 0, 0]}>
            <mesh material={gloss('#fff6e8', 0.4, 0.3)} position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.09, 0.11, 0.7, 10]} />
            </mesh>
            <mesh geometry={gumdropGeometry(16)} material={jelly(sx > 0 ? '#ff6b8b' : '#ffd43b')} position={[0, 0.7, 0]} scale={0.32} />
          </group>
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} ref={(m) => (planks.current[i] = m)} geometry={cachedGeo('braid-plank', () => roundedBox(0.3, 0.06, 0.55, 0.025, 2))} material={matte('#f0c070', 0.6)} visible={false} castShadow />
        ))}
        <mesh visible={false} position={[0, 0.35, 0]} {...drag}>
          <boxGeometry args={[SPAN + 1.0, 1.4, 2.2]} />
        </mesh>
        <HintHand visible={s.hint} gesture="swipe" from={[-0.8, 0.6, 0.3]} to={[0.8, 0.6, 0.3]} scale={1.2} />
      </group>
    </StopFrame>
  );
}
