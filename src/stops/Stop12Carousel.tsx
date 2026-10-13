// Stop 12 — Spin a cookie carousel. Swipe to spin; cookie animals bob up
// and down, canopy bulbs twinkle and a music-box tune plays faster as it
// spins. When it's really going, Pip hops on for a ride.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { StopFrame, useDrag, useStop } from './common';
import { STOP_DEFS, localToWorld } from '../world/stopDefs';
import { cachedGeo, curveFrom, extrude, gumdropGeometry, lathe, merge, paint, tube } from '../three/geometry';
import { gloss, jelly, matte, pattern, vcolor } from '../three/materials';
import { HintHand } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pip, pipReact, zef, zefPlay } from '../game/actors';
import { pipSpot } from '../game/nav';
import { TAU, clamp } from '../three/util';
import { useGame } from '../state/store';

const ID = 12;
const RIDE_R = 1.18;
const TUNE = [0, 2, 4, 2, 0, 4, 7, 4, 5, 4, 2, 0, 2, 4, 0, 0];

function shapeFromPoints(pts: [number, number][]) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    const [px, py] = pts[i - 1];
    s.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
  }
  s.closePath();
  return s;
}

const ANIMALS: Record<string, [number, number][]> = {
  horse: [
    [-0.32, -0.25], [-0.3, 0.05], [-0.18, 0.12], [0.12, 0.12], [0.22, 0.3], [0.3, 0.42], [0.42, 0.38], [0.38, 0.22],
    [0.3, 0.05], [0.3, -0.25], [0.2, -0.25], [0.18, -0.05], [-0.15, -0.05], [-0.18, -0.25],
  ],
  bear: [
    [-0.22, -0.25], [-0.26, 0.05], [-0.2, 0.2], [-0.24, 0.34], [-0.12, 0.38], [-0.06, 0.32], [0.06, 0.32], [0.12, 0.38],
    [0.24, 0.34], [0.2, 0.2], [0.26, 0.05], [0.22, -0.25],
  ],
  bunny: [
    [-0.2, -0.25], [-0.24, 0.05], [-0.14, 0.22], [-0.16, 0.48], [-0.08, 0.5], [-0.03, 0.28], [0.03, 0.28], [0.08, 0.5],
    [0.16, 0.48], [0.14, 0.22], [0.24, 0.05], [0.2, -0.25],
  ],
  duck: [
    [-0.3, -0.2], [-0.32, 0.02], [-0.2, 0.1], [-0.02, 0.1], [0.0, 0.3], [0.12, 0.38], [0.26, 0.32], [0.38, 0.28],
    [0.26, 0.2], [0.2, 0.08], [0.28, -0.05], [0.2, -0.2],
  ],
};

function cookieAnimal(name: string) {
  return cachedGeo(`cookie-${name}`, () => {
    const pts = ANIMALS[name];
    const body = extrude(shapeFromPoints(pts), 0.08, 0.03, 16);
    paint(body, '#d58b4a');
    // white icing outline and a dot eye
    const outline = tube(curveFrom([...pts.map(([x, y]) => [x * 0.86, y * 0.86 + 0.01, 0.075] as [number, number, number]), [pts[0][0] * 0.86, pts[0][1] * 0.86 + 0.01, 0.075]], 0.5), {
      segments: 80,
      radial: 5,
      radius: () => 0.012,
    });
    paint(outline, '#ffffff');
    const eye = new THREE.SphereGeometry(0.025, 8, 6);
    const [ex, ey] = name === 'horse' ? [0.3, 0.32] : name === 'duck' ? [0.16, 0.28] : [0.06, 0.18];
    eye.translate(ex, ey, 0.08);
    paint(eye, '#3a1e14');
    const g = merge([body, outline, eye]);
    g.scale(1.4, 1.4, 1.4);
    return g;
  });
}

function canopyGeometry() {
  return cachedGeo('carousel-canopy', () => {
    const roof = lathe(
      [
        [0, 1.1],
        [0.4, 1.0],
        [1.2, 0.45],
        [1.85, 0.06],
        [1.85, 0],
        [0, 0],
      ],
      40,
      16,
    );
    paint(roof, (p) => {
      const a = Math.atan2(p.z, p.x);
      return new THREE.Color(Math.floor(((a + Math.PI) / TAU) * 12) % 2 ? '#ff8fb8' : '#fff4f8');
    });
    // scalloped frosting rim
    const scallops: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const sc = new THREE.SphereGeometry(0.16, 10, 8);
      sc.scale(1, 0.8, 0.6);
      sc.rotateY(-a);
      sc.translate(Math.cos(a) * 1.86, -0.08, Math.sin(a) * 1.86);
      scallops.push(paint(sc, '#ffffff'));
    }
    return merge([roof, ...scallops]);
  });
}

export function Stop12Carousel() {
  const s = useStop(ID);
  const d = STOP_DEFS[ID];
  const [ox, , oz] = d.object;
  const spinner = useRef<THREE.Group>(null!);
  const riders = useRef<(THREE.Group | null)[]>([]);
  const bulbs = useRef<(THREE.Mesh | null)[]>([]);
  const st = useMemo(() => ({ angle: 0, omega: 0, noteT: 0, note: 0, riding: false, prev: new THREE.Vector3() }), []);
  const focus = useGame((g) => g.focusStop);
  const names = ['horse', 'bear', 'bunny', 'duck'];

  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const t = state.clock.elapsedTime;
    st.omega *= Math.exp(-0.28 * dt);
    if (Math.abs(st.omega) < 0.02) st.omega = 0;
    st.angle += st.omega * dt;
    spinner.current.rotation.y = st.angle;
    const speed = Math.abs(st.omega);
    riders.current.forEach((r, i) => {
      if (!r) return;
      r.position.y = 0.95 + Math.sin(st.angle * 3 + i * 1.6) * 0.22 * clamp(speed, 0, 1.5);
    });
    bulbs.current.forEach((b, i) => {
      if (!b) return;
      const on = 0.5 + 0.5 * Math.sin(t * (3 + speed * 4) + i * 1.3);
      (b.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + on * (0.8 + speed);
    });
    // music box: tempo follows the spin
    if (speed > 0.25) {
      st.noteT += dt * (1.2 + speed * 1.6);
      if (st.noteT > 1) {
        st.noteT = 0;
        sfx.play('musicBox', TUNE[st.note % TUNE.length]);
        st.note++;
        if (st.note % 4 === 0) burst('note', localToWorld(ID, [ox + (Math.random() - 0.5) * 2, 2.6, oz + (Math.random() - 0.5) * 2]), { count: 1 });
      }
    }
    // Pip rides along on the duck when it spins fast
    const shouldRide = focus === ID && speed > 1.6;
    if (shouldRide && !st.riding) {
      st.riding = true;
      pip.mode = 'scripted';
      pip.pose = 'ride';
      pipReact('cheer', 1);
      zefPlay('clap', 1.4);
      zef.expression = 'happy';
    }
    if (st.riding) {
      const duck = riders.current[3];
      if (duck) {
        const p = new THREE.Vector3();
        duck.getWorldPosition(p);
        const dx = p.x - st.prev.x;
        const dz = p.z - st.prev.z;
        if (dx * dx + dz * dz > 1e-6) pip.heading = Math.atan2(dx, dz);
        st.prev.copy(p);
        pip.pos.set(p.x, p.y + 0.15, p.z);
      }
      if (speed < 0.6 || focus !== ID) {
        st.riding = false;
        pip.pose = 'stand';
        pip.mode = focus === ID ? 'stay' : 'follow';
        if (focus === ID) pip.pos.copy(pipSpot.pos);
        zef.expression = 'smile';
        pipReact('flip', 1);
      }
    }
  });

  const drag = useDrag({
    onStart: () => {
      if (!s.ask()) return false;
    },
    onMove: (info) => {
      // swipe left or right across the carousel to spin it that way
      const below = info.screen.y > innerHeight * 0.5 ? 1 : -1;
      st.omega += info.delta.x * 0.012 * below;
      st.omega = clamp(st.omega, -5, 5);
    },
    onEnd: (info) => {
      s.touch();
      if (info.total.length() < 10) {
        st.omega += st.omega >= 0 ? 1.2 : -1.2;
        sfx.play('musicBox', 4);
        burst('sparkle', info.event.point, { count: 8 });
      } else sfx.play('whoosh');
    },
  });

  return (
    <StopFrame id={ID}>
      <group position={[ox, 0, oz]}>
        {/* cookie base */}
        <mesh material={matte('#d58b4a', 0.75)} position={[0, 0.12, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.75, 1.85, 0.24, 48]} />
        </mesh>
        {Array.from({ length: 20 }, (_, i) => {
          const a = (i / 20) * TAU;
          return (
            <mesh key={i} material={matte(['#ffffff', '#ff8fb8', '#ffd43b', '#9fe3ff'][i % 4], 0.4)} position={[Math.cos(a) * 1.6, 0.26, Math.sin(a) * 1.6]}>
              <sphereGeometry args={[0.07, 8, 6]} />
            </mesh>
          );
        })}
        <group ref={spinner}>
          <mesh material={matte('#fff3e6', 0.6)} position={[0, 0.27, 0]}>
            <cylinderGeometry args={[1.62, 1.62, 0.06, 40]} />
          </mesh>
          <mesh material={pattern({ a: '#ffffff', b: '#ff3b5c', mode: 'helix', freq: 2, twist: 5 })} position={[0, 1.55, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 2.6, 16]} />
          </mesh>
          <mesh geometry={canopyGeometry()} material={vcolor(0.5, 'canopy')} position={[0, 2.85, 0]} castShadow />
          <mesh geometry={gumdropGeometry(20)} material={jelly('#ffd43b')} position={[0, 3.9, 0]} scale={0.45} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * TAU;
            return (
              <mesh key={i} ref={(m) => (bulbs.current[i] = m)} position={[Math.cos(a) * 1.7, 2.82, Math.sin(a) * 1.7]}>
                <sphereGeometry args={[0.07, 10, 8]} />
                <meshStandardMaterial color="#fff2b0" emissive="#ffd36b" emissiveIntensity={1} toneMapped={false} />
              </mesh>
            );
          })}
          {names.map((n, i) => {
            const a = (i / names.length) * TAU;
            return (
              <group key={n} position={[Math.cos(a) * RIDE_R, 0, Math.sin(a) * RIDE_R]} rotation={[0, -a, 0]}>
                <mesh material={gloss('#ffd23f', 0.25, 0.8)} position={[0, 1.5, 0]}>
                  <cylinderGeometry args={[0.035, 0.035, 2.5, 8]} />
                </mesh>
                <group ref={(g) => (riders.current[i] = g)} position={[0, 0.95, 0]}>
                  <mesh geometry={cookieAnimal(n)} material={vcolor(0.6, 'cookie-animal')} rotation={[0, Math.PI / 2, 0]} castShadow />
                </group>
              </group>
            );
          })}
        </group>
        <mesh visible={false} position={[0, 1.4, 0]} {...drag}>
          <cylinderGeometry args={[2.3, 2.3, 3.2, 16]} />
        </mesh>
        <HintHand visible={s.hint} gesture="swipe" from={[-1.2, 1.0, 1.9]} to={[1.2, 1.0, 1.9]} scale={1.3} />
      </group>
    </StopFrame>
  );
}
