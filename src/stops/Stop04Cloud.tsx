// Stop 4 — Tap a marshmallow cloud to bounce Zef gently. Zef hops onto a
// springy cloud; every tap sends him a little higher while the cloud squashes
// and puffs. Pip bounces along on a tiny cloud nearby.

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { StopFrame, useStop } from './common';
import { STOP_DEFS, localToWorld, stopWorldPoints } from '../world/stopDefs';
import { cachedGeo, paint, puffGeometry } from '../three/geometry';
import { marshmallowVC } from '../three/materials';
import { HintHand } from '../three/bits';
import { burst } from '../three/Particles';
import { sfx } from '../audio/sfx';
import { frameDt, pip, pipReact, zef, zefPlay } from '../game/actors';
import { placeZefOnRoute } from '../game/nav';
import { stopSpotRoute } from '../game/world';
import { Spring, clamp, ease } from '../three/util';

const ID = 4;
const TOP = 0.95;

function bigCloudGeometry() {
  return cachedGeo('bounce-cloud', () => {
    const g = puffGeometry(808, 9, 1.25, 3);
    paint(g, (p) => new THREE.Color('#ffd9ec').lerp(new THREE.Color('#ffffff'), THREE.MathUtils.smoothstep(p.y, -0.3, 0.45)));
    return g;
  });
}

type Phase = 'idle' | 'hopOn' | 'bouncing' | 'hopOff';

export function Stop04Cloud() {
  const s = useStop(ID);
  const d = STOP_DEFS[ID];
  const [ox, oy, oz] = d.object;
  const cloud = useRef<THREE.Group>(null!);
  const mini = useRef<THREE.Group>(null!);
  const st = useMemo(
    () => ({ phase: 'idle' as Phase, t: 0, h: 0, v: 0, combo: 0, idle: 0, squash: new Spring(0, 140, 7), mini: new Spring(0, 150, 6), pipH: 0, pipV: 0, pipOn: false, from: new THREE.Vector3() }),
    [],
  );
  const top = () => localToWorld(ID, [ox, oy + TOP * (1 - st.squash.value * 0.6), oz]);

  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const sq = st.squash.update(dt);
    cloud.current.scale.set(1.6 * (1 + sq * 0.35), 1.25 * (1 - sq * 0.6), 1.6 * (1 + sq * 0.35));
    cloud.current.position.y = oy + Math.sin(state.clock.elapsedTime * 1.2) * 0.04;
    const ms = st.mini.update(dt);
    mini.current.scale.set(0.8 * (1 + ms * 0.4), 0.6 * (1 - ms * 0.6), 0.8 * (1 + ms * 0.4));

    // Pip's little bounces echo Zef's
    st.pipV -= 9 * dt;
    st.pipH = Math.max(0, st.pipH + st.pipV * dt);
    if (st.pipH === 0 && st.pipV < 0) {
      if (st.pipV < -2) st.mini.kick(-3);
      st.pipV = 0;
    }
    if (s.focused && pip.mode === 'stay') {
      pip.air = st.pipH + 0.28 * (1 - Math.min(1, ms));
      st.pipOn = true;
    } else if (st.pipOn) {
      st.pipOn = false;
      pip.air = 0;
    }

    if (st.phase === 'idle') return;
    st.t += dt;
    if (st.phase === 'hopOn') {
      const u = clamp(st.t / 0.7, 0, 1);
      const p = top();
      zef.pos.lerpVectors(st.from, p, ease.inOutSine(u));
      zef.pos.y += Math.sin(u * Math.PI) * 0.9;
      if (u >= 1) {
        st.phase = 'bouncing';
        st.h = 0;
        st.v = 3.4;
        st.squash.kick(-4);
        burst('puff', p, { count: 6, size: 0.3 });
        sfx.play('boing', 0);
      }
    } else if (st.phase === 'bouncing') {
      st.v -= 9 * dt;
      st.h += st.v * dt;
      if (st.h <= 0) {
        st.h = 0;
        const p = top();
        // keep a gentle rhythm going; taps add height
        const impact = Math.abs(st.v);
        st.squash.kick(-Math.min(6, impact * 0.9));
        zef.stretch = 0.82;
        setTimeout(() => (zef.stretch = 1), 140);
        burst('puff', p, { count: 4, size: 0.26, speed: 1.2 });
        st.v = Math.max(0, impact * 0.62);
        if (st.v < 1.2) st.v = 0;
        st.pipV = 2.6;
      }
      zef.pos.copy(top()).setY(top().y + st.h);
      zef.expression = st.h > 0.3 ? 'happy' : 'smile';
      if (st.h > 0.15 && zef.action.name !== 'cheer') zefPlay('cheer', 0.8);
      st.idle += dt;
      if (st.idle > 3.6 && st.h === 0 && st.v === 0) {
        st.phase = 'hopOff';
        st.t = 0;
        st.from.copy(zef.pos);
      }
    } else if (st.phase === 'hopOff') {
      const u = clamp(st.t / 0.7, 0, 1);
      const spot = stopWorldPoints(ID).zef;
      zef.pos.lerpVectors(st.from, spot, ease.inOutSine(u));
      zef.pos.y += Math.sin(u * Math.PI) * 0.7;
      if (u >= 1) {
        st.phase = 'idle';
        zef.scripted = false;
        zef.expression = 'smile';
        const r = stopSpotRoute(ID);
        placeZefOnRoute(r.s, r.lateral);
        zef.heading = Math.atan2(localToWorld(ID, [ox, 0, oz]).x - zef.pos.x, localToWorld(ID, [ox, 0, oz]).z - zef.pos.z);
      }
    }
  });

  const tap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!s.ask()) return;
    st.idle = 0;
    if (st.phase === 'idle') {
      st.phase = 'hopOn';
      st.t = 0;
      st.combo = 0;
      zef.scripted = true;
      zef.nav = null;
      zef.speed = 0;
      st.from.copy(zef.pos);
      zefPlay('jump', 0.8);
      pipReact('cheer', 1);
      return;
    }
    if (st.phase === 'bouncing') {
      st.combo = Math.min(3, st.combo + 1);
      // a tap while landing or rising gives a bigger, still gentle, bounce
      st.v = Math.max(st.v, 3.0 + st.combo * 0.4);
      if (st.h === 0) st.squash.kick(-4);
      sfx.play('boing', st.combo);
      burst('sparkle', zef.pos.clone().setY(zef.pos.y + 0.6), { count: 8 });
      st.pipV = 3.2;
      if (st.combo >= 3) pipReact('flip', 1.0);
    }
  };

  return (
    <StopFrame id={ID}>
      <group ref={cloud} position={[ox, oy, oz]}>
        <mesh geometry={bigCloudGeometry()} material={marshmallowVC()} castShadow receiveShadow />
      </group>
      <group ref={mini} position={[d.pip[0], 0.05, d.pip[1]]}>
        <mesh geometry={bigCloudGeometry()} material={marshmallowVC()} />
      </group>
      <mesh visible={false} position={[ox, oy + 0.6, oz]} onPointerDown={tap}>
        <sphereGeometry args={[1.9, 12, 10]} />
      </mesh>
      <HintHand visible={s.hint} gesture="tap" from={[ox, oy + TOP + 0.1, oz]} scale={1.2} />
    </StopFrame>
  );
}
