// Stop 7 — Guide a lemon-slice boat across the river with a finger. Pip
// rides in the boat; drag it anywhere on the lemonade (it can't leave the
// water). Reaching the far bank pops up a lemon flag and a fizzy fountain.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { StopFrame, useDrag, useStop } from './common';
import { STOP_DEFS, localToWorld } from '../world/stopDefs';
import { cachedGeo, lemonSliceGeometry, merge, paint, roundedBox } from '../three/geometry';
import { matte, vcolor, vcolorGloss } from '../three/materials';
import { HintHand } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pip, pipReact, zef, zefPlay } from '../game/actors';
import { WATER_Y, riverCurve, riverInfo, RIVER_LENGTH } from '../game/route';
import { lemonBoatGeometry } from '../world/regions/River';
import { clamp, dampAngle } from '../three/util';
import { useGame } from '../state/store';

const ID = 7;

function dockGeometry() {
  return cachedGeo('wafer-dock', () => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const p = roundedBox(1.3, 0.08, 0.32, 0.03, 2);
      p.translate(0, 0, -i * 0.36);
      parts.push(paint(p, i % 2 ? '#e9b25c' : '#f0c070'));
    }
    for (const sx of [-0.6, 0.6]) {
      for (const z of [0, -1.4, -2.5]) {
        const post = new THREE.CylinderGeometry(0.07, 0.08, 1.2, 8);
        post.translate(sx, -0.45, z);
        parts.push(paint(post, '#d4142a'));
      }
    }
    return merge(parts);
  });
}

/** Signed position across the river: negative on the near (stop) side. */
function acrossRiver(p: THREE.Vector3, nearSign: number) {
  const r = riverInfo(p.x, p.z);
  const u = clamp(r.s / RIVER_LENGTH, 0, 1);
  const c = riverCurve.getPointAt(u);
  const t = riverCurve.getTangentAt(u);
  const side = Math.sign(t.x * (p.z - c.z) - t.z * (p.x - c.x)) || 1;
  return { k: (r.dist / r.half) * side * nearSign, center: c, tangent: t, half: r.half, dist: r.dist };
}

export function Stop07LemonBoat() {
  const s = useStop(ID);
  const d = STOP_DEFS[ID];
  const [ox, , oz] = d.object;
  const home = useMemo(() => localToWorld(ID, [ox, 0, oz + 1.1]).setY(WATER_Y + 0.08), [ox, oz]);
  const nearSign = useMemo(() => {
    const z = localToWorld(ID, [d.zef[0], 0, d.zef[1]]);
    return -Math.sign(acrossRiver(z, 1).k || 1);
  }, [d]);
  const boat = useRef<THREE.Group>(null!);
  const flag = useRef<THREE.Group>(null!);
  const st = useMemo(
    () => ({ pos: home.clone(), vel: new THREE.Vector3(), heading: 0, target: null as THREE.Vector3 | null, side: -1, flagUp: 0, wakeT: 0, spin: 0, riding: false }),
    [home],
  );
  const farFlagPos = useMemo(() => {
    const a = acrossRiver(home, nearSign);
    const n = new THREE.Vector3(-a.tangent.z, 0, a.tangent.x).multiplyScalar(-nearSign);
    return a.center.clone().addScaledVector(n, a.half + 0.9).setY(0);
  }, [home, nearSign]);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y), []);
  const focus = useGame((g) => g.focusStop);

  /** Keep the boat on the water near this stop. */
  const clampToRiver = (p: THREE.Vector3) => {
    const a = acrossRiver(p, 1);
    const maxD = a.half - 0.7;
    if (a.dist > maxD) {
      const dir = new THREE.Vector3(p.x - a.center.x, 0, p.z - a.center.z).normalize();
      p.x = a.center.x + dir.x * maxD;
      p.z = a.center.z + dir.z * maxD;
    }
    // stay upstream of the bridge and not too far away
    const lim = localToWorld(ID, [-1.6, 0, 0]);
    const right = localToWorld(ID, [1, 0, 0]).sub(localToWorld(ID, [0, 0, 0]));
    const rel = new THREE.Vector3().subVectors(p, lim);
    const over = rel.dot(right);
    if (over > 0) p.addScaledVector(right, -over);
    if (p.distanceTo(home) > 9) p.sub(home).setLength(9).add(home);
    return p;
  };

  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const t = state.clock.elapsedTime;
    if (st.target) {
      const to = st.target.clone().sub(st.pos);
      st.vel.lerp(to.multiplyScalar(6), Math.min(1, dt * 8));
    } else st.vel.multiplyScalar(Math.exp(-2.2 * dt));
    st.pos.addScaledVector(st.vel, dt);
    clampToRiver(st.pos);
    const sp = st.vel.length();
    if (sp > 0.15) st.heading = dampAngle(st.heading, Math.atan2(st.vel.x, st.vel.z), 6, dt);
    st.spin = Math.max(0, st.spin - dt * 4);
    boat.current.position.set(st.pos.x, WATER_Y + 0.08 + Math.sin(t * 2) * 0.04, st.pos.z);
    boat.current.rotation.set(Math.sin(t * 1.6) * 0.05 + sp * 0.02, st.heading + st.spin * 6.28, Math.sin(t * 1.3) * 0.06);
    // wake bubbles behind a moving boat
    st.wakeT += dt * sp;
    if (st.wakeT > 0.35) {
      st.wakeT = 0;
      const back = st.pos.clone().add(new THREE.Vector3(-Math.sin(st.heading) * 0.7, 0.05, -Math.cos(st.heading) * 0.7));
      burst('bubble', back.setY(WATER_Y + 0.05), { count: 2, size: 0.09, up: 0.2, speed: 0.3, life: 1.2 });
    }
    // reaching a bank is a little celebration
    const a = acrossRiver(st.pos, nearSign);
    const side = a.k > 0.35 ? 1 : a.k < -0.35 ? -1 : st.side;
    if (side !== st.side) {
      st.side = side;
      if (side > 0) {
        st.flagUp = 1;
        sfx.play('fanfare');
        burst('bubble', farFlagPos.clone().setY(WATER_Y + 0.3), { count: 14, up: 2.5, speed: 0.8, size: 0.14 });
        burst('sparkle', farFlagPos.clone().setY(1.2), { count: 24 });
        pipReact('cheer', 1.4);
        zefPlay('celebrate', 1.5);
        zef.expression = 'happy';
        setTimeout(() => (zef.expression = 'smile'), 1800);
      } else {
        sfx.play('chime', 4);
        pipReact('wave', 1.2);
        zefPlay('clap', 1.2);
      }
    }
    flag.current.scale.setScalar(THREE.MathUtils.damp(flag.current.scale.x, st.flagUp ? 1 : 0.001, 5, dt));
    flag.current.rotation.y = t * 0.8;
    // Pip rides the boat while Zef is here
    const ride = focus === ID;
    if (ride) {
      if (!st.riding) {
        st.riding = true;
        pip.mode = 'scripted';
        pip.pose = 'ride';
      }
      pip.pos.set(st.pos.x, WATER_Y + 0.12 + Math.sin(t * 2) * 0.04, st.pos.z);
      pip.heading = st.heading;
      pip.look = zef.pos;
    } else if (st.riding) {
      st.riding = false;
      pip.pose = 'stand';
      pip.mode = 'follow';
      pip.look = null;
    }
  });

  const drag = useDrag({
    plane: () => plane,
    onStart: () => {
      if (!s.ask()) return false;
      sfx.play('tap');
    },
    onMove: (info) => {
      st.target = clampToRiver(info.point.clone());
    },
    onEnd: (info) => {
      st.target = null;
      if (info.total.length() < 10) {
        st.spin = 1;
        st.vel.add(new THREE.Vector3(Math.sin(st.heading), 0, Math.cos(st.heading)).multiplyScalar(1.5));
        sfx.play('bloop');
        burst('drop', st.pos.clone().setY(WATER_Y + 0.2), { count: 8, colors: ['#ffe066', '#fff3bf'], size: 0.05 });
      }
    },
  });

  const hitRef = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    hitRef.current.position.set(st.pos.x, WATER_Y + 0.4, st.pos.z);
  });

  const hintTo = farFlagPos.clone().lerp(home, 0.25);

  return (
    <>
      <StopFrame id={ID}>
        <mesh geometry={dockGeometry()} material={vcolor(0.6, 'dock')} position={[ox, 0.1, oz + 3.3]} receiveShadow castShadow />
      </StopFrame>
      <group ref={boat} scale={1.35}>
        <mesh geometry={lemonBoatGeometry()} material={vcolorGloss(0.3, 0.6)} castShadow />
      </group>
      <mesh ref={hitRef} visible={false} {...drag}>
        <sphereGeometry args={[1.3, 10, 8]} />
      </mesh>
      {/* the lemon flag that pops up on the far bank */}
      <group position={farFlagPos} ref={flag} scale={0.001}>
        <mesh material={matte('#ffffff', 0.5)} position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 1.6, 8]} />
        </mesh>
        <mesh geometry={cachedGeo('flag-lemon', () => lemonSliceGeometry(0.45, 0.06, 9).rotateX(Math.PI / 2))} material={vcolorGloss(0.3, 0.5)} position={[0, 1.6, 0]} />
      </group>
      <HintHand visible={s.hint} gesture="drag" from={[home.x, WATER_Y + 0.5, home.z]} to={[hintTo.x, WATER_Y + 0.5, hintTo.z]} scale={1.3} />
    </>
  );
}
