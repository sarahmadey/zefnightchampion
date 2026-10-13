// Mutable per-frame state for Zef, Pip and the camera. React components read
// these every frame; game logic writes them. Keeping high-frequency data out
// of React state keeps the game smooth.

import * as THREE from 'three';

export type ZefAction =
  | 'none'
  | 'point'
  | 'jump'
  | 'celebrate'
  | 'wave'
  | 'knock'
  | 'cheer'
  | 'lookUp'
  | 'stretch'
  | 'sit'
  | 'hugged'
  | 'swing'
  | 'ride'
  | 'clap'
  | 'shrug'
  | 'push';

export type Expression = 'smile' | 'happy' | 'wow' | 'calm' | 'cozy' | 'sleepy';

export interface NavRoute {
  mode: 'route';
  targetS: number;
  targetLat: number;
  onArrive?: () => void;
}

export interface NavFree {
  mode: 'free';
  points: THREE.Vector3[];
  onArrive?: () => void;
}

export interface ActionState {
  name: ZefAction;
  t: number;
  dur: number;
  /** loop until replaced */
  loop: boolean;
}

export const zef = {
  pos: new THREE.Vector3(0, 0, 4),
  heading: Math.PI,
  speed: 0,
  s: 0,
  lateral: 0,
  nav: null as NavRoute | NavFree | null,
  action: { name: 'none', t: 0, dur: 0, loop: false } as ActionState,
  look: null as THREE.Vector3 | null,
  expression: 'smile' as Expression,
  /** extra height (jumps, bounces) */
  air: 0,
  /** squash-and-stretch: 1 = neutral, <1 squashed, >1 stretched */
  stretch: 1,
  /** when set, game code drives position each frame (bounce on cloud, boat ride…) */
  scripted: false,
  visible: true,
  runFactor: 0,
  /** hair/coat flutter from the windmill breeze */
  breeze: 0,
  /** wearing the castle crown */
  crown: false,
};

export type PipMode = 'follow' | 'scripted' | 'hug' | 'stay';
export type PipReaction =
  | 'none'
  | 'giggle'
  | 'spin'
  | 'flip'
  | 'tailchase'
  | 'puff'
  | 'dance'
  | 'surprised'
  | 'love'
  | 'cheer'
  | 'yawn'
  | 'wave'
  | 'nod';

export const pip = {
  pos: new THREE.Vector3(-0.8, 0, 5),
  heading: Math.PI,
  speed: 0,
  mode: 'follow' as PipMode,
  reaction: { name: 'none' as PipReaction, t: 0, dur: 0 },
  look: null as THREE.Vector3 | null,
  /** 0 grounded, 1 fully airborne fluttering */
  fly: 0,
  air: 0,
  hop: 0,
  scale: 1,
  targetScale: 1,
  /** posture for scripted moments */
  pose: 'stand' as 'stand' | 'sit' | 'slide' | 'hug' | 'ride' | 'sleep',
  visible: true,
  glow: 0,
  breeze: 0,
};

export function zefPlay(name: ZefAction, dur = 1.2, loop = false) {
  zef.action = { name, t: 0, dur, loop };
}

export function pipReact(name: PipReaction, dur = 1.4) {
  pip.reaction = { name, t: 0, dur };
}

// ------------------------------------------------------------------ camera

export type CamMode = 'follow' | 'focus' | 'shot' | 'room';

export const cam = {
  mode: 'follow' as CamMode,
  /** goal position/target the rig eases toward */
  pos: new THREE.Vector3(0, 4, 14),
  target: new THREE.Vector3(0, 1, 0),
  /** smoothing speed (higher = snappier) */
  lambda: 2.6,
  /** subject width that should fit horizontally (focus shots on narrow screens) */
  fitWidth: 0,
  /** jump directly to goal on next frame */
  snap: false,
  /** extra field-of-view multiplier for dramatic shots */
  fovBoost: 1,
  shake: 0,
};

// ----------------------------------------------------------- frame clock

type Waiter = { at: number; resolve: () => void };
type Until = { test: () => boolean; resolve: () => void };

export class Cancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

/** Time that only advances with rendered frames, so cutscenes pause with the tab. */
export class FrameClock {
  time = 0;
  private waiters: Waiter[] = [];
  private untils: Until[] = [];
  tick(dt: number) {
    this.time += dt;
    if (this.waiters.length) {
      const ready = this.waiters.filter((w) => w.at <= this.time);
      if (ready.length) {
        this.waiters = this.waiters.filter((w) => w.at > this.time);
        for (const w of ready) w.resolve();
      }
    }
    if (this.untils.length) {
      const ready = this.untils.filter((u) => u.test());
      if (ready.length) {
        this.untils = this.untils.filter((u) => !ready.includes(u));
        for (const u of ready) u.resolve();
      }
    }
  }
  wait(seconds: number): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ at: this.time + seconds, resolve }));
  }
  until(test: () => boolean, timeout = 30): Promise<void> {
    const start = this.time;
    return new Promise((resolve) =>
      this.untils.push({ test: () => test() || this.time - start > timeout, resolve }),
    );
  }
}

export const clock = new FrameClock();

/** Global speed multiplier and step clamp (raised only for automated testing). */
export const timeScale = { value: 1, maxDt: 0.05 };

/** Clamped, scaled frame delta used by every animated component. */
export function frameDt(rawDt: number): number {
  return Math.min(rawDt, timeScale.maxDt) * timeScale.value;
}
