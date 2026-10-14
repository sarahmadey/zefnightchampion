// A dinosaur on screen: builds the species rig, dresses it in its outfit,
// and animates it every frame from its actor state — idle breathing and
// blinking, walking, hopping, dances, roars, high fives and hugs.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { buildRig, type Rig } from './rig';
import { buildAccessory, buildWornUnderpants, coachCap, footScale, underpantsDesign } from './accessories';
import { frameDt, type DinoActor } from '../game/actors';
import { ACCESSORIES, type DinoColor, type Slot, type Species } from '../game/rewards';
import { clamp, damp, smoothstep, TAU, angleDelta } from '../three/util';
import { motion } from '../game/settings';
import { bus } from '../game/bus';

interface Pose {
  bobY: number;
  bobYaw: number;
  bobRoll: number;
  bobPitch: number;
  hipsY: number;
  hipsRoll: number;
  hipsYaw: number;
  torsoPitch: number;
  torsoRoll: number;
  torsoYaw: number;
  neckPitch: number;
  neckYaw: number;
  neck2Pitch: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  jaw: number;
  legSwing: number[];
  legLift: number[];
  armPitch: number[];
  armRoll: number[];
  tailYaw: number;
  tailPitch: number;
  tailCurl: number;
  eyeScale: number;
  eyeSquash: number;
  happy: boolean;
  browRaise: number;
  browAngle: number;
  stretch: number;
  smile: boolean;
}

function freshPose(): Pose {
  return {
    bobY: 0,
    bobYaw: 0,
    bobRoll: 0,
    bobPitch: 0,
    hipsY: 0,
    hipsRoll: 0,
    hipsYaw: 0,
    torsoPitch: 0,
    torsoRoll: 0,
    torsoYaw: 0,
    neckPitch: 0,
    neckYaw: 0,
    neck2Pitch: 0,
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
    jaw: 0,
    legSwing: [0, 0, 0, 0],
    legLift: [0, 0, 0, 0],
    armPitch: [0, 0],
    armRoll: [0, 0],
    tailYaw: 0,
    tailPitch: 0,
    tailCurl: 0,
    eyeScale: 1,
    eyeSquash: 1,
    happy: false,
    browRaise: 0,
    browAngle: 0,
    stretch: 1,
    smile: true,
  };
}

const handTip = new THREE.Vector3();

const ENV = (u: number, a: number, b: number) => smoothstep(0, a, u) * (1 - smoothstep(b, 1, u));

/** Which leg is the "right" (high-five) one: biped index 0, quad front-right index 1. */
function highFiveLeg(rig: Rig) {
  return rig.biped ? 0 : 0;
}

function applyAction(rig: Rig, p: Pose, actor: DinoActor, emitStomp: (i: number) => void, st: { stompPhase: number }) {
  const a = actor.action;
  const u = a.dur > 0 ? clamp(a.t / a.dur, 0, 1) : 0;
  const at = a.t;
  const beat = at * TAU * 2;
  const m = motion.reduced ? 0.5 : 1;
  switch (a.name) {
    case 'wiggle': {
      p.hipsRoll += Math.sin(beat / 2) * 0.22 * m;
      p.bobYaw += Math.sin(beat / 2) * 0.35 * m;
      p.tailYaw += -Math.sin(beat / 2) * 0.8 * m;
      p.armPitch[0] = p.armPitch[1] = 2.1 + Math.sin(beat) * 0.35;
      p.armRoll[0] = p.armRoll[1] = 0.4;
      p.headRoll += -Math.sin(beat / 2) * 0.22 * m;
      p.bobY += Math.abs(Math.sin(beat / 2)) * 0.07 * m;
      if (!rig.biped) {
        p.legSwing[0] += Math.sin(beat) * 0.4;
        p.legSwing[1] -= Math.sin(beat) * 0.4;
      }
      p.happy = true;
      p.jaw = Math.max(p.jaw, 0.25);
      break;
    }
    case 'spin': {
      const k = smoothstep(0.1, 0.9, u);
      p.bobYaw += k * TAU;
      const jump = Math.sin(clamp((u - 0.05) / 0.9, 0, 1) * Math.PI);
      p.bobY += jump * 0.42 * m;
      p.armPitch[0] = p.armPitch[1] = 2.4 * jump;
      p.armRoll[0] = p.armRoll[1] = 0.6 * jump;
      p.tailPitch += 0.4 * jump;
      for (let i = 0; i < 4; i++) {
        p.legSwing[i] += 0.35 * jump;
        p.legLift[i] += 0.8 * jump;
      }
      p.happy = jump > 0.2;
      break;
    }
    case 'stomp': {
      const ph = at * TAU * 1.4;
      const left = Math.max(0, Math.sin(ph));
      const right = Math.max(0, -Math.sin(ph));
      if (rig.biped) {
        p.legSwing[0] += left * 0.5;
        p.legLift[0] += left * 0.9;
        p.legSwing[1] += right * 0.5;
        p.legLift[1] += right * 0.9;
      } else {
        p.legSwing[0] += left * 0.6;
        p.legLift[0] += left * 0.9;
        p.legSwing[3] += left * 0.4;
        p.legSwing[1] += right * 0.6;
        p.legLift[1] += right * 0.9;
        p.legSwing[2] += right * 0.4;
      }
      p.hipsRoll += Math.sin(ph) * 0.12 * m;
      p.bobY += (left + right) * 0.05;
      p.armPitch[0] = p.armPitch[1] = 1.2;
      p.jaw = Math.max(p.jaw, 0.35);
      p.eyeSquash = 0.8;
      // a stomp each time a foot comes down
      const phase = Math.floor(ph / Math.PI);
      if (phase !== st.stompPhase) {
        st.stompPhase = phase;
        if (at > 0.2) emitStomp(phase % 2);
      }
      break;
    }
    case 'twist': {
      p.torsoYaw += Math.sin(beat / 2) * 0.55 * m;
      p.hipsYaw += -Math.sin(beat / 2) * 0.3 * m;
      p.bobY += -0.04 + Math.abs(Math.sin(beat)) * 0.04;
      p.armPitch[0] = 1.4 + Math.sin(beat / 2) * 0.6;
      p.armPitch[1] = 1.4 - Math.sin(beat / 2) * 0.6;
      p.tailYaw += Math.sin(beat / 2) * 0.9 * m;
      p.headRoll += Math.sin(beat / 2) * 0.15;
      p.happy = true;
      break;
    }
    case 'roar': {
      const inhale = ENV(u, 0.2, 0.32) * (1 - smoothstep(0.18, 0.3, u));
      const roar = smoothstep(0.22, 0.32, u) * (1 - smoothstep(0.82, 0.97, u));
      p.torsoPitch += -0.25 * inhale + 0.12 * roar;
      p.neckPitch += -0.15 * inhale - 0.15 * roar;
      p.headPitch += -0.3 * inhale - 0.25 * roar;
      p.jaw = Math.max(p.jaw, 0.1 * inhale + 1.0 * roar);
      p.bobRoll += Math.sin(at * 70) * 0.025 * roar * m;
      p.bobPitch += Math.sin(at * 55) * 0.015 * roar * m;
      p.armPitch[0] = p.armPitch[1] = 1.0 + roar * 0.9;
      p.armRoll[0] = p.armRoll[1] = roar * 0.6;
      p.tailPitch += roar * 0.35;
      p.eyeSquash = 1 - roar * 0.45;
      p.browAngle = roar * 0.35;
      p.stretch *= 1 + roar * 0.05;
      p.smile = false;
      break;
    }
    case 'highfive': {
      const k = a.loop ? smoothstep(0, 0.45, at) : smoothstep(0, 0.25, u) * (1 - smoothstep(0.85, 1, u));
      if (rig.biped) {
        p.armPitch[0] = 2.45 * k;
        p.armRoll[0] = 0.25 * k + Math.sin(at * 9) * 0.06 * k;
        p.torsoRoll += 0.1 * k;
        p.headYaw += -0.2 * k;
      } else {
        const leg = highFiveLeg(rig);
        p.legSwing[leg] += 1.5 * k;
        p.legLift[leg] += 0.5 * k + Math.sin(at * 9) * 0.1 * k;
        p.torsoPitch += -0.12 * k;
        p.bobPitch += -0.08 * k;
        p.hipsRoll += -0.08 * k;
      }
      p.happy = k > 0.5;
      p.jaw = Math.max(p.jaw, 0.2);
      break;
    }
    case 'hug': {
      const k = smoothstep(0, 0.4, a.loop ? Math.min(1, at / 1.2) : u);
      p.torsoPitch += 0.42 * k;
      p.neckPitch += 0.2 * k;
      p.headPitch += 0.35 * k;
      p.armPitch[0] = p.armPitch[1] = 1.0 * k;
      p.armRoll[0] = p.armRoll[1] = -0.35 * k;
      p.tailCurl += 0.5 * k;
      p.bobRoll += Math.sin(at * 1.6) * 0.05 * k * m;
      p.happy = true;
      p.smile = true;
      break;
    }
    case 'hugged': {
      const k = smoothstep(0, 0.5, a.loop ? Math.min(1, at / 1) : u);
      p.torsoPitch += 0.12 * k;
      p.armPitch[0] = p.armPitch[1] = 1.3 * k;
      p.armRoll[0] = p.armRoll[1] = 0.2 * k;
      p.bobRoll += Math.sin(at * 1.6) * 0.05 * k * m;
      p.headRoll += 0.15 * k;
      p.happy = true;
      break;
    }
    case 'cheer': {
      const jumps = 2;
      const ju = (u * jumps) % 1;
      const jump = Math.sin(ju * Math.PI) * (1 - smoothstep(0.9, 1, u));
      p.bobY += jump * 0.38 * m;
      p.armPitch[0] = p.armPitch[1] = 2.6;
      p.armRoll[0] = p.armRoll[1] = 0.5;
      p.tailPitch += 0.35;
      for (let i = 0; i < 4; i++) {
        p.legSwing[i] += 0.25 * jump;
        p.legLift[i] += 0.7 * jump;
      }
      p.happy = true;
      p.jaw = Math.max(p.jaw, 0.45);
      break;
    }
    case 'wave': {
      const k = smoothstep(0, 0.2, u) * (1 - smoothstep(0.85, 1, u));
      if (rig.biped) {
        p.armPitch[0] = 2.5 * k;
        p.armRoll[0] = (0.5 + Math.sin(at * 12) * 0.45) * k;
      } else {
        p.legSwing[0] += 1.2 * k;
        p.legLift[0] += (0.4 + Math.sin(at * 12) * 0.35) * k;
        p.torsoPitch += -0.08 * k;
      }
      p.headRoll += 0.15 * k;
      p.happy = true;
      break;
    }
    case 'point': {
      const k = smoothstep(0, 0.2, u) * (1 - smoothstep(0.85, 1, u));
      if (rig.biped) p.armPitch[0] = 1.6 * k;
      else {
        p.legSwing[0] += 0.8 * k;
        p.legLift[0] += 0.3 * k;
      }
      p.headPitch += -0.1 * k;
      break;
    }
    case 'stretch': {
      const k = ENV(u, 0.25, 0.7);
      p.armPitch[0] = p.armPitch[1] = 2.7 * k;
      p.armRoll[0] = p.armRoll[1] = 0.4 * k;
      p.torsoPitch += -0.25 * k;
      p.headPitch += -0.3 * k;
      p.jaw = Math.max(p.jaw, 0.8 * k);
      p.eyeSquash = 1 - 0.9 * k;
      p.stretch *= 1 + 0.06 * k;
      for (let i = 0; i < 4; i++) p.legSwing[i] += (i < 2 ? 0.3 : -0.3) * k * (rig.biped ? 0 : 1);
      p.smile = false;
      break;
    }
    case 'nod': {
      p.headPitch += Math.sin(at * 11) * 0.18 * (1 - u);
      p.happy = true;
      break;
    }
    case 'show': {
      p.bobYaw += Math.sin(u * TAU) * 0.9;
      p.torsoPitch += -0.1;
      p.armPitch[0] = p.armPitch[1] = 0.9;
      p.armRoll[0] = p.armRoll[1] = 0.8;
      p.headPitch += -0.12;
      p.happy = true;
      p.bobY += Math.abs(Math.sin(u * TAU * 2)) * 0.04;
      break;
    }
    case 'giggle': {
      p.bobY += Math.abs(Math.sin(at * 14)) * 0.035 * (1 - u);
      p.headRoll += Math.sin(at * 9) * 0.12 * (1 - u);
      p.happy = true;
      p.jaw = Math.max(p.jaw, 0.3);
      break;
    }
    case 'bow': {
      const k = ENV(u, 0.3, 0.75);
      p.torsoPitch += 0.5 * k;
      p.headPitch += 0.4 * k;
      p.armPitch[0] = p.armPitch[1] = 0.6 * k;
      p.happy = true;
      break;
    }
    case 'sit': {
      const k = smoothstep(0, 0.5, a.loop ? Math.min(1, at) : u);
      p.hipsY += -0.12 * k;
      for (let i = 0; i < 4; i++) {
        p.legSwing[i] += (rig.biped || i >= 2 ? 0.9 : 0.1) * k;
        p.legLift[i] += (rig.biped || i >= 2 ? 1.6 : 0.2) * k;
      }
      break;
    }
    default:
      break;
  }
}

export interface DinoProps {
  actor: DinoActor;
  species: Species;
  color: DinoColor;
  outfit?: Partial<Record<Slot, number>>;
  coach?: boolean;
  underpants?: number | null;
  onTap?: (e: ThreeEvent<PointerEvent>) => void;
  /** override the tap target radius (big and generous by default) */
  hit?: number;
  castShadow?: boolean;
}

export function Dino({ actor, species, color, outfit, coach = false, underpants = null, onTap, hit }: DinoProps) {
  const rig = useMemo(() => buildRig(species, color, { coach }), [species, color, coach]);
  const st = useRef({ t: Math.random() * 10, blinkT: 2 + Math.random() * 2, blink: 1, walkPhase: 0, lookYaw: 0, lookPitch: 0, jaw: 0, stompPhase: -1, lowerLid: 0.85, animated: [] as THREE.Object3D[] });
  const hitR = hit ?? rig.height * 0.55;
  const hitRef = useRef<THREE.Mesh>(null);

  // dress up: coach cap, outfit pieces, underpants
  useEffect(() => {
    const added: THREE.Object3D[] = [];
    const attach = (parent: THREE.Object3D, obj: THREE.Object3D) => {
      parent.add(obj);
      added.push(obj);
    };
    if (coach) attach(rig.anchors.head, coachCap());
    if (outfit) {
      for (const slot of Object.keys(outfit) as Slot[]) {
        const idx = outfit[slot];
        if (idx === undefined || idx < 0 || idx >= ACCESSORIES.length) continue;
        if (slot === 'feet') {
          for (const f of rig.anchors.feet) {
            const g = buildAccessory(idx, species);
            g.scale.setScalar(footScale(species));
            attach(f, g);
          }
        } else if (slot === 'body' && ACCESSORIES[idx].id === 'tutu') {
          attach(rig.anchors.waist, buildAccessory(idx, species));
        } else {
          attach(rig.anchors[slot as 'head' | 'face' | 'neck' | 'body' | 'prop'], buildAccessory(idx, species));
        }
      }
    }
    if (underpants !== null && underpants !== undefined) {
      const u = buildWornUnderpants(underpantsDesign(underpants), species);
      if (species === 'trex') u.position.set(0, -0.02, 0.0);
      else u.position.set(0, 0.0, -0.2);
      attach(rig.anchors.waist, u);
    }
    const animated: THREE.Object3D[] = [];
    for (const o of added) o.traverse((c) => (c.userData.spin || c.userData.sway) && animated.push(c));
    st.current.animated = animated;
    return () => {
      for (const o of added) o.parent?.remove(o);
    };
  }, [rig, outfit, coach, underpants, species]);

  useEffect(() => {
    rig.root.traverse((o) => {
      const me = o as THREE.Mesh;
      if (me.isMesh) me.receiveShadow = false;
    });
  }, [rig]);

  useFrame((_, rawDt) => {
    const dt = frameDt(rawDt);
    const s = st.current;
    s.t += dt;
    const a = actor.action;
    a.t += dt;
    if (!a.loop && a.name !== 'none' && a.t >= a.dur) {
      a.name = 'none';
      a.t = 0;
    }
    const p = freshPose();
    const m = motion.scale;

    // idle: breathing, tail sway, a little looking around
    const breath = Math.sin(s.t * 2.2);
    p.hipsY += breath * 0.006;
    p.tailYaw += Math.sin(s.t * 1.3) * 0.16 * m;
    p.tailPitch += Math.sin(s.t * 0.9) * 0.04 * m;
    p.headYaw += Math.sin(s.t * 0.55) * 0.07 * m;
    p.headPitch += Math.sin(s.t * 0.8) * 0.025 * m;
    p.armPitch[0] = p.armPitch[1] = Math.sin(s.t * 1.7) * 0.06;

    // walking
    if (actor.walk > 0.01) {
      s.walkPhase += dt * 10 * Math.max(0.4, actor.walk);
      const w = actor.walk;
      const ph = s.walkPhase;
      if (rig.biped) {
        p.legSwing[0] += Math.sin(ph) * 0.55 * w;
        p.legSwing[1] += -Math.sin(ph) * 0.55 * w;
        p.legLift[0] += Math.max(0, Math.cos(ph)) * 0.6 * w;
        p.legLift[1] += Math.max(0, -Math.cos(ph)) * 0.6 * w;
        p.hipsRoll += Math.sin(ph) * 0.06 * w;
        p.armPitch[0] += -Math.sin(ph) * 0.3 * w;
        p.armPitch[1] += Math.sin(ph) * 0.3 * w;
      } else {
        const d = [Math.sin(ph), -Math.sin(ph), -Math.sin(ph), Math.sin(ph)];
        for (let i = 0; i < 4; i++) {
          p.legSwing[i] += d[i] * 0.45 * w;
          p.legLift[i] += Math.max(0, Math.cos(ph) * (i === 0 || i === 3 ? 1 : -1)) * 0.5 * w;
        }
        p.hipsRoll += Math.sin(ph) * 0.03 * w;
      }
      p.hipsY += Math.abs(Math.sin(ph)) * 0.03 * w;
      p.tailYaw += Math.sin(ph) * 0.25 * w;
      p.headPitch += Math.sin(ph * 2) * 0.03 * w;
    }

    // airborne: tuck the legs
    const tuck = smoothstep(0.02, 0.25, actor.air);
    if (tuck > 0) {
      for (let i = 0; i < 4; i++) {
        p.legSwing[i] += 0.35 * tuck;
        p.legLift[i] += 0.8 * tuck;
      }
      p.armPitch[0] += 1.4 * tuck;
      p.armPitch[1] += 1.4 * tuck;
      p.tailPitch += 0.3 * tuck;
      p.happy = true;
    }

    applyAction(rig, p, actor, (i) => bus.emit('stomp', actor, i), s);

    // expressions
    switch (actor.expression) {
      case 'happy':
        p.happy = true;
        p.jaw = Math.max(p.jaw, 0.12);
        break;
      case 'wow':
        p.eyeScale *= 1.25;
        p.jaw = Math.max(p.jaw, 0.38);
        p.browRaise += 0.02;
        p.smile = false;
        break;
      case 'calm':
        p.eyeSquash *= 0.82;
        break;
      case 'sleepy':
        p.eyeSquash *= 0.28;
        break;
      case 'roar':
        p.eyeSquash *= 0.7;
        p.browAngle += 0.3;
        break;
      default:
        break;
    }
    p.jaw = Math.max(p.jaw, actor.talk * 0.6);

    // blinking
    s.blinkT -= dt;
    if (s.blinkT <= 0) {
      s.blink = 0;
      s.blinkT = 2.4 + Math.random() * 3;
    }
    s.blink = Math.min(1, s.blink + dt * 9);
    const blink = s.blink < 0.5 ? 1 - s.blink * 2 * 0.92 : 0.08 + (s.blink - 0.5) * 2 * 0.92;

    // looking at things
    let ly = 0;
    let lp = 0;
    if (actor.look) {
      const dx = actor.look.x - actor.pos.x;
      const dz = actor.look.z - actor.pos.z;
      const dy = actor.look.y - (actor.pos.y + rig.height * 0.8 * actor.scale);
      ly = clamp(angleDelta(actor.heading, Math.atan2(dx, dz)), -1.1, 1.1);
      lp = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.6, 0.5);
    }
    s.lookYaw = damp(s.lookYaw, ly, 5, dt);
    s.lookPitch = damp(s.lookPitch, lp, 5, dt);
    p.neckYaw += s.lookYaw * 0.4;
    p.headYaw += s.lookYaw * 0.6;
    p.headPitch += s.lookPitch * 0.7;
    s.jaw = damp(s.jaw, p.jaw, 18, dt);

    // ---- apply
    rig.root.position.copy(actor.pos);
    rig.root.rotation.y = actor.heading;
    rig.root.visible = actor.visible;
    rig.bob.position.y = actor.air + p.bobY + (rig.biped ? 0 : 0.025);
    rig.bob.rotation.set(p.bobPitch, p.bobYaw, p.bobRoll);
    const stretch = actor.stretch * p.stretch;
    const sc = actor.scale;
    rig.bob.scale.set(sc / Math.sqrt(stretch), sc * stretch, sc / Math.sqrt(stretch));
    rig.hips.position.y = rig.hipHeight + p.hipsY;
    rig.hips.rotation.set(0, p.hipsYaw, p.hipsRoll);
    rig.torso.rotation.set(rig.torsoRest + p.torsoPitch, p.torsoYaw, p.torsoRoll);
    rig.torso.scale.set(1, 1 + breath * 0.012, 1);
    rig.neck.rotation.set(rig.neckRest + p.neckPitch, p.neckYaw, 0);
    if (rig.neck2) rig.neck2.rotation.set(rig.neck2Rest + p.neck2Pitch + p.neckPitch * 0.5, p.neckYaw * 0.5, 0);
    rig.head.rotation.set(rig.headRest + p.headPitch, p.headYaw, p.headRoll);
    rig.jaw.rotation.x = s.jaw * (rig.biped ? 0.6 : 0.5);
    rig.legs.forEach((leg, i) => {
      const swing = p.legSwing[i] ?? 0;
      const lift = p.legLift[i] ?? 0;
      leg.hip.rotation.x = -swing;
      leg.knee.rotation.x = lift;
      leg.ankle.rotation.x = swing - lift * 0.8;
    });
    const fiveK = actor.action.name === 'highfive' ? smoothstep(0, 0.3, actor.action.loop ? Math.min(1, actor.action.t / 0.5) : actor.action.t / Math.max(0.01, actor.action.dur)) : 0;
    rig.arms.forEach((arm, i) => {
      arm.shoulder.rotation.x = -(0.55 + p.armPitch[i]);
      arm.shoulder.rotation.z = arm.side * (0.25 + p.armRoll[i]);
      // cartoon stretch: the high-five arm grows so it's easy to see and tap
      arm.shoulder.scale.setScalar(i === 0 ? 1 + fiveK * 1.1 : 1);
    });
    const n = rig.tail.length;
    rig.tail.forEach((seg, i) => {
      const w = (i + 1) / n;
      seg.rotation.x = rig.tailRest[i] + p.tailPitch * (0.5 + w * 0.5) * (i === 0 ? 1 : 0.6);
      seg.rotation.y = p.tailYaw * w * 0.7 + p.tailCurl;
    });
    const eyeSY = p.eyeScale * p.eyeSquash * blink;
    // sculpted eyes blink and squint with their lids; the old ones squash
    const openness = clamp(p.eyeSquash * blink, 0, 1);
    s.lowerLid = damp(s.lowerLid, p.happy ? 0.2 : 0.85, 10, dt);
    for (const e of rig.eyes) {
      if (e.lid && e.lower) {
        const wide = -0.75 - clamp(p.eyeScale - 1, 0, 0.5) * 1.2;
        e.lid.rotation.x = 0.5 + (wide - 0.5) * openness;
        e.lower.rotation.x = s.lowerLid;
        e.open.scale.setScalar(Math.min(p.eyeScale, 1.12));
        continue;
      }
      e.open.visible = !p.happy;
      e.happy.visible = p.happy;
      e.open.scale.set(p.eyeScale, Math.max(0.06, eyeSY), p.eyeScale);
    }
    rig.brows.forEach((b, i) => {
      const side = i === 0 ? -1 : 1;
      b.rotation.z = Math.PI / 2 + side * (0.12 - p.browAngle);
      b.position.y = b.userData.baseY ?? (b.userData.baseY = b.position.y);
      b.position.y = (b.userData.baseY as number) + p.browRaise;
    });
    rig.smile.visible = p.smile && s.jaw < 0.18;

    // where the high-five hand is, for tap targets
    if (rig.hand && rig.arms.length) rig.arms[0].shoulder.localToWorld(handTip.copy(rig.hand));
    else if (rig.arms.length) rig.arms[0].shoulder.localToWorld(handTip.set(0, -0.13, 0.02));
    else rig.legs[0].ankle.localToWorld(handTip.set(0, -0.02, 0.06));
    actor.hand.copy(handTip);

    if (hitRef.current) {
      hitRef.current.position.set(actor.pos.x, actor.pos.y + actor.air + rig.height * 0.45 * sc, actor.pos.z);
      hitRef.current.scale.setScalar(Math.max(0.01, sc));
    }

    for (const o of s.animated) {
      if (o.userData.spin) o.rotation.y += dt * (o.userData.spin as number);
      if (o.userData.sway) o.rotation.z = Math.sin(s.t * 2.1) * 0.08 + actor.walk * 0.1;
    }
  });

  return (
    <group>
      <primitive object={rig.root} />
      {onTap && (
        <mesh
          ref={hitRef}
          onPointerDown={(e) => {
            e.stopPropagation();
            onTap(e);
          }}
          visible={false}
          name="dino-hit"
        >
          <sphereGeometry args={[hitR, 12, 8]} />
        </mesh>
      )}
    </group>
  );
}
