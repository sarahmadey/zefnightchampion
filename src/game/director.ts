// The director runs every moment of the morning ritual:
//
//   splash -> greeting -> the two big buttons -> a celebration or a hug -> see you tomorrow
//
// A dry morning: a star flies to the next stone, Zef's dino hops onto it, the
// underpants meter ticks up and one surprise plays (an egg with a new
// accessory, a high five, a dance party or a roar-off). Reaching the end of a
// land opens a prize chest; filling the meter opens the Underpants Store.
// A wet morning: Coach Rex walks over for a big hug, the meter starts fresh,
// and every star stays.
//
// Progress comes only from the save; the director compares it with what the
// child has already seen, so refreshes never replay or double-count.

import * as THREE from 'three';
import { Cancelled, cam, clock, coach, hero, play, type DinoActor } from './actors';
import { motion } from './settings';
import { bus } from './bus';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { unlockAudio, voiceLevel } from '../audio/core';
import { burst } from '../three/Particles';
import { useGame, useSave, type PreviewKind } from '../state/store';
import { computeQuest, landOf, landRange, todayKey, type QuestState } from '../state/progress';
import { ACCESSORIES, accessoriesUnlocked, accessoryForStar, prizeAt, surpriseFor, type Prize, type Species } from './rewards';
import { chestPos, landCurve, restPos, spacePos, storeLandmarkPos } from '../board/layout';
import { chestAnim, onChestTap } from '../board/Chest';
import { flyStar, fx, onEggTap, onHandTap, onPrizeTap } from '../board/EventProps';
import { pedestalHeight, pedestalPos, STORE_ORIGIN } from '../store/StoreScene';
import { lineup } from '../setup/SetupStage';
import { voice } from '../voice/voice';
import { lineText } from '../voice/lines';
import { boardView } from './CameraRig';
import { clamp, ease } from '../three/util';

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
  voice.stop();
  useGame.getState().set({ cutscene: null, caption: null, awaiting: null });
}

async function runCutscene(name: string, fn: (ctx: Ctx) => Promise<void>) {
  if (current) current.cancelled = true;
  const me = { id: ++seq, cancelled: false };
  current = me;
  useGame.getState().set({ cutscene: name });
  const ctx: Ctx = {
    wait: async (s) => {
      await clock.wait(s);
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
      useGame.getState().set({ cutscene: null, caption: null, awaiting: null });
    }
  }
}

// ------------------------------------------------------------ helpers

function data() {
  return useSave.getState().data;
}

function quest(): QuestState {
  const d = data();
  return computeQuest(d.records, d.rules);
}

function childName() {
  return data().profile.name || 'Zef';
}

function goal() {
  return data().rules.goal;
}

function prefetch(ids: string[]) {
  voice.prefetch(ids, childName(), goal());
}

/** Say a line: caption on screen, Coach Rex's jaw moving, wait until it's said. */
async function say(ctx: Ctx, id: string, pad = 0.25) {
  const g = useGame.getState();
  const text = lineText(id, childName(), goal());
  g.set({ caption: { text, who: 'coach' } });
  const dur = await voice.say(id, childName(), data().settings.sound, goal());
  const end = clock.time + dur;
  await ctx.until(() => clock.time >= end, dur + 2);
  if (useGame.getState().caption?.text === text) useGame.getState().set({ caption: null });
  await ctx.wait(pad);
}

/** Start a line without waiting for it to finish. */
function sayAsync(id: string) {
  const text = lineText(id, childName(), goal());
  useGame.getState().set({ caption: { text, who: 'coach' } });
  void voice.say(id, childName(), data().settings.sound, goal()).then((dur) => {
    setTimeout(() => {
      if (useGame.getState().caption?.text === text) useGame.getState().set({ caption: null });
    }, dur * 1000 + 200);
  });
}

/**
 * Per-frame: the coach's jaw follows the voice. The loudness goes through a
 * soft curve (quiet breaths keep the mouth closed, loud words don't slam it
 * wide open) and then opens quickly and closes a little slower, so the mouth
 * moves with the words instead of flickering with every wobble of the sound.
 */
export function updateTalk(dt: number) {
  const lvl = voice.speaking() ? voiceLevel() : 0;
  const target = Math.pow(clamp((lvl - 0.08) / 0.8, 0, 1), 0.75);
  const tau = target > coach.talk ? 0.045 : 0.13;
  coach.talk += (target - coach.talk) * (1 - Math.exp(-dt / tau));
}

function shot(pos: THREE.Vector3, target: THREE.Vector3, lambda = 2.2, fit = 0) {
  cam.mode = 'shot';
  cam.pos.copy(pos);
  cam.target.copy(target);
  cam.lambda = motion.reduced ? 6 : lambda;
  cam.fitWidth = fit;
}

function boardCamera(lambda = 2.2) {
  cam.mode = 'board';
  cam.lambda = lambda;
  cam.fitWidth = 0;
}

/** A close shot of Zef's dino and the coach from the board camera's side. */
function closeShot(lambda = 2.4) {
  const back = new THREE.Vector3().subVectors(cameraPos(), hero.pos).setY(0).normalize();
  const side = new THREE.Vector3(-back.z, 0, back.x);
  const mid = hero.pos.clone().lerp(coach.pos, 0.45);
  shot(mid.clone().addScaledVector(back, 4.2).addScaledVector(side, 0.2).setY(mid.y + 1.8), mid.clone().setY(mid.y + 0.85), lambda, 4.4);
}

function cameraPos(): THREE.Vector3 {
  const c = (window as unknown as { __camera?: THREE.Camera }).__camera;
  return c ? c.position.clone() : hero.pos.clone().add(new THREE.Vector3(0, 5, 7));
}

function faceCamera(a: DinoActor) {
  const c = cameraPos();
  a.heading = Math.atan2(c.x - a.pos.x, c.z - a.pos.z);
}

function faceEachOther() {
  hero.heading = Math.atan2(coach.pos.x - hero.pos.x, coach.pos.z - hero.pos.z);
  coach.heading = Math.atan2(hero.pos.x - coach.pos.x, hero.pos.z - coach.pos.z);
}

/** The board camera's forward direction at a board position (same rule as the camera rig). */
function boardFwd(stars: number): THREE.Vector3 {
  const rules = data().rules;
  const anchor = restPos(stars, rules);
  const end = landRange(landOf(stars, rules), rules).end;
  const ahead = spacePos(Math.min(stars + 4, end), rules);
  const f = ahead.clone().sub(anchor).setY(0);
  if (f.lengthSq() < 0.01) f.set(0, 0, -1);
  return f.normalize().lerp(new THREE.Vector3(0, 0, -1), 0.55).normalize();
}

/** Where Coach Rex stands: beside Zef's dino as the camera sees it, away from the next stone. */
function coachSpot(stars: number): THREE.Vector3 {
  const rules = data().rules;
  const p = restPos(stars, rules);
  const f = boardFwd(stars);
  const right = new THREE.Vector3(-f.z, 0, f.x);
  const next = spacePos(stars + 1, rules);
  const side = next.clone().sub(p).dot(right) > 0 ? -1 : 1;
  return p.clone().addScaledVector(right, 1.8 * side).addScaledVector(f, 0.6).setY(p.y - 0.12);
}

function placeAt(stars: number) {
  const rules = data().rules;
  hero.pos.copy(restPos(stars, rules)).setY(restPos(stars, rules).y - 0.12);
  coach.pos.copy(coachSpot(stars));
  hero.air = 0;
  hero.visible = true;
  coach.visible = true;
  hero.scale = 1;
  coach.scale = 1.75;
  boardView.anchor.copy(hero.pos);
  faceCamera(hero);
  faceCamera(coach);
}

async function hopTo(ctx: Ctx, a: DinoActor, to: THREE.Vector3, dur = 0.6, height = 0.9) {
  const from = a.pos.clone();
  a.heading = Math.atan2(to.x - from.x, to.z - from.z);
  // anticipation squash
  a.stretch = 0.82;
  await ctx.wait(0.12);
  sfx.play('hop');
  const start = clock.time;
  for (;;) {
    await ctx.wait(0);
    const u = clamp((clock.time - start) / dur, 0, 1);
    a.pos.lerpVectors(from, to, ease.inOutSine(u));
    a.air = Math.sin(u * Math.PI) * height;
    a.stretch = 1 + Math.sin(u * Math.PI) * 0.12;
    if (u >= 1) break;
  }
  a.air = 0;
  a.stretch = 0.8;
  sfx.play('land');
  burst('puff', a.pos.clone().setY(a.pos.y + 0.1), { count: 5, colors: ['#ffffff', '#f1f3f5'], size: 0.18, up: 0.3 });
  await ctx.wait(0.12);
  a.stretch = 1;
}

async function walkTo(ctx: Ctx, a: DinoActor, to: THREE.Vector3, speed = 2.2) {
  const from = a.pos.clone();
  const dist = from.distanceTo(to);
  if (dist < 0.05) return;
  a.heading = Math.atan2(to.x - from.x, to.z - from.z);
  a.walk = 1;
  const dur = dist / speed;
  const start = clock.time;
  for (;;) {
    await ctx.wait(0);
    const u = clamp((clock.time - start) / dur, 0, 1);
    a.pos.lerpVectors(from, to, u);
    if (u >= 1) break;
  }
  a.walk = 0;
}

/** Wait for the child to tap something (or for a friendly timeout). */
async function awaitTap(ctx: Ctx, kind: NonNullable<ReturnType<typeof useGame.getState>['awaiting']>, timeout: number, register: (fn: () => void) => void): Promise<boolean> {
  let tapped = false;
  register(() => {
    tapped = true;
  });
  useGame.getState().set({ awaiting: kind });
  await ctx.until(() => tapped, timeout);
  register(() => undefined);
  useGame.getState().set({ awaiting: null });
  return tapped;
}

function today() {
  return todayKey();
}

// ------------------------------------------------------------ boot & phases

/** Set the board to what the child has already seen, then decide where to start. */
export function boot() {
  const d = data();
  const q = computeQuest(d.records, d.rules);
  const shown = Math.min(d.seen.stars, q.stars);
  const g = useGame.getState();
  g.set({
    shownStars: shown,
    shownMeter: q.latest?.result === 'wet' && q.latest.date !== d.seen.hugDate ? d.seen.meter : Math.min(d.seen.meter, q.meter),
    shownAccessories: accessoriesUnlocked(shown),
    openedChests: Math.min(d.seen.prizes, q.prizes),
    showUnderpants: d.seen.underpants,
    land: landOf(shown, d.rules),
  });
  placeAt(shown);
  boardCamera();
  cam.snap = true;
  if (!d.profile.setupDone) {
    g.set({ phase: 'setup', scene: 'setup', setupStep: 'name' });
    setupCamera();
    return;
  }
  g.set({ phase: 'splash', scene: 'board' });
}

/** The first tap of the day: wake the sound, say good morning, then ask (or play what's new). */
export function startFromSplash() {
  const g = useGame.getState();
  if (g.phase !== 'splash') return;
  unlockAudio();
  if (data().settings.music) music.start();
  g.set({ phase: 'event' });
  void runCutscene('greet', async (ctx) => {
    placeAt(g.shownStars);
    play(hero, 'stretch', 1.8);
    play(coach, 'wave', 1.6);
    closeShot(2);
    const greets = ['greet-1', 'greet-2', 'greet-3'];
    const day = new Date().getDate();
    prefetch(['ask', 'already', ...greets]);
    await say(ctx, greets[day % 3]);
    if (hasPending()) {
      await playPending(ctx);
      return;
    }
    if (data().records[today()]) {
      await say(ctx, 'already');
      finishMorning();
      return;
    }
    boardCamera();
    useGame.getState().set({ phase: 'ask' });
    await say(ctx, 'ask');
  });
}

function finishMorning() {
  boardCamera(1.8);
  placeAt(useGame.getState().shownStars);
  useGame.getState().set({ phase: data().records[today()] ? 'done' : 'ask', caption: null });
}

/** True when the save holds something the child hasn't seen yet. */
function hasPending(): boolean {
  const d = data();
  const q = computeQuest(d.records, d.rules);
  if (q.stars > d.seen.stars) return true;
  if (q.prizes > d.seen.prizes) return true;
  if (d.underpants.earned && !d.seen.underpants) return true;
  if (q.latest?.result === 'wet' && q.latest.date !== d.seen.hugDate) return true;
  return false;
}

// ------------------------------------------------------------ the buttons

export function pressDry() {
  press('dry');
}

export function pressWet() {
  press('wet');
}

function press(result: 'dry' | 'wet') {
  const g = useGame.getState();
  if (g.phase !== 'ask' || g.preview) return;
  unlockAudio();
  if (data().settings.music) music.start();
  if (data().records[today()]) {
    g.set({ phase: 'done' });
    return;
  }
  g.set({ phase: 'event', caption: null });
  voice.stop();
  sfx.play('tap');
  useSave.getState().record(today(), result);
  void runCutscene(result === 'dry' ? 'dry' : 'wet', (ctx) => playPending(ctx));
}

/** Called after the parent corner closes or on boot: play anything new. */
export function checkProgress() {
  const g = useGame.getState();
  if (!g.ready || g.parentOpen || g.preview || g.cutscene) return;
  if (g.phase !== 'ask' && g.phase !== 'done') return;
  syncCorrections();
  if (!hasPending()) {
    const has = !!data().records[today()];
    if (g.phase === 'ask' && has) g.set({ phase: 'done' });
    if (g.phase === 'done' && !has) g.set({ phase: 'ask' });
    return;
  }
  g.set({ phase: 'event' });
  void runCutscene('pending', (ctx) => playPending(ctx));
}

/** A grown-up's correction lowered things: settle quietly, never "taking away" on screen. */
function syncCorrections() {
  const d = data();
  const q = computeQuest(d.records, d.rules);
  const g = useGame.getState();
  const patch: Partial<typeof d.seen> = {};
  if (q.stars < d.seen.stars) patch.stars = q.stars;
  if (q.prizes < d.seen.prizes) patch.prizes = q.prizes;
  if (Object.keys(patch).length) {
    useSave.getState().markSeen(patch);
    const shown = Math.min(g.shownStars, q.stars);
    g.set({ shownStars: shown, shownAccessories: accessoriesUnlocked(shown), openedChests: Math.min(g.openedChests, q.prizes), land: landOf(shown, d.rules) });
    placeAt(shown);
  }
  const latestWetUnseen = q.latest?.result === 'wet' && q.latest.date !== d.seen.hugDate;
  if (!latestWetUnseen && q.meter !== g.shownMeter && q.stars <= d.seen.stars) {
    g.set({ shownMeter: q.meter });
    useSave.getState().markSeen({ meter: q.meter });
  }
}

// ------------------------------------------------------------ the pipeline

async function playPending(ctx: Ctx) {
  const d = data();
  const q = computeQuest(d.records, d.rules);
  const g = useGame.getState();
  const latestDry = q.latest?.result === 'dry';
  prefetch(['dry-1', 'dry-2', 'dry-3', 'dry-4', 'dry-5', 'dry-6', 'wet-1', 'wet-2', 'wet-3', 'bye-1', 'bye-2', 'bye-3']);

  // 1. new stars
  if (q.stars > g.shownStars) {
    await celebrateStars(ctx, g.shownStars, q.stars, latestDry);
  }

  // 2. the meter catches up (dry) — a wet night's fresh start happens in the hug
  const after = quest();
  if (latestDry && after.meter !== useGame.getState().shownMeter) {
    await meterUp(ctx, useGame.getState().shownMeter, after.meter, data().rules.goal);
  }

  // 3. the surprise for today's star
  if (q.stars > d.seen.stars && latestDry) {
    await surprise(ctx, q.stars, false);
  }
  useSave.getState().markSeen({ stars: q.stars, meter: latestDry ? after.meter : data().seen.meter });

  // 4. the Underpants Store
  if (data().underpants.earned && !data().seen.underpants) {
    await storeVisit(ctx, false);
  }

  // 5. a hug for a wet morning
  const q2 = quest();
  if (q2.latest?.result === 'wet' && q2.latest.date !== data().seen.hugDate) {
    await hug(ctx, false);
    useSave.getState().markSeen({ hugDate: q2.latest.date, meter: q2.meter });
  }

  // 6. see you tomorrow
  await goodbye(ctx);
}

async function celebrateStars(ctx: Ctx, from: number, to: number, cheer: boolean) {
  const rules = data().rules;
  const g = useGame.getState();
  closeShot(2);
  if (cheer) {
    play(hero, 'cheer', 1.6);
    play(coach, 'cheer', 1.6);
    hero.expression = 'happy';
    sfx.play('fanfare');
    burst('confetti', hero.pos.clone().setY(hero.pos.y + 1.4), { count: 40 });
    const lines = ['dry-1', 'dry-2', 'dry-3', 'dry-4', 'dry-5', 'dry-6'];
    await say(ctx, to === 1 ? 'first-star' : lines[(to - 1) % lines.length], 0.1);
  }
  for (let s = from + 1; s <= to; s++) {
    const quick = s < to;
    boardCamera(2.4);
    const r = landRange(landOf(s - 1, rules), rules);
    const atChest = s === r.end;
    const target = spacePos(s, rules);
    await ctx.wait(quick ? 0.1 : 0.3);
    await flyStar(target);
    if (!ctx.alive()) return;
    useGame.getState().set({ shownStars: s });
    bus.emit('star', s);
    // hop onto the new stone (or up to the chest), coach strolls along
    const land = target.clone().setY(target.y - 0.12);
    if (atChest) {
      const prev = spacePos(s - 1, rules);
      land.add(prev.clone().sub(target).setY(0).normalize().multiplyScalar(1.15));
    }
    const walking = walkTo(ctx, coach, atChest ? land.clone().add(coachSpot(s - 1).sub(spacePos(s - 1, rules)).setY(0)) : coachSpot(s), 3);
    await hopTo(ctx, hero, land, quick ? 0.45 : 0.6);
    await walking;
    if (atChest) {
      await openChest(ctx, landOf(s - 1, rules), false);
      await crossBridge(ctx, landOf(s - 1, rules));
    }
  }
  faceCamera(hero);
  faceCamera(coach);
  hero.expression = 'smile';
  g.set({ land: landOf(to, rules) });
}

async function meterUp(ctx: Ctx, from: number, to: number, goal: number) {
  const g = useGame.getState();
  if (to < from) {
    g.set({ shownMeter: to });
    return;
  }
  for (let m = from + 1; m <= to; m++) {
    g.set({ shownMeter: m });
    sfx.play('tick', Math.min(9, Math.round((m / goal) * 9)));
    await ctx.wait(to - from > 3 ? 0.12 : 0.4);
  }
  const left = goal - to;
  if (to >= goal) return;
  if (left >= 1 && left <= 3) await say(ctx, `meter-${left}`);
  else if (to === Math.floor(goal / 2)) await say(ctx, 'meter-half');
  else if (to === 1 || to % 5 === 0) await say(ctx, 'meter-up');
}

// ------------------------------------------------------------ chests

async function openChest(ctx: Ctx, land: number, preview: boolean) {
  const rules = data().rules;
  const prize: Prize = prizeAt(data().prizes, land);
  const c = chestPos(land, rules);
  const back = new THREE.Vector3().subVectors(cameraPos(), c).setY(0).normalize();
  shot(c.clone().addScaledVector(back, 5).setY(c.y + 3.2), c.clone().setY(c.y + 1.2), 2.2, 4.5);
  faceCamera(hero);
  hero.look = c.clone().setY(c.y + 1.5);
  chestAnim.land = land;
  chestAnim.open = 0;
  chestAnim.rise = 0;
  chestAnim.wiggle = 1;
  sfx.play('drumroll');
  await say(ctx, 'chest-reach', 0.1);
  await awaitTap(ctx, 'chest', 12, (fn) => onChestTap(fn));
  onChestTap(null);
  chestAnim.wiggle = 0;
  chestAnim.open = 1;
  sfx.play('chest');
  sfx.play('fanfare');
  bus.emit('chest', land);
  burst('confetti', c.clone().setY(c.y + 1.2), { count: 60, speed: 4.5 });
  burst('sparkle', c.clone().setY(c.y + 1.5), { count: 40, speed: 3.5 });
  const start = clock.time;
  for (;;) {
    await ctx.wait(0);
    const u = clamp((clock.time - start) / 1.2, 0, 1);
    chestAnim.rise = ease.outBack(u);
    if (u >= 1) break;
  }
  play(hero, 'cheer', 2);
  play(coach, 'cheer', 2);
  await say(ctx, prizeLine(prize));
  await ctx.wait(0.6);
  if (!preview) {
    useSave.getState().markSeen({ prizes: Math.max(data().seen.prizes, land + 1) });
    useGame.getState().set({ openedChests: Math.max(useGame.getState().openedChests, land + 1) });
  }
  chestAnim.rise = 0;
  chestAnim.land = preview ? land : -1;
  hero.look = null;
}

function prizeLine(prize: Prize): string {
  const l = prize.label.trim().toLowerCase();
  if (l.includes('mcdonald')) return 'prize-mcdonalds';
  if (l.includes('movie')) return 'prize-movie';
  if (l.includes('pizza')) return 'prize-pizza';
  if (l.includes('squish')) return 'prize-squishy';
  if (l.includes('candy') || l.includes('sweet')) return 'prize-candy';
  if (l.includes('ice cream')) return 'prize-icecream';
  if (l.includes('book')) return 'prize-book';
  if (l.includes('park')) return 'prize-park';
  if (l.includes('toy')) return 'prize-toy';
  return 'prize-gift';
}

async function crossBridge(ctx: Ctx, land: number) {
  const rules = data().rules;
  const next = land + 1;
  const entry = landCurve(next, rules).getPointAt(0).clone();
  entry.y = restPos(landRange(next, rules).start, rules).y - 0.12;
  boardView.ahead.copy(entry);
  boardCamera(1.6);
  sayAsync(`land-${next % 7}`);
  const mid = hero.pos.clone().lerp(entry, 0.5);
  mid.y -= 0.3;
  const coachEnd = coachSpot(landRange(next, rules).start);
  const coachWalk = walkTo(ctx, coach, coachEnd, 3.2);
  await walkTo(ctx, hero, mid, 3);
  await walkTo(ctx, hero, entry, 3);
  await coachWalk;
  useGame.getState().set({ land: next });
  faceCamera(hero);
  faceCamera(coach);
  await ctx.wait(1.2);
}

// ------------------------------------------------------------ surprises

async function surprise(ctx: Ctx, star: number, preview: boolean) {
  const kind = surpriseFor(star);
  closeShot(2.2);
  faceCamera(hero);
  faceCamera(coach);
  if (kind === 'egg') await eggSurprise(ctx, star, preview);
  else if (kind === 'highfive') await highFive(ctx);
  else if (kind === 'dance') await danceParty(ctx);
  else await roarOff(ctx);
}

async function eggSurprise(ctx: Ctx, star: number, preview: boolean) {
  const acc = accessoryForStar(star);
  if (acc === null) return;
  const g = useGame.getState();
  if (preview) g.set({ shownAccessories: acc });
  // in front of the two dinos, in the middle of the shot
  const back = new THREE.Vector3().subVectors(cameraPos(), hero.pos).setY(0).normalize();
  fx.egg.pos.copy(hero.pos).lerp(coach.pos, 0.4).addScaledVector(back, 1.5);
  fx.egg.pos.y = Math.min(hero.pos.y, coach.pos.y) + 0.02;
  fx.egg.visible = true;
  fx.egg.pop = 0;
  fx.egg.crack = 0;
  fx.egg.hatch = 0;
  fx.egg.wobble = 1;
  hero.look = fx.egg.pos.clone();
  coach.look = fx.egg.pos.clone();
  sfx.play('pop');
  for (let i = 0; i <= 10; i++) {
    fx.egg.pop = i / 10;
    await ctx.wait(0.03);
  }
  prefetch(['egg-done', `acc-${ACCESSORIES[acc].id}`]);
  await say(ctx, 'egg', 0);
  // three taps crack it open; if nobody taps, it hatches by itself
  let taps = 0;
  const tapper = () => {
    if (fx.egg.hatch > 0) return;
    taps++;
    fx.egg.crack = taps;
    fx.egg.wobble = 1.4;
    sfx.play('crack', taps);
    burst('sparkle', fx.egg.pos.clone().setY(fx.egg.pos.y + 0.6), { count: 10 });
  };
  onEggTap(tapper);
  useGame.getState().set({ awaiting: 'egg' });
  const startT = clock.time;
  let nudged = false;
  await ctx.until(() => {
    if (!nudged && clock.time - startT > 6 && taps < 3) {
      nudged = true;
      sayAsync('egg-tap');
    }
    if (clock.time - startT > 14 && taps < 3) tapper();
    return taps >= 3;
  }, 30);
  onEggTap(null);
  useGame.getState().set({ awaiting: null });
  await ctx.wait(0.25);
  fx.egg.hatch = 1;
  sfx.play('hatch');
  burst('confetti', fx.egg.pos.clone().setY(fx.egg.pos.y + 0.7), { count: 50, speed: 3.5 });

  // the prize floats up out of the egg, big and spinning, in a close-up
  const up = fx.egg.pos.clone().setY(fx.egg.pos.y + 1.3);
  const prize = fx.prize;
  prize.index = acc;
  prize.species = data().profile.species;
  prize.float = 1;
  prize.size = 0.05;
  prize.pos.copy(fx.egg.pos).setY(fx.egg.pos.y + 0.4);
  prize.visible = true;
  hero.look = up.clone();
  coach.look = up.clone();
  hero.expression = 'wow';
  shot(up.clone().addScaledVector(back, 3.1).setY(up.y + 0.3), up.clone().setY(up.y - 0.05), 2.8, 1.9);
  sfx.play('magic');
  const from = prize.pos.clone();
  let start = clock.time;
  for (;;) {
    await ctx.wait(0);
    const u = clamp((clock.time - start) / 0.9, 0, 1);
    prize.pos.lerpVectors(from, up, ease.outCubic(u));
    prize.size = 0.05 + 1.1 * ease.outBack(u);
    if (u >= 1) break;
  }
  burst('sparkle', up, { count: 36, speed: 3 });
  play(coach, 'cheer', 1.6);
  // "Look what was inside! Tap the big button to collect it!"
  let collected = false;
  const collect = () => {
    collected = true;
  };
  onPrizeTap(collect);
  collectTap = collect;
  useGame.getState().set({ awaiting: 'collect' });
  sayAsync('egg-done');
  // a few twinkles round the edge (never in front of it)
  const sideways = new THREE.Vector3(-back.z, 0, back.x);
  const sparkles = setInterval(() => {
    const a = Math.random() * Math.PI * 2;
    const at = up.clone().addScaledVector(sideways, Math.cos(a) * 0.85).setY(up.y + Math.sin(a) * 0.7).addScaledVector(back, -0.3);
    burst('sparkle', at, { count: 3, speed: 0.8 });
  }, 650);
  try {
    // if nobody taps, it goes on by itself after a while
    await ctx.until(() => collected, 25);
  } finally {
    clearInterval(sparkles);
    onPrizeTap(null);
    collectTap = null;
    useGame.getState().set({ awaiting: null });
  }
  voice.stop();
  useGame.getState().set({ caption: null });

  // it flies onto Zef's dino
  sfx.play('whoosh');
  closeShot(2.4);
  prize.float = 0;
  const slot = ACCESSORIES[acc].slot;
  const flyFrom = prize.pos.clone();
  start = clock.time;
  for (;;) {
    await ctx.wait(0);
    const u = clamp((clock.time - start) / 0.75, 0, 1);
    const to = hero.slots[slot];
    prize.pos.lerpVectors(flyFrom, to, ease.inOutSine(u));
    prize.pos.y += Math.sin(u * Math.PI) * 0.9;
    prize.size = 1.15 - 0.85 * ease.inCubic(u);
    if (u >= 1) break;
  }
  prize.visible = false;
  fx.egg.visible = false;
  useGame.getState().set({ shownAccessories: acc + 1 });
  sfx.play('sparkle');
  burst('sparkle', hero.slots[slot].clone(), { count: 40, speed: 3 });
  burst('confetti', hero.pos.clone().setY(hero.pos.y + 1.2), { count: 30, speed: 3 });
  hero.look = null;
  coach.look = null;
  hero.expression = 'happy';
  faceCamera(hero);
  play(hero, 'show', 2.2);
  // a close-up of Zef's dino wearing it
  const toCam = new THREE.Vector3().subVectors(cameraPos(), hero.pos).setY(0).normalize();
  shot(hero.pos.clone().addScaledVector(toCam, 3.2).setY(hero.pos.y + 1.4), hero.pos.clone().setY(hero.pos.y + 0.8), 2.4, 2.4);
  await say(ctx, `acc-${ACCESSORIES[acc].id}`);
  hero.expression = 'smile';
}

let collectTap: (() => void) | null = null;

/** The big "Collect!" button under the prize from the egg. */
export function collectPrize() {
  if (useGame.getState().awaiting !== 'collect') return;
  sfx.play('tap');
  collectTap?.();
}

let highFiveSlap: (() => void) | null = null;

async function highFive(ctx: Ctx) {
  play(coach, 'highfive', 99, true);
  await ctx.wait(0.4);
  fx.hand.follow = coach;
  fx.hand.visible = true;
  await say(ctx, 'highfive', 0);
  let slapped = false;
  const slap = () => {
    slapped = true;
  };
  onHandTap(slap);
  highFiveSlap = slap;
  useGame.getState().set({ awaiting: 'highfive' });
  await ctx.until(() => slapped, 12);
  onHandTap(null);
  highFiveSlap = null;
  useGame.getState().set({ awaiting: null });
  fx.hand.visible = false;
  // Zef's dino jumps up and slaps it
  const hp = coach.hand.clone();
  fx.hand.follow = null;
  hero.heading = Math.atan2(coach.pos.x - hero.pos.x, coach.pos.z - hero.pos.z);
  play(hero, 'highfive', 0.9);
  hero.air = 0;
  const start = clock.time;
  for (;;) {
    await ctx.wait(0);
    const u = clamp((clock.time - start) / 0.45, 0, 1);
    hero.air = Math.sin(u * Math.PI) * 0.6;
    if (u >= 1) break;
  }
  sfx.play('slap');
  bus.emit('slap');
  cam.shake = 0.12;
  burst('sparkle', hp, { count: 34, speed: 4, colors: ['#fff3a8', '#ffffff', '#ffd43b'] });
  burst('confetti', hp, { count: 20 });
  play(coach, 'cheer', 1.4);
  play(hero, 'cheer', 1.4);
  hero.expression = 'happy';
  await say(ctx, 'highfive-done');
  faceCamera(hero);
  hero.expression = 'smile';
}

async function danceParty(ctx: Ctx) {
  music.setMood('party');
  await say(ctx, 'dance', 0);
  const moves: [import('./actors').DinoAction, number][] = [
    ['wiggle', 2.4],
    ['spin', 1.3],
    ['stomp', 2.2],
    ['twist', 2.4],
    ['spin', 1.3],
  ];
  const off = bus.on('stomp', () => {
    cam.shake = 0.08;
    sfx.play('stomp');
  });
  useGame.getState().set({ awaiting: null });
  dancing = true;
  for (const [m, dur] of moves) {
    play(hero, m, dur);
    play(coach, m === 'spin' ? 'wiggle' : m, dur);
    burst('note', hero.pos.clone().setY(hero.pos.y + 1.3), { count: 3 });
    await ctx.wait(dur);
  }
  dancing = false;
  off();
  music.setMood('play');
  play(hero, 'cheer', 1.2);
  await say(ctx, 'dance-done');
}

let dancing = false;
let roarTaps = 0;
let roaring = false;

async function roarOff(ctx: Ctx) {
  await say(ctx, 'roar', 0);
  roarTaps = 0;
  roaring = true;
  useGame.getState().set({ awaiting: 'roar' });
  const startT = clock.time;
  let lastAuto = startT;
  await ctx.until(() => {
    if (clock.time - startT > 7 && clock.time - lastAuto > 2.2 && roarTaps < 3) {
      lastAuto = clock.time;
      heroRoar();
    }
    return roarTaps >= 3 && hero.action.name === 'none';
  }, 30);
  roaring = false;
  useGame.getState().set({ awaiting: null });
  await ctx.wait(0.3);
  // Coach Rex roars back — the biggest one
  play(coach, 'roar', 2.0);
  sfx.play('roar', 1, 1);
  cam.shake = 0.3;
  burst('puff', coach.pos.clone().setY(coach.pos.y + 2), { count: 10, size: 0.5, colors: ['#ffffff'] });
  await ctx.wait(2.0);
  play(hero, 'cheer', 1.2);
  await say(ctx, 'roar-done');
}

function heroRoar() {
  if (hero.action.name === 'roar') return;
  roarTaps++;
  const power = Math.min(1, roarTaps / 3);
  play(hero, 'roar', 1.3 + power * 0.4);
  sfx.play('roar', 0, power);
  cam.shake = 0.08 + power * 0.18;
  burst('sparkle', hero.pos.clone().setY(hero.pos.y + 1.0), { count: 8 + roarTaps * 6, speed: 2 + roarTaps });
  if (roarTaps === 2) sayAsync('roar-more');
}

// ------------------------------------------------------------ taps

export function tapHero() {
  const g = useGame.getState();
  if (g.awaiting === 'roar' && roaring) {
    heroRoar();
    return;
  }
  if (dancing) {
    play(hero, 'spin', 1.2);
    return;
  }
  if (g.cutscene || g.phase === 'setup') return;
  const r = Math.floor(Math.random() * 4);
  const acts = ['giggle', 'spin', 'roar', 'cheer'] as const;
  play(hero, acts[r], acts[r] === 'roar' ? 1.3 : 1.1);
  if (acts[r] === 'roar') sfx.play('roar', 0, 0.3);
  else sfx.play(acts[r] === 'giggle' ? 'giggle' : 'boing');
  burst('sparkle', hero.pos.clone().setY(hero.pos.y + 1), { count: 10 });
}

let coachTapN = 0;
export function tapCoach() {
  const g = useGame.getState();
  if (g.awaiting === 'highfive') {
    // tapping anywhere on the coach counts as a high five too
    highFiveSlap?.();
    return;
  }
  if (g.cutscene || g.phase === 'setup' || voice.speaking()) return;
  coachTapN++;
  play(coach, coachTapN % 2 ? 'giggle' : 'wave', 1.2);
  sfx.play('boing');
  const lines = ['tap-1', 'tap-2', 'tap-3', 'tap-4'];
  sayAsync(lines[coachTapN % lines.length]);
}

// ------------------------------------------------------------ hug

async function hug(ctx: Ctx, preview: boolean) {
  music.setMood('calm');
  hero.expression = 'calm';
  faceCamera(hero);
  closeShot(1.8);
  await say(ctx, 'wet-1', 0.1);
  // Coach walks over beside Zef (side-on to the camera) and wraps him up
  const view = new THREE.Vector3().subVectors(hero.pos, cameraPos()).setY(0).normalize();
  const right = new THREE.Vector3(-view.z, 0, view.x);
  const sideSign = new THREE.Vector3().subVectors(coach.pos, hero.pos).dot(right) >= 0 ? 1 : -1;
  const spot = hero.pos.clone().addScaledVector(right, 1.15 * sideSign);
  spot.y = coach.pos.y;
  await walkTo(ctx, coach, spot, 2);
  faceEachOther();
  play(coach, 'hug', 99, true);
  play(hero, 'hugged', 99, true);
  hero.expression = 'happy';
  sfx.play('hug');
  const mid = hero.pos.clone().lerp(coach.pos, 0.5);
  shot(mid.clone().addScaledVector(view, -3.8).setY(mid.y + 1.7), mid.clone().setY(mid.y + 0.95), 1.5, 3.4);
  const hearts = setInterval(() => burst('heart', mid.clone().setY(mid.y + 1.6), { count: 3 }), 600);
  try {
    await say(ctx, 'wet-2', 0.3);
    // the meter starts fresh; the stars all stay
    const g = useGame.getState();
    const from = g.shownMeter;
    for (let m = from; m > 0; m--) {
      g.set({ shownMeter: m - 1 });
      await ctx.wait(from > 8 ? 0.05 : 0.1);
    }
    if (!preview) g.set({ shownMeter: 0 });
    sfx.play('sparkle');
    boardCamera(1.4);
    await say(ctx, 'wet-3', 0.2);
  } finally {
    clearInterval(hearts);
  }
  play(coach, 'none');
  play(hero, 'none');
  coach.action.name = 'none';
  hero.action.name = 'none';
  await walkTo(ctx, coach, coachSpot(useGame.getState().shownStars), 2.2);
  faceCamera(hero);
  faceCamera(coach);
  hero.expression = 'smile';
  music.setMood('play');
}

// ------------------------------------------------------------ store

let storePick: number | null = null;
export function pickUnderpantsTap(i: number) {
  if (useGame.getState().awaiting !== 'store-pick') return;
  storePick = i;
}

async function storeVisit(ctx: Ctx, preview: boolean) {
  const g = useGame.getState();
  closeShot(2);
  play(hero, 'cheer', 2);
  play(coach, 'cheer', 2);
  sfx.play('fanfare');
  const fireworks = setInterval(() => burst('confetti', hero.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 2.5, (Math.random() - 0.5) * 2)), { count: 30, speed: 4 }), 450);
  try {
    await say(ctx, 'store-open', 0.2);
  } finally {
    clearInterval(fireworks);
  }
  // the store lights up far away
  const store = storeLandmarkPos(landOf(g.shownStars, data().rules), data().rules);
  shot(hero.pos.clone().add(new THREE.Vector3(0, 3.5, 6)), store.clone().add(new THREE.Vector3(0, 4, 0)), 1.2);
  await ctx.wait(1.5);
  // a pterodactyl swoops down to give Zef a ride
  fx.ptero.visible = true;
  fx.ptero.flap = 1;
  const above = hero.pos.clone().add(new THREE.Vector3(0, 2.3, 0));
  const startP = above.clone().add(new THREE.Vector3(-14, 8, 10));
  sfx.play('flap');
  let start = clock.time;
  for (;;) {
    await ctx.wait(0);
    const u = clamp((clock.time - start) / 2, 0, 1);
    fx.ptero.pos.lerpVectors(startP, above, ease.outCubic(u));
    fx.ptero.heading = Math.atan2(above.x - startP.x, above.z - startP.z);
    if (u >= 1) break;
  }
  closeShot(2);
  await say(ctx, 'store-fly', 0);
  play(hero, 'cheer', 1.2);
  const lift = hero.pos.clone();
  const flyTo = store.clone().add(new THREE.Vector3(0, 6, 8));
  shot(lift.clone().add(new THREE.Vector3(5, 4, 9)), lift.clone().add(new THREE.Vector3(0, 3, -6)), 1.2);
  sfx.play('whoosh');
  start = clock.time;
  coach.visible = false;
  for (;;) {
    await ctx.wait(0);
    const u = clamp((clock.time - start) / 3.2, 0, 1);
    const p = new THREE.Vector3().lerpVectors(above, flyTo, ease.inOutSine(u));
    p.y += Math.sin(u * Math.PI) * 4;
    fx.ptero.pos.copy(p);
    fx.ptero.heading = Math.atan2(flyTo.x - above.x, flyTo.z - above.z);
    hero.pos.copy(p).add(new THREE.Vector3(0, -1.5, 0));
    hero.heading = fx.ptero.heading;
    if (u > 0.7) g.set({ fade: (u - 0.7) / 0.3 });
    if (u >= 1) break;
  }
  g.set({ fade: 1 });
  await ctx.wait(0.4);
  fx.ptero.visible = false;

  // inside the shop
  g.set({ scene: 'store' });
  hero.pos.copy(STORE_ORIGIN).add(new THREE.Vector3(-2.6, 0, 1.4));
  coach.pos.copy(STORE_ORIGIN).add(new THREE.Vector3(2.9, 0, 1.2));
  coach.visible = true;
  hero.visible = true;
  hero.heading = 2.6;
  coach.heading = -2.5;
  hero.air = 0;
  shot(STORE_ORIGIN.clone().add(new THREE.Vector3(0, 3.1, 6.6)), STORE_ORIGIN.clone().add(new THREE.Vector3(0, 1.3, -1.6)), 3, 6.6);
  cam.snap = true;
  music.setMood('party');
  await ctx.wait(0.3);
  g.set({ fade: 0 });
  await ctx.wait(0.6);
  await say(ctx, 'store-pick', 0);
  storePick = null;
  useGame.getState().set({ awaiting: 'store-pick' });
  const t0 = clock.time;
  await ctx.until(() => storePick !== null || clock.time - t0 > 60, 70);
  useGame.getState().set({ awaiting: null });
  const choice = storePick ?? 0;
  if (!preview) useSave.getState().pickUnderpants(choice);
  const ped = pedestalPos(choice);
  burst('confetti', ped.clone().setY(pedestalHeight(choice) + 0.6), { count: 50, speed: 4 });
  burst('sparkle', ped.clone().setY(pedestalHeight(choice) + 0.5), { count: 30 });
  sfx.play('magic');
  // put them on, up on the show-off stage
  await walkTo(ctx, hero, STORE_ORIGIN.clone().add(new THREE.Vector3(0, 0.12, 1.6)), 2.6);
  faceCamera(hero);
  g.set({ showUnderpants: true, previewUnderpants: preview ? choice : null });
  burst('sparkle', hero.pos.clone().setY(hero.pos.y + 0.6), { count: 40, speed: 3 });
  shot(STORE_ORIGIN.clone().add(new THREE.Vector3(0, 1.9, 5.4)), STORE_ORIGIN.clone().add(new THREE.Vector3(0, 0.7, 1.6)), 2, 3.4);
  play(hero, 'show', 2.4);
  await say(ctx, 'store-picked', 0);
  faceCamera(hero);
  play(hero, 'cheer', 2.4);
  play(coach, 'cheer', 2.4);
  const party = setInterval(() => burst('confetti', STORE_ORIGIN.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 3)), { count: 24 }), 400);
  try {
    await say(ctx, 'store-done', 0.4);
  } finally {
    clearInterval(party);
  }
  if (!preview) useSave.getState().markSeen({ underpants: true });
  music.setMood('play');
  // back to the board
  g.set({ fade: 1 });
  await ctx.wait(0.6);
  g.set({ scene: 'board' });
  placeAt(g.shownStars);
  boardCamera();
  cam.snap = true;
  await ctx.wait(0.3);
  g.set({ fade: 0 });
  await ctx.wait(0.5);
}

// ------------------------------------------------------------ goodbye

async function goodbye(ctx: Ctx) {
  boardCamera(1.8);
  faceCamera(hero);
  faceCamera(coach);
  play(hero, 'wave', 1.6);
  play(coach, 'wave', 1.6);
  const d = new Date();
  const lines = ['bye-1', 'bye-2', 'bye-3'];
  await say(ctx, lines[d.getDate() % 3]);
  finishMorning();
}

// ------------------------------------------------------------ replay & previews

/** "Watch again": replay this morning's moment without changing anything. */
export function replayToday() {
  const g = useGame.getState();
  if (g.phase !== 'done' || g.cutscene) return;
  const r = data().records[today()];
  if (!r) return;
  startPreview(r === 'dry' ? 'dry' : 'wet', true);
}

let previewRestore: { stars: number; meter: number; acc: number; chests: number; pants: boolean } | null = null;
let previewSeq = 0;

/** Grown-ups can preview any moment; real progress never changes. */
export function startPreview(kind: PreviewKind, fromChild = false) {
  cancelCutscene();
  const g = useGame.getState();
  unlockAudio();
  if (data().settings.music) music.start();
  if (!g.preview) previewRestore = { stars: g.shownStars, meter: g.shownMeter, acc: g.shownAccessories, chests: g.openedChests, pants: g.showUnderpants };
  const myPreview = ++previewSeq;
  g.set({ preview: { kind, replay: fromChild }, parentOpen: false, phase: 'event', scene: kind === 'intro' ? 'board' : g.scene });
  void runCutscene(`preview-${kind}`, async (ctx) => {
    const rules = data().rules;
    const stars = g.shownStars;
    placeAt(stars);
    if (kind === 'dry') {
      const target = fromChild ? stars : stars + 1;
      if (fromChild) {
        g.set({ shownStars: Math.max(0, stars - 1) });
        placeAt(Math.max(0, stars - 1));
      }
      const from = useGame.getState().shownStars;
      await celebrateStarsPreview(ctx, from, target);
      const goal = rules.goal;
      await meterUp(ctx, g.shownMeter, Math.min(goal - 1, g.shownMeter + (fromChild ? 0 : 1)), goal);
      await surprise(ctx, Math.max(1, target), true);
    } else if (kind === 'wet') {
      await hug(ctx, true);
    } else if (kind === 'prize') {
      const land = landOf(stars, rules);
      await openChest(ctx, land, true);
    } else if (kind === 'store') {
      await storeVisit(ctx, true);
    } else if (kind === 'intro') {
      await intro(ctx);
    }
    await goodbyePreview(ctx);
  }).finally(() => {
    if (previewSeq === myPreview) endPreview();
  });
}

async function celebrateStarsPreview(ctx: Ctx, from: number, to: number) {
  closeShot(2);
  play(hero, 'cheer', 1.6);
  play(coach, 'cheer', 1.6);
  sfx.play('fanfare');
  burst('confetti', hero.pos.clone().setY(hero.pos.y + 1.4), { count: 40 });
  const lines = ['dry-1', 'dry-2', 'dry-3', 'dry-4', 'dry-5', 'dry-6'];
  await say(ctx, lines[Math.max(0, to - 1) % lines.length], 0.1);
  if (to <= from) return;
  const rules = data().rules;
  boardCamera(2.4);
  const target = spacePos(to, rules);
  await flyStar(target);
  useGame.getState().set({ shownStars: to });
  const walking = walkTo(ctx, coach, coachSpot(to), 3);
  await hopTo(ctx, hero, target.clone().setY(target.y - 0.12), 0.6);
  await walking;
  faceCamera(hero);
  faceCamera(coach);
}

async function goodbyePreview(ctx: Ctx) {
  boardCamera(1.8);
  play(hero, 'wave', 1.4);
  play(coach, 'wave', 1.4);
  await ctx.wait(1.2);
}

export function endPreview() {
  if (!useGame.getState().preview) return;
  cancelCutscene();
  const g = useGame.getState();
  const r = previewRestore;
  chestAnim.land = -1;
  chestAnim.open = 0;
  chestAnim.rise = 0;
  fx.egg.visible = false;
  fx.prize.visible = false;
  fx.hand.visible = false;
  fx.ptero.visible = false;
  fx.star.active = false;
  music.setMood('play');
  if (r) g.set({ shownStars: r.stars, shownMeter: r.meter, shownAccessories: r.acc, openedChests: r.chests, showUnderpants: r.pants });
  g.set({ preview: null, fade: 0, scene: data().profile.setupDone ? 'board' : 'setup', previewUnderpants: null });
  previewRestore = null;
  coach.action.name = 'none';
  hero.action.name = 'none';
  coach.visible = true;
  hero.visible = true;
  hero.expression = 'smile';
  placeAt(useGame.getState().shownStars);
  boardCamera();
  cam.snap = true;
  g.set({ phase: data().profile.setupDone ? (data().records[today()] ? 'done' : 'ask') : 'setup' });
  setTimeout(() => checkProgress(), 300);
}

// ------------------------------------------------------------ first-time setup

function setupCamera() {
  const o = new THREE.Vector3(0, 0, -800);
  shot(o.clone().add(new THREE.Vector3(0, 1.6, 5.8)), o.clone().add(new THREE.Vector3(0, 0.85, 0)), 3, 6.4);
  cam.snap = true;
}

export function setupNameDone(name: string) {
  const g = useGame.getState();
  unlockAudio();
  if (data().settings.music) music.start();
  useSave.getState().setProfile({ name: name.trim().slice(0, 24) || 'Zef' });
  g.set({ setupStep: 'dino' });
  setupCamera();
  void runCutscene('setup-dino', async (ctx) => {
    for (const s of Object.values(lineup)) play(s, 'wave', 1.4);
    await say(ctx, 'pick-dino');
  });
}

export function setupPickSpecies(species: Species) {
  const g = useGame.getState();
  if (g.setupStep !== 'dino') return;
  useSave.getState().setProfile({ species });
  sfx.play('pop');
  const a = lineup[species];
  play(a, 'roar', 1.4);
  sfx.play('roar', 0, 0.5);
  burst('confetti', a.pos.clone().setY(1.6), { count: 30 });
  void runCutscene('setup-picked', async (ctx) => {
    await say(ctx, `picked-${species}`, 0.3);
    useGame.getState().set({ setupStep: 'color' });
    shot(new THREE.Vector3(0, 1.7, -800 + 5.0), new THREE.Vector3(0, 0.95, -800), 3, 3.8);
    await say(ctx, 'pick-color');
  });
}

export function setupPickColor(color: number) {
  if (useGame.getState().setupStep !== 'color') return;
  useSave.getState().setProfile({ color });
  const sp = data().profile.species;
  play(lineup[sp], 'show', 1.6);
  sfx.play('sparkle');
  burst('sparkle', lineup[sp].pos.clone().setY(1.2), { count: 24 });
}

export function setupDone() {
  const g = useGame.getState();
  if (g.setupStep !== 'color') return;
  sfx.play('fanfare');
  void runCutscene('setup-done', async (ctx) => {
    play(lineup[data().profile.species], 'cheer', 1.6);
    await say(ctx, 'color-done', 0.2);
    g.set({ fade: 1 });
    await ctx.wait(0.5);
    g.set({ scene: 'board', setupStep: null });
    placeAt(useGame.getState().shownStars);
    boardCamera();
    cam.snap = true;
    await ctx.wait(0.3);
    g.set({ fade: 0 });
    await intro(ctx);
    useSave.getState().setProfile({ setupDone: true });
    g.set({ phase: data().records[today()] ? 'done' : 'ask' });
    if (!data().records[today()]) await say(ctx, 'ask');
  });
}

/**
 * Coach Rex explains the mission, with the camera showing each part: why
 * (underwear at night instead of diapers), the morning button and the stars,
 * the prizes along the way, the hug, the meter, and the Underwear Store where
 * Zef picks out underwear for his dino.
 */
async function intro(ctx: Ctx) {
  const g = useGame.getState();
  g.set({ phase: 'event' });
  const rules = data().rules;
  const stars = g.shownStars;
  placeAt(stars);
  prefetch(['intro-1', 'intro-2', 'intro-3', 'intro-prizes', 'intro-4', 'intro-meter', 'intro-store', 'intro-go']);
  closeShot(2);
  play(coach, 'wave', 1.8);
  await say(ctx, 'intro-1');
  play(hero, 'cheer', 1.4);
  await say(ctx, 'intro-2');
  // the path and the stars
  boardCamera(1.5);
  const next = spacePos(stars + 1, rules);
  hero.look = next.clone();
  await say(ctx, 'intro-3');
  hero.look = null;
  // the chest at the end of this land: prizes along the way
  const land = landOf(stars, rules);
  const c = chestPos(land, rules);
  shot(c.clone().add(new THREE.Vector3(3, 4, 7)), c.clone().setY(c.y + 1.2), 1.2);
  Object.assign(chestAnim, { land, open: 0, rise: 0, wiggle: 1 });
  g.set({ highlight: 'stars' });
  await say(ctx, 'intro-prizes');
  g.set({ highlight: null });
  chestAnim.wiggle = 0;
  chestAnim.land = -1;
  // not dry: a hug
  closeShot(2);
  play(coach, 'hug', 2.2);
  await say(ctx, 'intro-4');
  coach.action.name = 'none';
  // the meter: dry nights in a row fill it up
  boardCamera(1.5);
  g.set({ highlight: 'meter' });
  await say(ctx, 'intro-meter');
  g.set({ highlight: null });
  // the Underwear Store, far away
  const store = storeLandmarkPos(land, rules);
  shot(hero.pos.clone().add(new THREE.Vector3(2, 4, 8)), store.clone().add(new THREE.Vector3(0, 3, 0)), 1.0);
  await say(ctx, 'intro-store', 0.1);
  closeShot(2);
  play(coach, 'cheer', 1.4);
  play(hero, 'cheer', 1.4);
  await say(ctx, 'intro-go', 0);
  play(coach, 'roar', 1.8);
  play(hero, 'roar', 1.8);
  sfx.play('roar', 1, 0.8);
  sfx.play('roar', 0, 0.6);
  cam.shake = 0.25;
  await ctx.wait(1.8);
  boardCamera();
}

/**
 * A grown-up's "start over": wipe the quest and go back to the very first
 * screen (the name), so the dino picking and the intro play again.
 */
export function startOver() {
  cancelCutscene();
  previewRestore = null;
  Object.assign(chestAnim, { land: -1, open: 0, rise: 0, wiggle: 0 });
  fx.egg.visible = false;
  fx.prize.visible = false;
  fx.hand.visible = false;
  fx.ptero.visible = false;
  fx.star.active = false;
  music.setMood('play');
  for (const a of [hero, coach]) {
    a.action.name = 'none';
    a.expression = 'smile';
    a.look = null;
    a.visible = true;
  }
  useSave.getState().startOver();
  useGame.getState().set({ preview: null, parentOpen: false, fade: 0, highlight: null, previewUnderpants: null, setupStep: null });
  boot();
}

/** Re-place the dinos and camera after a grown-up resets or corrects things. */
export function resetBoardView() {
  const g = useGame.getState();
  placeAt(g.shownStars);
  boardCamera();
  cam.snap = true;
}

export function skipIntro() {
  const g = useGame.getState();
  if (!g.cutscene?.startsWith('setup-done') && g.preview?.kind !== 'intro') return;
  if (g.preview) {
    endPreview();
    return;
  }
  cancelCutscene();
  useSave.getState().setProfile({ setupDone: true });
  g.set({ highlight: null, fade: 0, scene: 'board', setupStep: null });
  placeAt(g.shownStars);
  boardCamera();
  g.set({ phase: data().records[today()] ? 'done' : 'ask' });
}

