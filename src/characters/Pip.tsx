// Pip: a small friendly white dragon with big expressive eyes, pink wings,
// tiny paws and a curled tail. Hops, flutters, looks at Zef, reacts to taps
// and can grow big enough to wrap Zef in a hug.

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { cachedGeo, curveFrom, extrude, heartShape, lathe, tube } from '../three/geometry';
import { addRim } from '../three/rim';
import { TAU, clamp, damp, dampAngle, ease, lerp, smoothstep } from '../three/util';
import { pip, zef, frameDt } from '../game/actors';

function makeMaterials() {
  return {
    body: addRim(
      new THREE.MeshPhysicalMaterial({
        color: '#fbfbff',
        roughness: 0.55,
        sheen: 1,
        sheenColor: new THREE.Color('#dbe7ff'),
        sheenRoughness: 0.4,
        clearcoat: 0.2,
      }),
      '#e9f0ff',
      0.35,
    ),
    belly: new THREE.MeshPhysicalMaterial({ color: '#fff0d9', roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color('#fff') }),
    bellyLine: new THREE.MeshStandardMaterial({ color: '#f1d7b2', roughness: 0.8 }),
    wing: addRim(
      new THREE.MeshPhysicalMaterial({
        color: '#ff98c6',
        roughness: 0.4,
        sheen: 1,
        sheenColor: new THREE.Color('#ffd6ea'),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        emissive: new THREE.Color('#8a1f55'),
        emissiveIntensity: 0.25,
      }),
      '#ffe0f0',
      0.45,
    ),
    wingBone: new THREE.MeshPhysicalMaterial({ color: '#ffd2e7', roughness: 0.5, sheen: 0.5 }),
    spike: new THREE.MeshPhysicalMaterial({ color: '#ff87bb', roughness: 0.35, clearcoat: 0.6 }),
    horn: new THREE.MeshPhysicalMaterial({ color: '#ffc8e6', roughness: 0.3, clearcoat: 0.8 }),
    eye: new THREE.MeshPhysicalMaterial({ color: '#1d1430', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }),
    eyeShine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    blush: new THREE.MeshBasicMaterial({ color: '#ff7fae', transparent: true, opacity: 0.45, depthWrite: false }),
    mouth: new THREE.MeshStandardMaterial({ color: '#7d2848', roughness: 0.5 }),
    tongue: new THREE.MeshStandardMaterial({ color: '#ff8fb0', roughness: 0.5 }),
    nostril: new THREE.MeshStandardMaterial({ color: '#f2a5c4', roughness: 0.6 }),
    pad: new THREE.MeshStandardMaterial({ color: '#ffb0cf', roughness: 0.6 }),
  };
}

let mats: ReturnType<typeof makeMaterials> | null = null;
function pipMaterials() {
  if (!mats) mats = makeMaterials();
  return mats;
}

function bodyGeo() {
  return cachedGeo('pip-body', () =>
    lathe(
      [
        [0, 0.02],
        [0.15, 0.035],
        [0.215, 0.13],
        [0.215, 0.25],
        [0.165, 0.36],
        [0.08, 0.43],
        [0, 0.445],
      ],
      32,
      28,
    ),
  );
}

function wingShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.06, 0.14, 0.2, 0.25, 0.4, 0.27);
  s.quadraticCurveTo(0.42, 0.22, 0.39, 0.16);
  s.quadraticCurveTo(0.33, 0.09, 0.29, 0.13);
  s.quadraticCurveTo(0.24, 0.03, 0.18, 0.08);
  s.quadraticCurveTo(0.12, -0.02, 0.07, 0.03);
  s.quadraticCurveTo(0.03, -0.03, 0, 0);
  return s;
}

function wingGeo() {
  return cachedGeo('pip-wing', () => extrude(wingShape(), 0.012, 0.006, 16));
}

function wingBoneGeo() {
  return cachedGeo('pip-wingbone', () =>
    tube(curveFrom([[0, 0, 0], [0.06, 0.14, 0], [0.2, 0.25, 0], [0.4, 0.27, 0]]), {
      segments: 16,
      radial: 7,
      radius: (t) => 0.022 * (1 - t * 0.55),
    }),
  );
}

function tailGeo() {
  return cachedGeo('pip-tail', () => {
    const pts: [number, number, number][] = [
      [0, 0.0, 0.0],
      [0.01, -0.04, -0.12],
      [0.04, 0.0, -0.25],
      [0.08, 0.1, -0.31],
      [0.1, 0.2, -0.27],
      [0.08, 0.24, -0.19],
      [0.05, 0.2, -0.14],
      [0.05, 0.14, -0.17],
      [0.07, 0.13, -0.22],
    ];
    return tube(curveFrom(pts, 0.5), {
      segments: 48,
      radial: 12,
      radius: (t) => lerp(0.065, 0.022, Math.pow(t, 0.8)) * (t < 0.05 ? 0.8 + t * 4 : 1),
    });
  });
}

function heartTipGeo() {
  return cachedGeo('pip-tailtip', () => extrude(heartShape(0.13), 0.03, 0.012, 10));
}

function hornGeo() {
  return cachedGeo('pip-horn', () =>
    lathe(
      [
        [0, -0.01],
        [0.035, 0.0],
        [0.03, 0.04],
        [0.018, 0.08],
        [0.006, 0.105],
        [0, 0.11],
      ],
      14,
      14,
    ),
  );
}

function spikeGeo() {
  return cachedGeo('pip-spike', () =>
    lathe(
      [
        [0, -0.01],
        [0.045, 0],
        [0.036, 0.035],
        [0.014, 0.07],
        [0, 0.078],
      ],
      12,
      12,
    ),
  );
}

function smileGeo() {
  return cachedGeo('pip-smile', () => {
    const g = new THREE.TorusGeometry(0.05, 0.01, 8, 18, Math.PI * 0.8);
    g.rotateZ(Math.PI + Math.PI * 0.1);
    return g;
  });
}

function openMouthGeo() {
  return cachedGeo('pip-open', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.06, 0);
    s.quadraticCurveTo(0, 0.01, 0.06, 0);
    s.quadraticCurveTo(0.055, -0.075, 0, -0.08);
    s.quadraticCurveTo(-0.055, -0.075, -0.06, 0);
    return extrude(s, 0.014, 0.005, 10);
  });
}

function eyeArcGeo() {
  return cachedGeo('pip-eyearc', () => {
    const g = new THREE.TorusGeometry(0.045, 0.012, 6, 16, Math.PI * 0.8);
    g.rotateZ(Math.PI * 0.1);
    return g;
  });
}

const REACTIONS = ['giggle', 'spin', 'flip', 'tailchase', 'puff', 'dance', 'love', 'cheer'] as const;
let reactionIdx = 0;

/** Pick the next fun reaction for a tap on Pip (cycles so every tap differs). */
export function nextPipReaction(): (typeof REACTIONS)[number] {
  const r = REACTIONS[reactionIdx % REACTIONS.length];
  reactionIdx += 1 + (Math.random() < 0.3 ? 1 : 0);
  return r;
}

export function Pip({ onTap }: { onTap?: (e: ThreeEvent<PointerEvent>) => void }) {
  const m = pipMaterials();
  const g = useMemo(
    () => ({
      body: bodyGeo(),
      wing: wingGeo(),
      bone: wingBoneGeo(),
      tail: tailGeo(),
      tip: heartTipGeo(),
      horn: hornGeo(),
      spike: spikeGeo(),
      smile: smileGeo(),
      open: openMouthGeo(),
      eyeArc: eyeArcGeo(),
    }),
    [],
  );

  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const flipper = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const wingL = useRef<THREE.Group>(null!);
  const wingR = useRef<THREE.Group>(null!);
  const tail = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const eyes = useRef<THREE.Group>(null!);
  const eyesHappy = useRef<THREE.Group>(null!);
  const smile = useRef<THREE.Mesh>(null!);
  const open = useRef<THREE.Group>(null!);
  const hitRef = useRef<THREE.Mesh>(null!);

  const st = useRef({
    hopPhase: 0,
    blinkT: 0,
    nextBlink: 2,
    lookYaw: 0,
    lookPitch: 0,
    flap: 0,
    wingSpread: 0,
    squash: 1,
    scale: 1,
    spinY: 0,
    flipX: 0,
    wiggle: 0,
    armL: 0,
    armR: 0,
    armLz: 0,
    armRz: 0,
    legL: 0,
    legR: 0,
    tailWag: 0,
    headTilt: 0,
    yOff: 0,
    hugK: 0,
  });

  useFrame((state, rawDt) => {
    const dt = frameDt(rawDt);
    const s = st.current;
    const time = state.clock.elapsedTime;
    const r = root.current;
    r.visible = pip.visible;
    r.position.copy(pip.pos);
    r.rotation.y = pip.heading;
    s.scale = damp(s.scale, pip.targetScale, 2.2, dt);
    pip.scale = s.scale;
    r.scale.setScalar(s.scale);

    const moving = smoothstep(0.08, 0.5, pip.speed);
    const fly = clamp(pip.fly, 0, 1);
    const rx = pip.reaction;
    if (rx.name !== 'none') {
      rx.t += dt;
      if (rx.t >= rx.dur) rx.name = 'none';
    }
    const u = rx.name !== 'none' ? rx.t / rx.dur : 0;

    // ---- hop locomotion
    s.hopPhase += dt * (moving * 9 * (1 - fly * 0.6));
    const hop = moving * (1 - fly) * Math.abs(Math.sin(s.hopPhase));
    let yOff = hop * 0.16 + fly * (0.35 + Math.sin(time * 3) * 0.06) + pip.air;
    let squashT = 1 + (hop > 0.02 ? 0.08 * hop : -0.06 * moving * (1 - fly));

    // ---- defaults
    let flapAmp = fly * 0.85 + moving * (1 - fly) * 0.25;
    let flapSpeed = 16 + fly * 6;
    let spread = 0.25 + fly * 0.5;
    let armLx = -0.3 - moving * 0.3;
    let armRx = -0.3 - moving * 0.3;
    let armLz = 0.2;
    let armRz = -0.2;
    let legLx = Math.sin(s.hopPhase) * 0.5 * moving * (1 - fly) + fly * 0.5;
    let legRx = -Math.sin(s.hopPhase) * 0.5 * moving * (1 - fly) + fly * 0.5;
    let tailWag = Math.sin(time * (2.2 + moving * 4)) * (0.25 + moving * 0.2);
    let headTilt = Math.sin(time * 0.7) * 0.06;
    let spinTarget = 0;
    let flipTarget = 0;
    let wiggle = 0;
    let happy = false;
    let mouthOpen = false;
    let eyeWide = 1;

    // ---- reactions
    switch (rx.name) {
      case 'giggle':
        wiggle = Math.sin(time * 26) * 0.18 * (1 - u);
        happy = true;
        mouthOpen = true;
        yOff += Math.abs(Math.sin(time * 13)) * 0.04;
        armLx = armRx = -1.1;
        break;
      case 'spin':
        spinTarget = ease.inOutCubic(u) * TAU;
        yOff += Math.sin(u * Math.PI) * 0.35;
        spread = 0.9;
        flapAmp = 0.6;
        happy = true;
        break;
      case 'flip':
        flipTarget = -ease.inOutCubic(clamp((u - 0.15) / 0.7, 0, 1)) * TAU;
        yOff += Math.sin(clamp((u - 0.1) / 0.8, 0, 1) * Math.PI) * 0.55;
        squashT = u < 0.15 ? 0.82 : squashT;
        happy = true;
        mouthOpen = true;
        break;
      case 'tailchase':
        spinTarget = ease.inOutSine(u) * TAU * 2;
        yOff += Math.abs(Math.sin(u * Math.PI * 6)) * 0.1;
        mouthOpen = true;
        tailWag = Math.sin(time * 18) * 0.6;
        break;
      case 'puff':
        headTilt = u < 0.35 ? -0.35 * (u / 0.35) : 0.35;
        mouthOpen = u > 0.35;
        squashT = u < 0.35 ? 1 + 0.12 * (u / 0.35) : 0.92;
        spread = 0.8;
        break;
      case 'dance':
        wiggle = Math.sin(time * 9) * 0.25;
        armLx = armRx = -2.6;
        armLz = 0.5 + Math.sin(time * 9) * 0.3;
        armRz = -0.5 + Math.sin(time * 9) * 0.3;
        yOff += Math.abs(Math.sin(time * 9)) * 0.08;
        happy = true;
        mouthOpen = true;
        break;
      case 'love':
        happy = true;
        wiggle = Math.sin(time * 4) * 0.12;
        armLx = armRx = -1.3;
        armLz = 0.7;
        armRz = -0.7;
        headTilt = 0.25;
        break;
      case 'cheer':
        yOff += Math.sin(clamp(u * 1.4, 0, 1) * Math.PI) * 0.4;
        armLx = armRx = -2.8;
        spread = 1;
        flapAmp = 0.9;
        flapSpeed = 22;
        happy = true;
        mouthOpen = true;
        break;
      case 'surprised':
        yOff += Math.sin(clamp(u * 2.2, 0, 1) * Math.PI) * 0.25;
        spread = 1.1;
        flapAmp = 0.3;
        eyeWide = 1.25;
        mouthOpen = true;
        armLx = armRx = -1.6;
        break;
      case 'yawn':
        mouthOpen = u > 0.15 && u < 0.75;
        armLx = armRx = -2.4 * Math.sin(clamp(u, 0, 1) * Math.PI);
        headTilt = -0.25 * Math.sin(u * Math.PI);
        eyeWide = 0.2;
        break;
      case 'wave':
        armRx = -2.6;
        armRz = -0.4 + Math.sin(time * 14) * 0.4;
        happy = true;
        break;
      case 'nod':
        headTilt = Math.sin(u * Math.PI * 4) * 0.25;
        break;
    }

    // ---- scripted poses
    switch (pip.pose) {
      case 'sit':
      case 'ride':
        legLx = legRx = -1.3;
        yOff -= 0.05;
        armLx = armRx = pip.pose === 'ride' ? -2.5 : -0.8;
        break;
      case 'slide':
        legLx = legRx = -1.4;
        armLx = armRx = -2.9;
        armLz = 0.6;
        armRz = -0.6;
        happy = true;
        mouthOpen = true;
        spread = 0.9;
        break;
      case 'hug':
        armLx = armRx = -1.2;
        armLz = -0.75 + Math.sin(time * 1.2) * 0.04;
        armRz = 0.75 - Math.sin(time * 1.2) * 0.04;
        spread = -0.7;
        flapAmp = 0;
        happy = true;
        headTilt = 0.2 + Math.sin(time * 1.2) * 0.05;
        tailWag = Math.sin(time * 1.5) * 0.15;
        break;
      case 'sleep':
        eyeWide = 0.1;
        headTilt = 0.2;
        break;
    }
    if (pip.glow > 0) happy = true;

    // ---- look at Zef / target
    const tgt = pip.look ?? (pip.mode === 'follow' ? zef.pos : null);
    let wantYaw = 0;
    let wantPitch = 0;
    if (tgt && rx.name !== 'spin' && rx.name !== 'tailchase') {
      const local = r.worldToLocal(new THREE.Vector3(tgt.x, tgt.y + 0.8, tgt.z));
      wantYaw = clamp(Math.atan2(local.x, local.z), -1.0, 1.0);
      wantPitch = clamp(-Math.atan2(local.y - 0.6, Math.hypot(local.x, local.z)), -0.5, 0.4);
    }
    s.lookYaw = dampAngle(s.lookYaw, wantYaw, 5, dt);
    s.lookPitch = damp(s.lookPitch, wantPitch, 5, dt);

    // ---- integrate
    s.yOff = damp(s.yOff, yOff, 14, dt);
    s.squash = damp(s.squash, squashT, 18, dt);
    s.flap += dt * flapSpeed;
    s.wingSpread = damp(s.wingSpread, spread, 6, dt);
    s.spinY = spinTarget > 0 || rx.name === 'spin' || rx.name === 'tailchase' ? spinTarget : damp(s.spinY, 0, 10, dt);
    s.flipX = rx.name === 'flip' ? flipTarget : damp(s.flipX, 0, 10, dt);
    s.wiggle = damp(s.wiggle, wiggle, 20, dt);
    s.armL = damp(s.armL, armLx, 12, dt);
    s.armR = damp(s.armR, armRx, 12, dt);
    s.armLz = damp(s.armLz, armLz, 12, dt);
    s.armRz = damp(s.armRz, armRz, 12, dt);
    s.legL = damp(s.legL, legLx, 14, dt);
    s.legR = damp(s.legR, legRx, 14, dt);
    s.tailWag = damp(s.tailWag, tailWag + pip.breeze * Math.sin(time * 7) * 0.3, 8, dt);
    s.headTilt = damp(s.headTilt, headTilt, 8, dt);

    body.current.position.y = s.yOff;
    body.current.scale.set(1 / Math.sqrt(s.squash), s.squash, 1 / Math.sqrt(s.squash));
    body.current.rotation.z = s.wiggle;
    flipper.current.rotation.set(s.flipX, s.spinY, 0);

    const flapA = Math.sin(s.flap) * flapAmp;
    wingL.current.rotation.set(0, -0.85 - s.wingSpread * 0.35, 0.35 + flapA + s.wingSpread * 0.3);
    wingR.current.rotation.set(0, 0.85 + s.wingSpread * 0.35, -0.35 - flapA - s.wingSpread * 0.3);
    const hugging = pip.pose === 'hug';
    s.hugK = damp(s.hugK, hugging ? 1 : 0, 3, dt);
    if (s.hugK > 0.01) {
      const k = s.hugK;
      const breathe = Math.sin(time * 1.2) * 0.04;
      wingL.current.rotation.set(0, lerp(wingL.current.rotation.y, -1.2 - breathe, k), lerp(wingL.current.rotation.z, 0.15, k));
      wingR.current.rotation.set(0, lerp(wingR.current.rotation.y, 1.2 + breathe, k), lerp(wingR.current.rotation.z, -0.15, k));
    }
    const wingScale = 1 + s.hugK * 0.3;
    wingL.current.scale.setScalar(wingScale);
    wingR.current.scale.setScalar(wingScale);
    const armScale = 1 + s.hugK * 1.1;
    armL.current.scale.setScalar(armScale);
    armR.current.scale.setScalar(armScale);
    tail.current.rotation.y = s.tailWag;
    tail.current.rotation.x = Math.sin(time * 1.3) * 0.06;
    armL.current.rotation.set(s.armL, 0, s.armLz);
    armR.current.rotation.set(s.armR, 0, s.armRz);
    legL.current.rotation.x = s.legL;
    legR.current.rotation.x = s.legR;
    head.current.rotation.set(s.lookPitch + (rx.name === 'nod' ? s.headTilt : 0), s.lookYaw, rx.name === 'nod' ? 0 : s.headTilt);

    // ---- face
    s.blinkT += dt;
    let blink = 1;
    if (s.blinkT > s.nextBlink) {
      const bt = s.blinkT - s.nextBlink;
      blink = bt < 0.15 ? Math.abs(Math.cos((bt / 0.15) * Math.PI)) : 1;
      if (bt >= 0.15) {
        s.blinkT = 0;
        s.nextBlink = 1.8 + Math.random() * 3;
      }
    }
    eyes.current.visible = !happy;
    eyesHappy.current.visible = happy;
    eyes.current.scale.set(eyeWide > 1 ? eyeWide : 1, Math.max(0.08, eyeWide * blink), 1);
    smile.current.visible = !mouthOpen;
    open.current.visible = mouthOpen;
    hitRef.current.scale.setScalar(1);
  });

  return (
    <group ref={root} dispose={null}>
      {/* generous invisible hit area so a small finger can always tap Pip */}
      <mesh
        ref={hitRef}
        visible={false}
        position={[0, 0.45, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          onTap?.(e);
        }}
      >
        <sphereGeometry args={[0.62, 10, 8]} />
      </mesh>
      <group ref={flipper} position={[0, 0.3, 0]}>
        <group position={[0, -0.3, 0]}>
          <group ref={body}>
            <mesh geometry={g.body} material={m.body} castShadow />
            {/* belly */}
            <mesh material={m.belly} position={[0, 0.2, 0.105]} scale={[0.78, 0.92, 0.5]}>
              <sphereGeometry args={[0.18, 20, 16]} />
            </mesh>
            {[0.13, 0.2, 0.27].map((y) => (
              <mesh key={y} material={m.bellyLine} position={[0, y, 0.17 - Math.abs(y - 0.2) * 0.3]} rotation={[Math.PI / 2 - 0.15, 0, 0]} scale={[1, 1, 0.45]}>
                <torusGeometry args={[0.11 - Math.abs(y - 0.2) * 0.45, 0.004, 4, 16, Math.PI]} />
              </mesh>
            ))}
            {/* back spikes */}
            {[
              [0.43, -0.05, -0.3],
              [0.37, -0.14, -0.7],
              [0.28, -0.195, -1.1],
              [0.17, -0.21, -1.4],
            ].map(([y, z, rx], i) => (
              <mesh key={i} geometry={g.spike} material={m.spike} position={[0, y, z]} rotation={[rx, 0, 0]} scale={1 - i * 0.12} />
            ))}
            {/* legs */}
            {(['L', 'R'] as const).map((side) => {
              const sx = side === 'L' ? 1 : -1;
              return (
                <group key={side} ref={side === 'L' ? legL : legR} position={[0.12 * sx, 0.12, 0.0]}>
                  <mesh material={m.body} position={[0, -0.04, 0.0]} scale={[0.85, 0.85, 1.05]} castShadow>
                    <sphereGeometry args={[0.085, 16, 12]} />
                  </mesh>
                  <mesh material={m.body} position={[0, -0.1, 0.05]} scale={[1, 0.55, 1.35]}>
                    <sphereGeometry args={[0.06, 14, 10]} />
                  </mesh>
                  {[-1, 0, 1].map((t) => (
                    <mesh key={t} material={m.pad} position={[t * 0.025, -0.115, 0.125]}>
                      <sphereGeometry args={[0.014, 8, 6]} />
                    </mesh>
                  ))}
                </group>
              );
            })}
            {/* tiny arms */}
            {(['L', 'R'] as const).map((side) => {
              const sx = side === 'L' ? 1 : -1;
              return (
                <group key={side} ref={side === 'L' ? armL : armR} position={[0.15 * sx, 0.29, 0.08]}>
                  <mesh material={m.body} position={[0, -0.045, 0.01]} rotation={[0.2, 0, 0]}>
                    <capsuleGeometry args={[0.032, 0.06, 4, 10]} />
                  </mesh>
                  <mesh material={m.body} position={[0, -0.095, 0.02]}>
                    <sphereGeometry args={[0.036, 12, 10]} />
                  </mesh>
                  <mesh material={m.pad} position={[0, -0.1, 0.05]} scale={[1, 0.7, 0.5]}>
                    <sphereGeometry args={[0.018, 8, 6]} />
                  </mesh>
                </group>
              );
            })}
            {/* wings */}
            <group ref={wingL} position={[0.07, 0.35, -0.15]} scale={1.0}>
              <mesh geometry={g.wing} material={m.wing} castShadow />
              <mesh geometry={g.bone} material={m.wingBone} />
            </group>
            <group ref={wingR} position={[-0.07, 0.35, -0.15]} scale={1.0}>
              <group scale={[-1, 1, 1]}>
                <mesh geometry={g.wing} material={m.wing} castShadow />
                <mesh geometry={g.bone} material={m.wingBone} />
              </group>
            </group>
            {/* curled tail */}
            <group ref={tail} position={[0, 0.1, -0.17]}>
              <mesh geometry={g.tail} material={m.body} castShadow />
              <mesh geometry={g.tip} material={m.spike} position={[0.075, 0.13, -0.24]} rotation={[0.3, 1.2, -0.6]} />
            </group>
            {/* head */}
            <group ref={head} position={[0, 0.42, 0.04]}>
              <mesh material={m.body} position={[0, 0.14, 0]} scale={[1.1, 0.96, 1]} castShadow>
                <sphereGeometry args={[0.2, 32, 24]} />
              </mesh>
              <mesh material={m.body} position={[0, 0.07, 0.16]} scale={[1.15, 0.78, 0.95]}>
                <sphereGeometry args={[0.11, 20, 16]} />
              </mesh>
              {[-1, 1].map((sx) => (
                <mesh key={sx} material={m.nostril} position={[0.035 * sx, 0.1, 0.26]} scale={[1, 0.6, 0.5]}>
                  <sphereGeometry args={[0.012, 8, 6]} />
                </mesh>
              ))}
              {/* eyes */}
              <group ref={eyes} position={[0, 0.17, 0]}>
                {[-1, 1].map((sx) => (
                  <group key={sx} position={[0.088 * sx, 0, 0.158]} rotation={[0, 0.42 * sx, 0]}>
                    <mesh material={m.eye} scale={[1, 1.12, 0.62]}>
                      <sphereGeometry args={[0.058, 20, 16]} />
                    </mesh>
                    <mesh material={m.eyeShine} position={[0.018 * sx, 0.024, 0.032]}>
                      <sphereGeometry args={[0.016, 10, 8]} />
                    </mesh>
                    <mesh material={m.eyeShine} position={[-0.016 * sx, -0.02, 0.033]}>
                      <sphereGeometry args={[0.007, 8, 6]} />
                    </mesh>
                  </group>
                ))}
              </group>
              <group ref={eyesHappy} position={[0, 0.16, 0]} visible={false}>
                {[-1, 1].map((sx) => (
                  <mesh key={sx} geometry={g.eyeArc} material={m.eye} position={[0.088 * sx, 0, 0.19]} rotation={[0, 0.42 * sx, 0]} />
                ))}
              </group>
              {/* cheeks */}
              {[-1, 1].map((sx) => (
                <mesh key={`c${sx}`} material={m.blush} position={[0.15 * sx, 0.08, 0.135]} rotation={[0, 0.8 * sx, 0]}>
                  <circleGeometry args={[0.035, 16]} />
                </mesh>
              ))}
              {/* mouth */}
              <mesh ref={smile} geometry={g.smile} material={m.mouth} position={[0, 0.045, 0.245]} rotation={[-0.5, 0, 0]} />
              <group ref={open} position={[0, 0.055, 0.243]} rotation={[-0.45, 0, 0]} visible={false}>
                <mesh geometry={g.open} material={m.mouth} />
                <mesh material={m.tongue} position={[0, -0.055, 0.006]} scale={[1.5, 0.7, 0.5]}>
                  <sphereGeometry args={[0.022, 10, 8]} />
                </mesh>
              </group>
              {/* horns and ear fins */}
              {[-1, 1].map((sx) => (
                <mesh key={`h${sx}`} geometry={g.horn} material={m.horn} position={[0.085 * sx, 0.3, -0.03]} rotation={[-0.45, 0, -0.3 * sx]} />
              ))}
              {[-1, 1].map((sx) => (
                <mesh key={`f${sx}`} geometry={g.spike} material={m.spike} position={[0.2 * sx, 0.17, -0.04]} rotation={[0, 0, -1.25 * sx]} scale={[0.8, 1.2, 0.5]} />
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
