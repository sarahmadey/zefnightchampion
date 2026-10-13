// The director decides which little event to play after a grown-up records
// a night (or on load), and runs cutscenes: a path light waking and Zef and
// Pip travelling to it, the extraordinary castle arrival, and the wet-night
// hug. Cutscenes use frame time so they pause with the tab, and can be
// cancelled (e.g. when a preview starts).

import * as THREE from 'three';
import { Cancelled, cam, clock, pip, pipReact, zef, zefPlay } from './actors';
import { STOP_S, STOPS, regionOfStop } from './route';
import { STOP_DEFS, localToWorld, stopWorldPoints } from '../world/stopDefs';
import { lightWorldPos } from '../world/PathLights';
import { placePip, setPipSide, walkFree, walkRoute } from './nav';
import { followCamera, placeAtStop, setFocus, stopSpotRoute } from './world';
import { bus } from './bus';
import { motion } from './settings';
import { sfx } from '../audio/sfx';
import { burst } from '../three/Particles';
import { useGame, useSave, type PreviewState } from '../state/store';
import { computeStreak, STOP_COUNT } from '../state/progress';
import { CASTLE_POS } from '../world/Castle';

interface Ctx {
  wait: (s: number) => Promise<void>;
  until: (test: () => boolean, timeout?: number) => Promise<void>;
  alive: () => boolean;
}

let seq = 0;
let current: { id: number; cancelled: boolean } | null = null;

export function cancelCutscene() {
  if (current) current.cancelled = true;
  current = null;
  useGame.getState().set({ cutscene: null });
}

async function runCutscene(name: string, fn: (ctx: Ctx) => Promise<void>) {
  if (current) current.cancelled = true;
  const me = { id: ++seq, cancelled: false };
  current = me;
  useGame.getState().set({ cutscene: name, hintStop: null });
  const ctx: Ctx = {
    wait: async (s) => {
      await clock.wait(motion.reduced ? s * 0.7 : s);
      if (me.cancelled) throw new Cancelled();
    },
    until: async (test, timeout = 30) => {
      await clock.until(() => me.cancelled || test(), timeout);
      if (me.cancelled) throw new Cancelled();
    },
    alive: () => !me.cancelled,
  };
  try {
    await fn(ctx);
  } catch (e) {
    if (!(e instanceof Cancelled)) console.error(e);
  } finally {
    if (current === me) {
      current = null;
      useGame.getState().set({ cutscene: null });
    }
  }
}

function shot(pos: THREE.Vector3, target: THREE.Vector3, lambda = 1.8, fit = 0) {
  cam.mode = 'shot';
  cam.pos.copy(pos);
  cam.target.copy(target);
  cam.lambda = motion.reduced ? 6 : lambda;
  cam.fitWidth = fit;
  if (motion.reduced) cam.snap = true;
}

async function fade(ctx: Ctx, to: number, seconds = 0.5) {
  useGame.getState().set({ fade: to });
  await ctx.wait(seconds);
}

function walkRouteP(ctx: Ctx, s: number, lat: number): Promise<void> {
  return new Promise((resolve) => {
    walkRoute(s, lat, () => resolve());
    void ctx.until(() => !ctx.alive(), 120).catch(() => resolve());
  });
}

function walkFreeP(points: THREE.Vector3[]): Promise<void> {
  return new Promise((resolve) => walkFree(points, () => resolve()));
}

// ------------------------------------------------------------- decisions

/** Look at saved progress and play whatever the child hasn't seen yet. */
export function checkProgress() {
  const g = useGame.getState();
  if (!g.ready || g.parentOpen || g.preview || g.cutscene) return;
  const save = useSave.getState();
  const info = computeStreak(save.data.records);
  const seen = save.data.seen;

  if (info.latest && info.latest.result === 'wet' && info.latest.date !== seen.hugDate) {
    save.markSeen({ hugDate: info.latest.date, stop: 0, streak: 0 });
    void playHug(false);
    return;
  }
  if (info.activeStop > seen.stop) {
    const from = Math.min(seen.stop, g.litStop);
    save.markSeen({ stop: info.activeStop, streak: info.streak });
    void playArrival(from, info.activeStop, false);
    return;
  }
  if (info.activeStop < seen.stop || g.litStop !== info.activeStop) {
    // a correction lowered the journey: quietly settle without any "taking away"
    save.markSeen({ stop: info.activeStop, streak: info.streak });
    if (g.scene === 'world') {
      g.set({ litStop: info.activeStop });
      if (zef.s > STOP_S[info.activeStop] + 3) placeAtStop(info.activeStop);
    }
    return;
  }
  if (info.streak > seen.streak) {
    save.markSeen({ streak: info.streak });
    if (info.activeStop >= STOP_COUNT) void playBonus();
  }
}

export function startPreview(p: PreviewState) {
  cancelCutscene();
  useGame.getState().set({ preview: p, parentOpen: false, hugCaption: false });
  if (p.kind === 'hug') void playHug(true);
  else void playArrival(Math.max(0, p.stop - 1), p.stop, true);
}

export function endPreview() {
  cancelCutscene();
  const g = useGame.getState();
  g.set({ preview: null, hugCaption: false, fade: 0, scene: 'world' });
  const save = useSave.getState();
  const info = computeStreak(save.data.records);
  const stop = Math.min(info.activeStop, save.data.seen.stop);
  g.set({ litStop: stop });
  pip.targetScale = 1;
  pip.mode = 'follow';
  pip.pose = 'stand';
  zef.action.name = 'none';
  zef.expression = 'smile';
  zef.scripted = false;
  placeAtStop(stop);
  // anything recorded while previewing gets its turn now
  setTimeout(() => checkProgress(), 300);
}

// ------------------------------------------------------------- arrival

/** A dry night: the next light wakes, Zef and Pip travel there, and the new surprise is revealed. */
export function playArrival(from: number, to: number, preview: boolean) {
  if (to >= STOPS) return playCastleArrival(from, preview);
  return runCutscene('arrival', async (ctx) => {
    const g = useGame.getState();
    if (g.scene !== 'world') {
      await fade(ctx, 1, 0.5);
      g.set({ scene: 'world', room: 'hall' });
      await ctx.wait(0.2);
    }
    g.set({ litStop: from, focusStop: null });
    placeAtStop(from);
    zef.expression = 'smile';
    await fade(ctx, 0, 0.4);

    // good morning! a stretch and a yawn
    zefPlay('stretch', 1.6);
    pipReact('yawn', 1.4);
    await ctx.wait(1.5);

    // Pip notices the light waking up down the path
    const light = lightWorldPos(to);
    const lightTop = light.clone().add(new THREE.Vector3(0, 2.2, 0));
    pip.look = lightTop.clone();
    zef.look = lightTop.clone();
    pipReact('surprised', 1.2);
    const mid = zef.pos.clone().lerp(light, 0.45);
    const away = new THREE.Vector3().subVectors(light, zef.pos).setY(0).normalize();
    const side = new THREE.Vector3(-away.z, 0, away.x);
    const camPos = mid.clone().addScaledVector(away, -6).addScaledVector(side, 3).setY(Math.max(zef.pos.y, light.y) + 3.4);
    shot(camPos, lightTop, 1.6);
    await ctx.wait(1.2);
    for (let k = from + 1; k <= to; k++) {
      g.set({ litStop: k });
      bus.emit('lightWake', k);
      await ctx.wait(k === to ? 1.4 : 0.55);
    }

    // hooray!
    shot(
      zef.pos.clone().addScaledVector(away, 3.6).addScaledVector(side, 1.2).setY(zef.pos.y + 1.6),
      zef.pos.clone().setY(zef.pos.y + 0.8),
      2.2,
      3,
    );
    zef.look = null;
    zef.expression = 'happy';
    zefPlay('celebrate', 1.5);
    pipReact('cheer', 1.4);
    sfx.play('fanfare');
    burst('confetti', zef.pos.clone().setY(zef.pos.y + 1.4), { count: 26 });
    await ctx.wait(1.6);
    zef.expression = 'smile';
    pip.look = null;

    // travel together
    followCamera();
    pip.mode = 'follow';
    setPipSide(STOP_DEFS[to].pip[0] >= STOP_DEFS[to].zef[0] ? 1 : -1);
    const spot = stopSpotRoute(to);
    const reveal = STOP_DEFS[to].reveal && regionOfStop(to).stops[0] === to ? STOP_DEFS[to].reveal : undefined;
    const walking = walkRouteP(ctx, spot.s, spot.lateral);
    if (reveal) {
      await ctx.until(() => zef.s > spot.s - 11 || !zef.nav, 60);
      // sweep the camera over the new region
      shot(localToWorld(to, reveal.cam), localToWorld(to, reveal.look), 1.1);
      sfx.play('magic');
      await ctx.wait(2.6);
    }
    await walking;
    setFocus(to);
    cam.lambda = 1.8;
    bus.emit('stopWake', to);
    const w = stopWorldPoints(to);
    burst('sparkle', w.object.clone().setY(w.object.y + 1), { count: 30, speed: 3, size: 0.2 });
    sfx.play('sparkle');
    zef.expression = 'wow';
    zefPlay('point', 1.6);
    pipReact('surprised', 1.2);
    await ctx.wait(1.7);
    zef.expression = 'smile';
    pipReact('cheer', 1.2);
    useGame.getState().set({ hintStop: to });
    void preview;
  });
}

// ------------------------------------------------------- castle arrival

let doorsOpenedFlag = false;
export function notifyDoorsOpened() {
  doorsOpenedFlag = true;
}

export function playCastleArrival(from: number, preview: boolean) {
  return runCutscene('castle-arrival', async (ctx) => {
    const g = useGame.getState();
    if (g.scene !== 'world') {
      await fade(ctx, 1, 0.5);
      g.set({ scene: 'world' });
      await ctx.wait(0.2);
    }
    g.set({ litStop: from, focusStop: null });
    placeAtStop(from);
    await fade(ctx, 0, 0.4);
    zefPlay('stretch', 1.4);
    await ctx.wait(1.2);

    // the last light wakes and the castle hears it
    const light = lightWorldPos(STOPS);
    shot(light.clone().add(new THREE.Vector3(5, 4, 9)), light.clone().add(new THREE.Vector3(0, 2.5, 0)), 1.6);
    await ctx.wait(1.0);
    g.set({ litStop: STOPS });
    bus.emit('lightWake', STOPS);
    await ctx.wait(1.6);

    // a sweeping approach up the mountain while the castle lights wake
    pip.mode = 'follow';
    const spot = stopSpotRoute(STOPS);
    const walking = walkRouteP(ctx, spot.s, spot.lateral);
    zef.expression = 'happy';
    pip.fly = 1;
    shot(CASTLE_POS.clone().add(new THREE.Vector3(22, 6, 46)), CASTLE_POS.clone().add(new THREE.Vector3(0, 8, 0)), 0.9);
    await ctx.wait(1.8);
    bus.emit('castleWake');
    sfx.play('magic');
    await ctx.wait(1.6);
    shot(CASTLE_POS.clone().add(new THREE.Vector3(-10, 3, 30)), CASTLE_POS.clone().add(new THREE.Vector3(0, 10, 0)), 0.8);
    for (let k = 0; k < 3; k++) {
      bus.emit('fireworks', k);
      sfx.play('firework');
      await ctx.wait(0.7);
    }
    await walking;
    zef.expression = 'wow';
    setFocus(STOPS);
    cam.lambda = 1.5;
    bus.emit('stopWake', STOPS);
    zefPlay('lookUp', 1.8);
    pipReact('cheer', 1.5);
    await ctx.wait(1.6);
    zef.expression = 'happy';

    // invite Zef to open the doors; they open by themselves if he waits
    doorsOpenedFlag = false;
    g.set({ hintStop: STOPS, cutscene: 'castle-doors' });
    await ctx.until(() => doorsOpenedFlag, 10);
    if (!doorsOpenedFlag) bus.emit('castleDoorsOpen', true);
    g.set({ hintStop: null, cutscene: 'castle-arrival' });
    await enterCastleSequence(ctx);
    void preview;
  });
}

async function enterCastleSequence(ctx: Ctx) {
  zefPlay('cheer', 1.0);
  pipReact('cheer', 1.0);
  sfx.play('fanfare');
  await ctx.wait(1.4);
  const door = CASTLE_POS.clone().add(new THREE.Vector3(0, 0, 9.6));
  const inside = CASTLE_POS.clone().add(new THREE.Vector3(0, 0, 6.5));
  shot(CASTLE_POS.clone().add(new THREE.Vector3(1.5, 2.6, 17)), CASTLE_POS.clone().add(new THREE.Vector3(0, 2.2, 8)), 1.5);
  pip.mode = 'follow';
  await walkFreeP([door.setY(zef.pos.y), inside.setY(zef.pos.y)]);
  await fade(ctx, 1, 0.7);
  useGame.getState().set({ scene: 'castle', room: 'hall', focusStop: null });
  await ctx.wait(0.4);
  await fade(ctx, 0, 0.6);
  sfx.play('magic');
}

/** Revisit: tapping the open doors after the castle is earned walks Zef inside. */
export function enterCastleFromDoors() {
  return runCutscene('enter-castle', async (ctx) => {
    await enterCastleSequence(ctx);
  });
}

/** Leave the castle: back to the gate if the journey is there, otherwise home by balloon. */
export function leaveCastle() {
  return runCutscene('leave-castle', async (ctx) => {
    const g = useGame.getState();
    await fade(ctx, 1, 0.6);
    bus.emit('castleDoorsOpen', false);
    const lit = g.litStop;
    g.set({ scene: 'world', room: 'hall' });
    await ctx.wait(0.3);
    if (lit >= STOPS) placeAtStop(STOPS);
    else placeAtStop(0);
    await fade(ctx, 0, 0.6);
    pipReact('wave', 1.2);
  });
}

/** Fly from the cottage to the castle in the candy balloon. */
export function balloonTrip(fly: (u: number) => void) {
  return runCutscene('balloon', async (ctx) => {
    zef.scripted = true;
    pip.mode = 'scripted';
    zefPlay('ride', 99, true);
    pip.pose = 'ride';
    bus.emit('balloonGo');
    sfx.play('whoosh');
    const dur = motion.reduced ? 3 : 9;
    let t = 0;
    while (t < dur) {
      await ctx.wait(1 / 30);
      t += 1 / 30;
      fly(Math.min(1, t / dur));
    }
    await fade(ctx, 1, 0.6);
    zef.scripted = false;
    zef.action.name = 'none';
    pip.pose = 'stand';
    pip.mode = 'follow';
    useGame.getState().set({ scene: 'castle', room: 'hall', focusStop: null });
    await ctx.wait(0.3);
    await fade(ctx, 0, 0.6);
    sfx.play('magic');
  });
}

// ------------------------------------------------------------------- hug

let hugResolve: (() => void) | null = null;

export function finishHug() {
  hugResolve?.();
  hugResolve = null;
}

export function playHug(preview: boolean) {
  return runCutscene('hug', async (ctx) => {
    const g = useGame.getState();
    await fade(ctx, 1, 0.6);
    g.set({ scene: 'hug', focusStop: null, hugCaption: false });
    await ctx.wait(0.3);
    await fade(ctx, 0, 0.8);
    // the HugNook scene runs the animation; it reports when the hug has settled
    await ctx.until(() => hugSettled, 14);
    sfx.play('hug');
    g.set({ hugCaption: true });
    await new Promise<void>((resolve) => {
      hugResolve = resolve;
    });
    if (!ctx.alive()) return;
    g.set({ hugCaption: false });
    await fade(ctx, 1, 0.6);
    pip.targetScale = 1;
    pip.scale = 1;
    pip.mode = 'follow';
    pip.pose = 'stand';
    zef.action.name = 'none';
    zef.expression = 'smile';
    g.set({ scene: 'world', litStop: 0 });
    await ctx.wait(0.3);
    placeAtStop(0);
    await fade(ctx, 0, 0.7);
    pipReact('love', 1.6);
    zefPlay('wave', 1.4);
    void preview;
  });
}

export let hugSettled = false;
export function setHugSettled(v: boolean) {
  hugSettled = v;
}

// ------------------------------------------------------------------ bonus

/** Dry nights after the castle: fireworks over the castle to celebrate. */
export function playBonus() {
  return runCutscene('bonus', async (ctx) => {
    const g = useGame.getState();
    if (g.scene !== 'world') return;
    shot(CASTLE_POS.clone().add(new THREE.Vector3(0, 6, 34)), CASTLE_POS.clone().add(new THREE.Vector3(0, 12, 0)), 1.4);
    for (let k = 0; k < 5; k++) {
      bus.emit('fireworks', k);
      sfx.play('firework');
      await ctx.wait(0.6);
    }
    await ctx.wait(1);
    if (g.focusStop !== null) setFocus(g.focusStop);
    else followCamera();
  });
}

export function debugPlacePip() {
  placePip(zef.pos.clone().add(new THREE.Vector3(-0.8, 0, 0.4)));
}
