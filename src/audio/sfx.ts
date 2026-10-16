// Procedural sound effects made with WebAudio oscillators and noise — no
// audio files: cartoon dino roars, stomps, high-five slaps, cracking eggs,
// chests, sparkles and fanfares.

import { audio, audioIfReady } from './core';

const PENTA = [0, 2, 4, 7, 9];

export function noteFreq(semitonesFromA4: number): number {
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

/** Pentatonic note n (0 = C5) as a frequency. */
export function penta(n: number): number {
  const oct = Math.floor(n / 5);
  const idx = ((n % 5) + 5) % 5;
  return noteFreq(3 + PENTA[idx] + oct * 12);
}

let noiseBuf: AudioBuffer | null = null;
let shaper: WaveShaper | null = null;
type WaveShaper = WaveShaperNode;

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    const len = ctx.sampleRate * 1.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function growlCurve(): Float32Array<ArrayBuffer> {
  const n = 1024;
  const c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * 3.2);
  }
  return c;
}

class Synth {
  private lastPlay = new Map<string, number>();

  private ready(): { ctx: AudioContext; out: GainNode } | null {
    const c = audioIfReady() ?? null;
    if (!c) return null;
    return { ctx: c.ctx, out: c.sfx };
  }

  private tone(
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; vol?: number; attack?: number; glide?: number; delay?: number; vibrato?: number; filter?: number } = {},
  ) {
    const r = this.ready();
    if (!r) return;
    const { ctx, out } = r;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.glide), t0 + dur);
    const g = ctx.createGain();
    const vol = opts.vol ?? 0.25;
    const atk = opts.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = osc;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      osc.connect(f);
      node = f;
    }
    if (opts.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = opts.vibrato;
      lg.gain.value = freq * 0.03;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    node.connect(g);
    g.connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, opts: { vol?: number; type?: BiquadFilterType; freq?: number; endFreq?: number; delay?: number; q?: number; attack?: number } = {}) {
    const r = this.ready();
    if (!r) return;
    const { ctx, out } = r;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'lowpass';
    f.frequency.setValueAtTime(opts.freq ?? 1200, t0);
    if (opts.endFreq) f.frequency.exponentialRampToValueAtTime(opts.endFreq, t0 + dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    const vol = opts.vol ?? 0.15;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack ?? 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  private bell(freq: number, dur = 1.2, vol = 0.18, delay = 0) {
    this.tone(freq, dur, { vol, delay, attack: 0.004 });
    this.tone(freq * 2.01, dur * 0.6, { vol: vol * 0.35, delay, attack: 0.004 });
    this.tone(freq * 3.98, dur * 0.3, { vol: vol * 0.12, delay, attack: 0.004 });
  }

  /** A cartoon dino roar. `size` 0 = little dino, 1 = big Coach Rex; `power` grows with each roar. */
  private roar(size: number, power: number) {
    const r = this.ready();
    if (!r) return;
    const { ctx, out } = r;
    const t0 = ctx.currentTime;
    const dur = 0.9 + power * 0.5;
    const base = (1 - size) * 120 + 70;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * 1.3, t0);
    osc.frequency.linearRampToValueAtTime(base * 1.8, t0 + dur * 0.25);
    osc.frequency.exponentialRampToValueAtTime(base * 0.75, t0 + dur);
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(base * 0.66, t0);
    osc2.frequency.linearRampToValueAtTime(base * 0.92, t0 + dur * 0.25);
    osc2.frequency.exponentialRampToValueAtTime(base * 0.4, t0 + dur);
    // growly tremolo
    const trem = ctx.createOscillator();
    trem.frequency.value = 26 + size * 8;
    const tremG = ctx.createGain();
    tremG.gain.value = 0.35;
    const amp = ctx.createGain();
    amp.gain.value = 0.65;
    trem.connect(tremG);
    tremG.connect(amp.gain);
    if (!shaper) {
      shaper = ctx.createWaveShaper();
      shaper.curve = growlCurve();
    }
    const dist = ctx.createWaveShaper();
    dist.curve = shaper.curve;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(500, t0);
    lp.frequency.linearRampToValueAtTime(1500 + power * 900, t0 + dur * 0.3);
    lp.frequency.exponentialRampToValueAtTime(380, t0 + dur);
    const env = ctx.createGain();
    const vol = 0.32 + power * 0.18;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(vol, t0 + 0.08);
    env.gain.setValueAtTime(vol, t0 + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp);
    osc2.connect(amp);
    amp.connect(dist);
    dist.connect(lp);
    lp.connect(env);
    env.connect(out);
    for (const o of [osc, osc2, trem]) {
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
    this.noise(dur * 0.9, { vol: 0.12 + power * 0.08, type: 'bandpass', freq: 700, endFreq: 300, q: 1.5, attack: 0.06 });
  }

  /** Throttle so a flurry of taps doesn't pile up sounds. */
  private gate(name: string, ms: number): boolean {
    const now = performance.now();
    const last = this.lastPlay.get(name) ?? 0;
    if (now - last < ms) return false;
    this.lastPlay.set(name, now);
    return true;
  }

  play(name: SoundName, arg = 0, arg2 = 0) {
    if (!audioIfReady()) {
      // first gesture: make sure the graph exists for next time
      if (name === 'tap') audio();
      return;
    }
    if (!this.gate(name + (name === 'chime' || name === 'tick' ? arg : ''), name === 'step' ? 160 : 45)) return;
    switch (name) {
      case 'tap':
        this.tone(880, 0.09, { vol: 0.12, glide: 660 });
        break;
      case 'pop':
        this.tone(420 + Math.random() * 120, 0.08, { vol: 0.2, glide: 1100 });
        this.noise(0.04, { vol: 0.05, type: 'highpass', freq: 2000 });
        break;
      case 'boing':
        this.tone(200 * (1 + arg * 0.2), 0.42, { vol: 0.22, glide: 520 * (1 + arg * 0.2), vibrato: 9 });
        break;
      case 'hop':
        this.tone(260, 0.22, { vol: 0.18, glide: 620, type: 'triangle' });
        break;
      case 'land':
        this.tone(140, 0.12, { vol: 0.2, glide: 80 });
        this.noise(0.08, { vol: 0.06, type: 'lowpass', freq: 600 });
        break;
      case 'chime':
        this.bell(penta(arg), 1.3, 0.16);
        break;
      case 'tick':
        this.bell(penta(4 + arg), 0.5, 0.12);
        break;
      case 'sparkle':
        for (let i = 0; i < 4; i++) this.bell(penta(8 + Math.floor(Math.random() * 6)), 0.5, 0.06, i * 0.06);
        break;
      case 'magic':
        for (let i = 0; i < 6; i++) this.bell(penta(3 + i * 2), 0.8, 0.08, i * 0.07);
        break;
      case 'star':
        [0, 2, 4, 5, 7].forEach((n, i) => this.bell(penta(5 + n), 0.7, 0.1, i * 0.07));
        break;
      case 'whoosh':
        this.noise(0.6, { vol: 0.14, type: 'bandpass', freq: 300, endFreq: 1600, q: 1.2 });
        break;
      case 'balloon':
        // a rubbery snap
        this.noise(0.07, { vol: 0.32, type: 'highpass', freq: 1400 });
        this.tone(260 + Math.random() * 80, 0.07, { vol: 0.16, glide: 70 });
        break;
      case 'firework':
        // a whistle up, a soft boom, then crackles
        this.tone(700, 0.45, { vol: 0.05, glide: 1500 });
        this.noise(0.55, { vol: 0.24, type: 'lowpass', freq: 420, delay: 0.45 });
        for (let i = 0; i < 6; i++) this.noise(0.04, { vol: 0.07, type: 'highpass', freq: 3000, delay: 0.62 + i * 0.07 + Math.random() * 0.04 });
        break;
      case 'rustle':
        this.noise(0.4, { vol: 0.1, type: 'bandpass', freq: 2600, endFreq: 1600, q: 0.8 });
        break;
      case 'poof':
        this.noise(0.35, { vol: 0.16, type: 'bandpass', freq: 700, endFreq: 220, q: 0.9 });
        break;
      case 'fanfare': {
        const seq = [0, 2, 4, 5];
        seq.forEach((n, i) => this.tone(penta(n + 5) / 2, 0.22, { vol: 0.14, type: 'triangle', delay: i * 0.12 }));
        [5, 7, 9].forEach((n) => this.tone(penta(n + 5) / 2, 1.1, { vol: 0.09, type: 'triangle', delay: 0.5, attack: 0.03 }));
        this.noise(0.5, { vol: 0.05, type: 'highpass', freq: 5000, delay: 0.5 });
        break;
      }
      case 'giggle':
        for (let i = 0; i < 5; i++) this.tone(1300 - i * 90, 0.07, { vol: 0.1, glide: 1500 - i * 90, delay: i * 0.08 });
        break;
      case 'hug':
        [0, 4, 7].forEach((st, i) => this.tone(noteFreq(-9 + st), 3.2, { vol: 0.07, attack: 0.9, type: 'sine', delay: i * 0.12 }));
        [0, 2, 4].forEach((n, i) => this.bell(penta(n), 1.6, 0.05, 1.2 + i * 0.4));
        break;
      case 'step':
        this.noise(0.05, { vol: 0.04, type: 'bandpass', freq: 900 });
        break;
      case 'stomp':
        this.tone(90, 0.3, { vol: 0.4, glide: 38 });
        this.noise(0.25, { vol: 0.12, type: 'lowpass', freq: 500, endFreq: 120 });
        break;
      case 'roar':
        this.roar(arg, arg2);
        break;
      case 'slap':
        this.noise(0.09, { vol: 0.35, type: 'highpass', freq: 1400, attack: 0.002 });
        this.tone(1800, 0.05, { vol: 0.08, glide: 900 });
        for (let i = 0; i < 4; i++) this.bell(penta(9 + i), 0.4, 0.06, 0.08 + i * 0.05);
        break;
      case 'crack':
        this.noise(0.06, { vol: 0.3, type: 'bandpass', freq: 2600 + arg * 400, q: 2, attack: 0.002 });
        this.tone(700 + arg * 150, 0.08, { vol: 0.08, glide: 400, type: 'square', filter: 1800 });
        break;
      case 'hatch':
        this.noise(0.15, { vol: 0.3, type: 'bandpass', freq: 2000, q: 1, attack: 0.002 });
        this.tone(330, 0.3, { vol: 0.2, glide: 990 });
        for (let i = 0; i < 6; i++) this.bell(penta(5 + i), 0.6, 0.08, 0.1 + i * 0.06);
        break;
      case 'chest':
        this.tone(95, 0.6, { vol: 0.1, type: 'sawtooth', glide: 160, filter: 600, vibrato: 11 });
        for (let i = 0; i < 8; i++) this.bell(penta(3 + i), 0.9, 0.09, 0.35 + i * 0.07);
        break;
      case 'drumroll':
        for (let i = 0; i < 18; i++) this.noise(0.06, { vol: 0.06 + i * 0.004, type: 'bandpass', freq: 1800, q: 0.7, delay: i * 0.065, attack: 0.003 });
        break;
      case 'ding':
        this.bell(penta(7), 1.4, 0.14);
        break;
      case 'drop':
        this.tone(520, 0.2, { vol: 0.14, glide: 260 });
        break;
      case 'flap':
        for (let i = 0; i < 4; i++) this.noise(0.12, { vol: 0.12, type: 'lowpass', freq: 500, delay: i * 0.22, attack: 0.04 });
        break;
    }
  }
}

export type SoundName =
  | 'tap'
  | 'pop'
  | 'boing'
  | 'hop'
  | 'land'
  | 'chime'
  | 'tick'
  | 'sparkle'
  | 'magic'
  | 'star'
  | 'whoosh'
  | 'fanfare'
  | 'giggle'
  | 'hug'
  | 'step'
  | 'stomp'
  | 'roar'
  | 'slap'
  | 'crack'
  | 'hatch'
  | 'chest'
  | 'drumroll'
  | 'ding'
  | 'drop'
  | 'flap'
  | 'balloon'
  | 'firework'
  | 'rustle'
  | 'poof';

export const sfx = new Synth();
