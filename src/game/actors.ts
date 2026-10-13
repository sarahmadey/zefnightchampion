// Mutable per-frame state for Zef's dino, Coach Rex and the camera. React
// components read these every frame; game logic writes them. Keeping
// high-frequency data out of React state keeps the game smooth.

import * as THREE from 'three';

export type DinoAction =
  | 'none'
  | 'hop'
  | 'walk'
  | 'wiggle'
  | 'spin'
  | 'stomp'
  | 'twist'
  | 'roar'
  | 'highfive'
  | 'hug'
  | 'hugged'
  | 'cheer'
  | 'wave'
  | 'point'
  | 'stretch'
  | 'nod'
  | 'show'
  | 'giggle'
  | 'bow'
  | 'sit';

export type Expression = 'smile' | 'happy' | 'wow' | 'calm' | 'sleepy' | 'roar';

export interface ActionState {
  name: DinoAction;
  t: number;
  dur: number;
  /** loop until replaced */
  loop: boolean;
}

export interface DinoActor {
  pos: THREE.Vector3;
  heading: number;
  /** extra height (hops, jumps) */
  air: number;
  /** squash-and-stretch: 1 = neutral, <1 squashed, >1 stretched */
  stretch: number;
  action: ActionState;
  expression: Expression;
  look: THREE.Vector3 | null;
  /** 0..1 mouth opening while talking (driven by the voice level) */
  talk: number;
  /** walking cadence 0..1 */
  walk: number;
  visible: boolean;
  /** extra uniform scale (pop-in, growing) */
  scale: number;
  /** a soft glow while something special happens */
  glow: number;
  /** world position of the high-five hand (or front foot), updated by the rig */
  hand: THREE.Vector3;
}

function makeActor(x: number, z: number): DinoActor {
  return {
    pos: new THREE.Vector3(x, 0, z),
    heading: Math.PI,
    air: 0,
    stretch: 1,
    action: { name: 'none', t: 0, dur: 0, loop: false },
    expression: 'smile',
    look: null,
    talk: 0,
    walk: 0,
    visible: true,
    scale: 1,
    glow: 0,
    hand: new THREE.Vector3(),
  };
}

/** Zef's own dino. */
export const hero = makeActor(0, 0);
/** Coach Rex, the big friendly T. rex who talks, high-fives and hugs. */
export const coach = makeActor(1.6, 0);

export function play(actor: DinoActor, name: DinoAction, dur = 1.2, loop = false) {
  actor.action = { name, t: 0, dur, loop };
}

// ------------------------------------------------------------------ camera

export type CamMode = 'board' | 'shot';

export const cam = {
  mode: 'board' as CamMode,
  /** goal position/target the rig eases toward */
  pos: new THREE.Vector3(0, 6, 12),
  target: new THREE.Vector3(0, 0.6, 0),
  /** smoothing speed (higher = snappier) */
  lambda: 2.4,
  /** subject width that must fit horizontally (narrow phone screens pull back) */
  fitWidth: 0,
  /** jump directly to goal on next frame */
  snap: false,
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

/** Time that only advances with rendered frames, so events pause with the tab. */
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
