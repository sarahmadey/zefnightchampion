// A cheerful little jungle groove played by WebAudio: marimba chords, a
// bouncy bass, shakers and a soft kick, scheduled a moment ahead so it stays
// in time. A calmer, slower mood plays during hugs, and just the drums and
// bass while the child plays the dino band's rocks.

import { audioIfReady } from './core';

type Mood = 'play' | 'calm' | 'party' | 'band';

const CHORDS = [
  [0, 4, 7], // C
  [7, 11, 14], // G
  [9, 12, 16], // Am
  [5, 9, 12], // F
];

function hz(semisFromC4: number) {
  return 261.63 * Math.pow(2, semisFromC4 / 12);
}

let timer: number | null = null;
let nextTime = 0;
let step = 0;
let mood: Mood = 'play';
let started = false;

function marimba(ctx: AudioContext, out: AudioNode, f: number, t: number, vol: number) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = f;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = f * 4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(vol * 0.25, t + 0.003);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  o.connect(g);
  o2.connect(g2);
  g.connect(out);
  g2.connect(out);
  o.start(t);
  o2.start(t);
  o.stop(t + 0.5);
  o2.stop(t + 0.1);
}

function bass(ctx: AudioContext, out: AudioNode, f: number, t: number, len: number) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = f;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + len + 0.02);
}

let noise: AudioBuffer | null = null;
function shaker(ctx: AudioContext, out: AudioNode, t: number, vol: number) {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  s.connect(f);
  f.connect(g);
  g.connect(out);
  s.start(t);
  s.stop(t + 0.06);
}

function kick(ctx: AudioContext, out: AudioNode, t: number) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + 0.2);
}

function schedule() {
  const c = audioIfReady();
  if (!c) return;
  const { ctx, music } = c;
  const bpm = mood === 'calm' ? 76 : mood === 'party' ? 124 : 104;
  const sixteenth = 60 / bpm / 4;
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.25) {
    const s = step % 64;
    const bar = Math.floor(s / 16);
    const chord = CHORDS[bar];
    const within = s % 16;
    if (mood === 'calm') {
      if (within % 4 === 0) marimba(ctx, music, hz(chord[(within / 4) % 3] + 12), nextTime, 0.16);
      if (within === 0) bass(ctx, music, hz(chord[0] - 24), nextTime, 1.6);
    } else {
      // marimba arpeggio pattern
      const pat = [0, -1, 1, -1, 2, -1, 1, 2, 0, -1, 1, -1, 2, 1, -1, 2];
      const k = pat[within];
      if (k >= 0 && mood !== 'band') marimba(ctx, music, hz(chord[k] + 12 + (within >= 12 && k === 2 ? 12 : 0)), nextTime, 0.2);
      if (within === 0 || within === 8 || (mood === 'party' && within % 4 === 0)) kick(ctx, music, nextTime);
      if (within % 2 === 0) shaker(ctx, music, nextTime, within % 4 === 2 ? 0.12 : 0.06);
      if (within === 0 || within === 6 || within === 10) bass(ctx, music, hz(chord[0] - 24 + (within === 10 ? 7 : 0)), nextTime, 0.3);
    }
    nextTime += sixteenth;
    step++;
  }
}

export const music = {
  start() {
    if (started) return;
    started = true;
    step = 0;
    nextTime = 0;
    timer = window.setInterval(schedule, 60);
  },
  stop() {
    started = false;
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  },
  setMood(m: Mood) {
    mood = m;
  },
};
