// Stop 9 — Pop fizzy bubbles until a friendly bubble whale rises. Big fizzy
// bubbles float up from a glowing spot in the lagoon; each pop makes the
// glow ring brighter. After eight pops a whale made of shimmering bubbles
// rises, smiles, winks and spouts a fizzy fountain before sinking back.

import { useEffect, useMemo, useRef } from 'react';
import { debugState, debugTargets } from '../game/debugTargets';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { StopFrame, useStop } from './common';
import { STOP_DEFS, localToWorld } from '../world/stopDefs';
import { cachedGeo } from '../three/geometry';
import { gloss, matte } from '../three/materials';
import { makeBubbleMaterial } from '../three/shaders';
import { HintHand, Glow } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pipReact, zef, zefPlay } from '../game/actors';
import { WATER_Y } from '../game/route';
import { TAU, clamp, ease, mulberry32, randRange } from '../three/util';

const ID = 9;
const POPS = 8;
const N_BUBBLES = 5;

/** Points filling a whale silhouette (body along +z, head forward). */
function whaleBubbleSpecs() {
  const rng = mulberry32(99);
  const out: { p: THREE.Vector3; r: number }[] = [];
  const radiusAt = (z: number) => {
    // z from -2 (tail) to 1.6 (nose)
    const u = (z + 2) / 3.6;
    return 1.05 * Math.pow(Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.62), 0.9) * (u > 0.85 ? 1 - (u - 0.85) * 1.5 : 1) + 0.12;
  };
  for (let i = 0; i < 70; i++) {
    const z = randRange(rng, -2, 1.6);
    const R = radiusAt(z);
    const a = rng() * TAU;
    const rr = R * Math.sqrt(rng()) * 0.85;
    out.push({ p: new THREE.Vector3(Math.cos(a) * rr * 1.1, Math.sin(a) * rr * 0.85, z), r: randRange(rng, 0.16, 0.34) * (0.6 + R * 0.5) });
  }
  // tail flukes
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const t = (i >> 1) / 5;
    out.push({ p: new THREE.Vector3(side * (0.25 + t * 0.9), 0.15 + t * 0.35, -2.1 - t * 0.35), r: 0.2 - t * 0.06 });
  }
  // flippers
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const t = (i >> 1) / 3;
    out.push({ p: new THREE.Vector3(side * (1.0 + t * 0.5), -0.35 - t * 0.25, 0.4 - t * 0.2), r: 0.17 - t * 0.04 });
  }
  return out;
}

export function Stop09Whale() {
  const s = useStop(ID);
  const d = STOP_DEFS[ID];
  const [ox, , oz] = d.object;
  const baseY = WATER_Y - 0.12; // object y is relative to the path; water sits a bit lower
  const bubbleMat = useMemo(() => makeBubbleMaterial('#fff6c8', 1.25), []);
  const whaleMat = useMemo(() => makeBubbleMaterial('#ffe9a0', 1.6), []);
  const specs = useMemo(() => whaleBubbleSpecs(), []);
  const whaleInst = useRef<THREE.InstancedMesh>(null!);
  const whale = useRef<THREE.Group>(null!);
  const eyeL = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const bubbles = useRef<(THREE.Group | null)[]>([]);
  const rng = useMemo(() => mulberry32(9), []);
  const st = useMemo(
    () => ({
      pops: 0,
      whaleT: -1,
      spoutT: 0,
      b: Array.from({ length: N_BUBBLES }, (_, i) => ({ y: (i / N_BUBBLES) * 1.6, x: Math.cos(i * 2.4) * 0.8, z: Math.sin(i * 2.4) * 0.8, r: 0.42 + (i % 3) * 0.06, sp: 0.22 + (i % 2) * 0.08, popT: -1 })),
    }),
    [],
  );
  const worldAt = (x: number, y: number, z: number) => localToWorld(ID, [ox + x, y, oz + z]);

  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const t = state.clock.elapsedTime;
    const surfaceY = WATER_Y - localToWorld(ID, [0, 0, 0]).y;
    // rising fizzy bubbles
    st.b.forEach((b, i) => {
      const g = bubbles.current[i];
      if (!g) return;
      if (b.popT >= 0) {
        b.popT += dt;
        if (b.popT > 0.8) {
          b.popT = -1;
          b.y = 0;
          b.x = randRange(rng, -1.0, 1.0);
          b.z = randRange(rng, -0.9, 0.9);
        }
        g.visible = false;
        return;
      }
      g.visible = st.whaleT < 0 || st.whaleT > 8;
      b.y += dt * b.sp;
      if (b.y > 2.2) b.y = 0;
      const k = b.y / 2.2;
      g.position.set(ox + b.x + Math.sin(t + i) * 0.1, surfaceY + 0.2 + b.y, oz + b.z);
      g.scale.setScalar(b.r * clamp(k * 5, 0.2, 1) * (1 + Math.sin(t * 4 + i) * 0.04));
    });
    // glow ring grows with each pop
    const glow = st.whaleT >= 0 ? 1 : st.pops / POPS;
    ring.current.scale.setScalar(0.8 + glow * 1.6 + Math.sin(t * 3) * 0.05);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + glow * 0.5;
    ring.current.position.y = surfaceY + 0.03;

    // the whale
    if (st.whaleT >= 0) {
      st.whaleT += dt;
      const w = st.whaleT;
      const rise = w < 2 ? ease.outBack(w / 2) : w < 8 ? 1 : 1 - ease.inOutSine((w - 8) / 2);
      whale.current.visible = w < 10;
      whale.current.position.set(ox + 0.2, surfaceY - 2.2 + rise * 2.4 + Math.sin(t * 1.5) * 0.08, oz);
      whale.current.rotation.set(-0.25 * rise + Math.sin(t) * 0.05, -Math.PI / 2 + 0.5 + Math.sin(t * 0.6) * 0.15, Math.sin(t * 0.8) * 0.06);
      if (w > 2.2 && st.spoutT <= 0 && w < 8) spout();
      st.spoutT -= dt;
      // a slow wink
      const wink = w > 4 && w < 4.5 ? Math.abs(Math.cos(((w - 4) / 0.5) * Math.PI)) : 1;
      eyeL.current.scale.y = wink;
      if (w > 10) {
        st.whaleT = -1;
        st.pops = 0;
        burst('bubble', worldAt(0, surfaceY + 0.2, 0), { count: 12, up: 1.2, size: 0.15 });
      }
      // bubble wobble
      const m = new THREE.Matrix4();
      specs.forEach((sp, i) => {
        const wob = 1 + Math.sin(t * 3 + i * 1.7) * 0.06;
        m.makeScale(sp.r * wob, sp.r * wob, sp.r * wob).setPosition(sp.p.x, sp.p.y + Math.sin(t * 2 + i) * 0.03, sp.p.z);
        whaleInst.current.setMatrixAt(i, m);
      });
      whaleInst.current.instanceMatrix.needsUpdate = true;
    } else whale.current.visible = false;
  });

  const spout = () => {
    st.spoutT = 2.2;
    const top = new THREE.Vector3();
    whale.current.localToWorld(top.set(0, 1.0, 0.7));
    burst('bubble', top, { count: 16, up: 4.5, speed: 1, gravity: -2, size: 0.16, life: 2 });
    burst('sparkle', top, { count: 18, up: 4, speed: 1.4, gravity: -3, colors: ['#fff3bf', '#ffe066', '#ffffff'] });
    sfx.play('whale');
  };

  const popBubble = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!s.ask()) return;
    const b = st.b[i];
    if (b.popT >= 0 || st.whaleT >= 0) return;
    b.popT = 0;
    st.pops++;
    sfx.play('pop');
    burst('sparkle', e.point, { count: 12, colors: ['#fff3bf', '#ffffff', '#ffe066'] });
    burst('bubble', e.point, { count: 5, size: 0.08, speed: 1.2 });
    if (st.pops >= POPS) {
      st.whaleT = 0;
      st.spoutT = 0;
      sfx.play('magic');
      burst('drop', worldAt(0, 0, 0).setY(WATER_Y + 0.2), { count: 30, colors: ['#ffe066', '#fff3bf'], speed: 3, up: 3, size: 0.07 });
      zef.expression = 'wow';
      zefPlay('lookUp', 2);
      pipReact('surprised', 1.4);
      setTimeout(() => {
        zef.expression = 'happy';
        zefPlay('cheer', 1.4);
        pipReact('cheer', 1.4);
      }, 1800);
      setTimeout(() => (zef.expression = 'smile'), 4500);
    } else if (st.pops % 3 === 0) pipReact('giggle', 1);
  };

  const tapWhale = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!s.ask() || st.whaleT < 0) return;
    spout();
    burst('heart', e.point, { count: 4 });
    st.whaleT = Math.min(st.whaleT, 6);
  };

  useEffect(() => {
    debugState.set('whale', () => ({ pops: st.pops, whaleT: st.whaleT }));
    debugTargets.set('fizzBubbles', () =>
      bubbles.current.filter((g, i) => g && g.visible && st.b[i].popT < 0).map((g) => g!.getWorldPosition(new THREE.Vector3())),
    );
  }, [st]);

  const nextBubble = st.b.findIndex((b) => b.popT < 0);
  const hb = st.b[Math.max(0, nextBubble)];

  return (
    <StopFrame id={ID}>
      <mesh ref={ring} position={[ox, baseY, oz]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[0.7, 1, 40]} />
        <meshBasicMaterial color="#fff3a0" transparent opacity={0.3} depthWrite={false} toneMapped={false} />
      </mesh>
      <Glow color="#ffe680" size={3} opacity={0.25} position={[ox, 0.2, oz]} />
      {st.b.map((_, i) => (
        <group key={i} ref={(g) => (bubbles.current[i] = g)}>
          <mesh material={bubbleMat} raycast={() => null} renderOrder={3}>
            <sphereGeometry args={[1, 20, 14]} />
          </mesh>
          {/* generous invisible tap target (in bubble scale) */}
          <mesh visible={false} onPointerDown={popBubble(i)} scale={1.9}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        </group>
      ))}
      <group ref={whale} visible={false} onPointerDown={tapWhale}>
        <instancedMesh ref={whaleInst} args={[cachedGeo('bubble-sphere', () => new THREE.SphereGeometry(1, 14, 10)), whaleMat, specs.length]} renderOrder={3} frustumCulled={false} />
        {/* a solid, friendly face so the whale reads clearly */}
        <mesh material={gloss('#ffe9a8', 0.3, 0.5)} position={[0, -0.05, 0.2]} scale={[1.0, 0.82, 1.35]}>
          <sphereGeometry args={[0.85, 24, 18]} />
        </mesh>
        <group ref={eyeL} position={[0.55, 0.22, 1.05]}>
          <mesh material={gloss('#1d1430', 0.08, 1)}>
            <sphereGeometry args={[0.13, 14, 12]} />
          </mesh>
          <mesh material={matte('#ffffff', 0.2)} position={[0.04, 0.05, 0.1]}>
            <sphereGeometry args={[0.04, 8, 6]} />
          </mesh>
        </group>
        <group position={[-0.55, 0.22, 1.05]}>
          <mesh material={gloss('#1d1430', 0.08, 1)}>
            <sphereGeometry args={[0.13, 14, 12]} />
          </mesh>
          <mesh material={matte('#ffffff', 0.2)} position={[0.04, 0.05, 0.1]}>
            <sphereGeometry args={[0.04, 8, 6]} />
          </mesh>
        </group>
        <mesh material={matte('#b8572f', 0.5)} position={[0, -0.22, 1.2]} rotation={[0.2, 0, Math.PI]}>
          <torusGeometry args={[0.36, 0.045, 8, 24, Math.PI * 0.85]} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} material={matte('#ff9fb4', 0.5)} position={[sx * 0.72, -0.05, 0.95]} rotation={[0, sx * 0.9, 0]}>
            <circleGeometry args={[0.12, 14]} />
          </mesh>
        ))}
        <mesh visible={false}>
          <sphereGeometry args={[2, 10, 8]} />
        </mesh>
      </group>
      <HintHand visible={s.hint && st.whaleT < 0} gesture="tap" from={[ox + hb.x, WATER_Y + 0.9, oz + hb.z]} scale={1.3} />
    </StopFrame>
  );
}
