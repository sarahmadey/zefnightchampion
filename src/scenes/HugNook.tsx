// The wet-night moment: a cozy nook inside the cottage. Pip pads in, glows,
// grows big and soft, and wraps Zef in a huge hug while the camera settles
// close. Nothing is taken away; it's just a warm, quiet hug.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cam, pip, pipReact, zef, zefPlay, frameDt } from '../game/actors';
import { setHugSettled } from '../game/director';
import { cachedGeo, lumpy, merge, paint, pipedSwirl, puffGeometry, roundedBox } from '../three/geometry';
import { emissive, gloss, marshmallow, matte, pattern, vcolor } from '../three/materials';
import { Glow } from '../three/bits';
import { burst } from '../three/Particles';
import { clamp, damp, dampAngle, ease, mulberry32, smoothstep } from '../three/util';
import { motion } from '../game/settings';
import { sfx } from '../audio/sfx';

const SEAT_Y = 0.46;
const ZEF_SEAT = new THREE.Vector3(0, SEAT_Y + 0.02, -0.56);
const PIP_START = new THREE.Vector3(2.7, 0, 1.2);
const PIP_MEET = new THREE.Vector3(1.0, 0, -0.05);
const PIP_HOP = new THREE.Vector3(1.05, 1.0, -1.0);
const PIP_HUG = new THREE.Vector3(0.04, SEAT_Y + 0.04, -1.08);
const bez = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, u: number, out: THREE.Vector3) => {
  const k = 1 - u;
  return out.set(
    k * k * a.x + 2 * k * u * b.x + u * u * c.x,
    k * k * a.y + 2 * k * u * b.y + u * u * c.y,
    k * k * a.z + 2 * k * u * b.z + u * u * c.z,
  );
};

function wallGeo() {
  return cachedGeo('nook-wall', () => {
    const g = roundedBox(7, 4, 0.3, 0.1, 2);
    lumpy(g, 0.02, 2, 9);
    const rng = mulberry32(2);
    paint(g, () => new THREE.Color('#e2a46a').lerp(new THREE.Color('#c98a50'), rng() * 0.35));
    return g;
  });
}

function quiltGeo() {
  return cachedGeo('nook-quilt', () => {
    const g = roundedBox(1.9, 0.12, 1.0, 0.05, 3);
    const colors = ['#ff9fc4', '#ffe28a', '#a9e4ff', '#c9f2c7', '#e2c6ff'].map((c) => new THREE.Color(c));
    paint(g, (p) => {
      const i = Math.floor((p.x + 2) / 0.32) + Math.floor((p.z + 2) / 0.32);
      return colors[((i % colors.length) + colors.length) % colors.length];
    });
    return g;
  });
}

function bookGeo() {
  return cachedGeo('nook-books', () => {
    const rng = mulberry32(8);
    const parts: THREE.BufferGeometry[] = [];
    const colors = ['#ff6b8b', '#4dabf7', '#ffd43b', '#69db7c', '#b197fc', '#ffa94d'];
    for (let shelf = 0; shelf < 3; shelf++) {
      let x = -0.55;
      while (x < 0.5) {
        const w = 0.07 + rng() * 0.06;
        const h = 0.3 + rng() * 0.12;
        const b = roundedBox(w, h, 0.26, 0.015, 1);
        b.translate(x + w / 2, shelf * 0.55 + 0.2 + h / 2, 0);
        paint(b, colors[Math.floor(rng() * colors.length)]);
        parts.push(b);
        x += w + 0.01;
      }
    }
    return merge(parts);
  });
}

function FairyLights() {
  const pts = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      out.push(new THREE.Vector3(-3 + t * 6, 3.1 - Math.sin(t * Math.PI * 3) * 0.18 - 0.1, -1.42));
    }
    return out;
  }, []);
  const colors = ['#ffd36b', '#ff9fc4', '#a9e4ff', '#c9f2c7'];
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (m) m.scale.setScalar(0.85 + 0.25 * Math.sin(t * 2 + i * 1.3) * motion.scale);
    });
  });
  return (
    <group>
      {pts.map((p, i) => (
        <mesh key={i} ref={(m) => (refs.current[i] = m)} position={p} material={emissive(colors[i % colors.length], 1.2)}>
          <sphereGeometry args={[0.045, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

export function HugNook() {
  const st = useRef({ t: 0, settled: false, heartT: 0, grew: false });
  const glowRef = useRef<THREE.Sprite>(null!);
  const rugMat = useMemo(() => pattern({ a: '#ffd6e6', b: '#fff4d6', mode: 'swirl', freq: 0, twist: 6, roughness: 0.9, clearcoat: 0 }), []);

  useEffect(() => {
    setHugSettled(false);
    st.current = { t: 0, settled: false, heartT: 0, grew: false };
    zef.scripted = true;
    zef.nav = null;
    zef.pos.copy(ZEF_SEAT);
    zef.heading = 0;
    zef.expression = 'calm';
    zef.look = null;
    zefPlay('sit', 999, true);
    pip.mode = 'scripted';
    pip.pose = 'stand';
    pip.targetScale = 1;
    pip.scale = 1;
    pip.pos.copy(PIP_START);
    pip.heading = -2.2;
    pip.look = zef.pos.clone().add(new THREE.Vector3(0, -0.2, 0));
    pip.glow = 0;
    cam.mode = 'room';
    cam.pos.set(0.6, 1.55, 4.1);
    cam.target.set(0.25, 0.75, -0.8);
    cam.fitWidth = 3.4;
    cam.lambda = 1.2;
    cam.snap = true;
    return () => {
      zef.scripted = false;
      zef.action.name = 'none';
      pip.glow = 0;
      pip.look = null;
      setHugSettled(false);
    };
  }, []);

  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    const s = st.current;
    s.t += dt * (motion.reduced ? 1.4 : 1);
    const t = s.t;
    // Pip pads over to Zef
    if (t < 2.6) {
      const u = ease.inOutSine(clamp((t - 0.4) / 2.0, 0, 1));
      const prev = pip.pos.clone();
      pip.pos.lerpVectors(PIP_START, PIP_MEET, u);
      pip.speed = prev.distanceTo(pip.pos) / Math.max(dt, 1e-4);
      if (pip.speed > 0.05) pip.heading = dampAngle(pip.heading, Math.atan2(PIP_MEET.x - PIP_START.x, PIP_MEET.z - PIP_START.z), 8, dt);
    } else {
      pip.speed = damp(pip.speed, 0, 8, dt);
    }
    if (t > 2.6 && t < 3.4) {
      pip.heading = dampAngle(pip.heading, Math.atan2(zef.pos.x - pip.pos.x, zef.pos.z - pip.pos.z), 5, dt);
      if (pip.reaction.name === 'none') pipReact('nod', 1.0);
      zef.look = pip.pos.clone().add(new THREE.Vector3(0, 0.6, 0));
      if (zef.expression === 'calm' && t > 3.0) zef.expression = 'smile';
    }
    // a magical glow, then Pip grows big and soft
    if (t > 3.4 && !s.grew) {
      s.grew = true;
      pip.glow = 1;
      sfx.play('magic');
      for (let k = 0; k < 3; k++) burst('sparkle', pip.pos.clone().add(new THREE.Vector3(0, 0.5 + k * 0.4, 0)), { count: 16, speed: 1.6, up: 0.8, colors: ['#ffd6f0', '#fff6c2', '#d6ecff'] });
      pip.targetScale = 2.35;
    }
    if (t > 3.4) {
      // hop up behind Zef while growing, then wrap him up from behind
      const u = ease.inOutSine(clamp((t - 3.6) / 2.0, 0, 1));
      bez(PIP_MEET, PIP_HOP, PIP_HUG, u, pip.pos);
      pip.heading = dampAngle(pip.heading, u > 0.4 ? 0 : -1.2, 4, dt);
      pip.look = u > 0.5 ? zef.pos.clone().add(new THREE.Vector3(0.1, 0.5, 0.4)) : zef.pos.clone();
      if (u > 0.7) {
        pip.pose = 'hug';
        zef.expression = 'cozy';
        zefPlay('hugged', 999, true);
        zef.look = null;
      }
    }
    // the camera settles close and warm
    if (t > 4.2) {
      const u = smoothstep(4.2, 8.5, t);
      cam.pos.set(0.6 - u * 0.4, 1.55 - u * 0.2, 4.1 - u * 1.9);
      cam.target.set(0.05, 0.85 + u * 0.12, -0.85);
      cam.fitWidth = 3.4 - u * 1.0;
    }
    // little hearts float up from the hug
    if (t > 5.4) {
      s.heartT += dt;
      if (s.heartT > (motion.reduced ? 1.6 : 0.7)) {
        s.heartT = 0;
        burst('heart', zef.pos.clone().add(new THREE.Vector3(0.25, 1.0, 0.3)), { count: 2, up: 0.6, speed: 0.3, size: 0.12, life: 2.4 });
      }
    }
    if (t > 7.2 && !s.settled) {
      s.settled = true;
      setHugSettled(true);
    }
    if (glowRef.current) {
      const g = smoothstep(3.3, 4, t) * (1 - smoothstep(6.5, 9, t) * 0.6);
      glowRef.current.position.copy(pip.pos).add(new THREE.Vector3(0, 0.9 * pip.scale * 0.6, 0));
      glowRef.current.scale.setScalar(1.5 + g * 2.5);
      (glowRef.current.material as THREE.SpriteMaterial).opacity = g * 0.5;
    }
  });

  return (
    <group>
      <color attach="background" args={['#3a2433']} />
      <hemisphereLight args={['#ffe9d6', '#7a4a5a', 1.25]} />
      <directionalLight position={[-2.5, 3.5, 2]} intensity={1.6} color="#ffe2c0" castShadow shadow-mapSize={[1024, 1024]} shadow-radius={4} shadow-bias={-0.0005} />
      <pointLight position={[2.4, 1.9, -0.6]} intensity={6} distance={6} color="#ffbe6b" />

      {/* room */}
      <mesh geometry={wallGeo()} material={vcolor(0.9, 'nookwall')} position={[0, 2, -1.6]} receiveShadow />
      <mesh geometry={wallGeo()} material={vcolor(0.9, 'nookwall')} position={[-3.3, 2, 1.4]} rotation={[0, Math.PI / 2, 0]} receiveShadow />
      <mesh material={matte('#b97a4a', 0.8)} position={[0, -0.05, 0.8]} receiveShadow>
        <boxGeometry args={[8, 0.1, 6]} />
      </mesh>
      {/* floorboards lines */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} material={matte('#a56a3e', 0.8)} position={[-3.6 + i * 0.9, 0.005, 0.8]}>
          <boxGeometry args={[0.03, 0.01, 6]} />
        </mesh>
      ))}
      <mesh material={rugMat} position={[0.6, 0.02, 1.0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.5, 0.04, 48]} />
      </mesh>

      {/* round window showing a soft dawn */}
      <group position={[-0.15, 2.2, -1.43]}>
        <mesh material={pattern({ a: '#ffd9b8', b: '#ffc4d8', mode: 'spiral', freq: 0, twist: 1.6, roughness: 1, clearcoat: 0 })}>
          <circleGeometry args={[0.85, 40]} />
        </mesh>
        <mesh material={emissive('#ffe7c4', 0.55)} position={[0, 0, 0.005]}>
          <circleGeometry args={[0.82, 40]} />
        </mesh>
        <mesh material={emissive('#fff4c9', 1.2)} position={[0.35, -0.25, 0.01]}>
          <circleGeometry args={[0.16, 24]} />
        </mesh>
        <mesh material={gloss('#ffffff', 0.4, 0.4)} position={[0, 0, 0.03]}>
          <torusGeometry args={[0.86, 0.08, 10, 40]} />
        </mesh>
        <mesh material={gloss('#ffffff', 0.4, 0.4)} position={[0, 0, 0.03]}>
          <boxGeometry args={[0.05, 1.7, 0.05]} />
        </mesh>
        <mesh material={gloss('#ffffff', 0.4, 0.4)} position={[0, 0, 0.03]}>
          <boxGeometry args={[1.7, 0.05, 0.05]} />
        </mesh>
        <Glow color="#ffd9a8" size={3.2} opacity={0.35} position={[0, 0, 0.3]} />
      </group>

      {/* window seat with cushions and a quilt */}
      <mesh material={matte('#f4b8cf', 0.9)} position={[0, 0.22, -1.0]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.44, 1.0]} />
      </mesh>
      <mesh geometry={cachedGeo('nook-cushion', () => lumpy(roundedBox(2.6, 0.16, 0.9, 0.07, 3), 0.01, 3, 3))} material={marshmallow('#fff5fa')} position={[0, 0.5, -0.98]} receiveShadow castShadow />
      <mesh geometry={quiltGeo()} material={vcolor(0.95, 'quilt')} position={[-1.05, 0.6, -0.95]} scale={[0.36, 1.4, 0.75]} castShadow />
      <mesh geometry={quiltGeo()} material={vcolor(0.95, 'quilt')} position={[-1.05, 0.76, -0.95]} scale={[0.34, 1.2, 0.7]} rotation={[0, 0.08, 0]} castShadow />
      <mesh geometry={cachedGeo('nook-pillow', () => puffGeometry(31, 4, 0.3, 3))} material={marshmallow('#ffd6e8')} position={[-0.75, 0.84, -1.28]} scale={[0.5, 0.42, 0.28]} castShadow />
      <mesh geometry={cachedGeo('nook-pillow', () => puffGeometry(31, 4, 0.3, 3))} material={marshmallow('#d9f0ff')} position={[1.1, 0.8, -1.28]} scale={[0.46, 0.4, 0.26]} castShadow />

      {/* bookshelf and lamp */}
      <group position={[-2.55, 0, -0.8]}>
        <mesh material={matte('#c98a50', 0.8)} position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[1.3, 1.7, 0.35]} />
        </mesh>
        <mesh material={matte('#8e5a33', 0.8)} position={[0, 0.85, 0.06]}>
          <boxGeometry args={[1.2, 1.6, 0.3]} />
        </mesh>
        <mesh geometry={bookGeo()} material={vcolor(0.7, 'books')} position={[0, 0, 0.08]} />
      </group>
      <group position={[2.4, 0, -0.7]}>
        <mesh material={pattern({ a: '#ffffff', b: '#ff5d8f', mode: 'helix', freq: 1, twist: 6 })} position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 1.4, 10]} />
        </mesh>
        <mesh material={emissive('#ffcf87', 1.1)} position={[0, 1.5, 0]}>
          <coneGeometry args={[0.32, 0.4, 24, 1, true]} />
        </mesh>
        <mesh material={emissive('#fff1c7', 2)} position={[0, 1.42, 0]}>
          <sphereGeometry args={[0.1, 12, 10]} />
        </mesh>
        <Glow color="#ffc56b" size={2.6} opacity={0.55} position={[0, 1.4, 0.1]} />
      </group>
      <mesh geometry={cachedGeo('nook-plant', () => pipedSwirl({ radius: 0.28, height: 0.45, thickness: 0.12, turns: 2.5 }))} material={matte('#7ed39a', 0.6)} position={[-1.85, 0.5, -1.25]} />
      <mesh material={gloss('#ff9f6b', 0.4, 0.4)} position={[-1.85, 0.4, -1.25]}>
        <cylinderGeometry args={[0.24, 0.18, 0.3, 18]} />
      </mesh>
      <FairyLights />
      <Glow ref={glowRef} color="#ffe6fa" size={2} opacity={0} position={[0, 1, 0]} />
    </group>
  );
}
