// Gentle procedural sounds made with WebAudio oscillators and noise —
// no audio files. Sound starts muted; the audio context is only created
// after a grown-up (or Zef) turns sound on, which is a user gesture.

type Ctx = AudioContext;

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

class Synth {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  enabled = false;
  private lastPlay = new Map<string, number>();

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.ensure();
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
    }
  }

  private ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.55 : 0;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  private ready(): { ctx: Ctx; out: GainNode } | null {
    if (!this.enabled) return null;
    this.ensure();
    if (!this.ctx || !this.master) return null;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return { ctx: this.ctx, out: this.master };
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

  private noise(dur: number, opts: { vol?: number; type?: BiquadFilterType; freq?: number; endFreq?: number; delay?: number; q?: number } = {}) {
    const r = this.ready();
    if (!r || !this.noiseBuf) return;
    const { ctx, out } = r;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'lowpass';
    f.frequency.setValueAtTime(opts.freq ?? 1200, t0);
    if (opts.endFreq) f.frequency.exponentialRampToValueAtTime(opts.endFreq, t0 + dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    const vol = opts.vol ?? 0.15;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
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

  /** Throttle so a flurry of taps doesn't pile up sounds. */
  private gate(name: string, ms: number): boolean {
    const now = performance.now();
    const last = this.lastPlay.get(name) ?? 0;
    if (now - last < ms) return false;
    this.lastPlay.set(name, now);
    return true;
  }

  play(name: SoundName, arg = 0) {
    if (!this.enabled) return;
    if (!this.gate(name + (name === 'chime' || name === 'musicBox' ? arg : ''), name === 'step' ? 180 : 45)) return;
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
      case 'chime':
        this.bell(penta(arg), 1.3, 0.16);
        break;
      case 'sparkle':
        for (let i = 0; i < 4; i++) this.bell(penta(8 + Math.floor(Math.random() * 6)), 0.5, 0.06, i * 0.06);
        break;
      case 'magic':
        for (let i = 0; i < 6; i++) this.bell(penta(3 + i * 2), 0.8, 0.08, i * 0.07);
        break;
      case 'whoosh':
        this.noise(0.6, { vol: 0.14, type: 'bandpass', freq: 300, endFreq: 1600, q: 1.2 });
        break;
      case 'splash':
        this.noise(0.5, { vol: 0.2, type: 'lowpass', freq: 1600, endFreq: 300 });
        for (let i = 0; i < 3; i++) this.tone(500 + Math.random() * 400, 0.06, { vol: 0.06, glide: 1200, delay: 0.1 + i * 0.07 });
        break;
      case 'knock':
        this.tone(150, 0.12, { vol: 0.35, glide: 90 });
        this.noise(0.05, { vol: 0.12, type: 'bandpass', freq: 900 });
        break;
      case 'creak':
        this.tone(95, 0.7, { vol: 0.08, type: 'sawtooth', glide: 140, filter: 500, vibrato: 11 });
        break;
      case 'squeak':
        this.tone(1100, 0.12, { vol: 0.1, glide: 1700 });
        break;
      case 'baa':
        this.tone(330, 0.55, { vol: 0.1, type: 'sawtooth', filter: 1400, vibrato: 7 });
        this.tone(335, 0.55, { vol: 0.06, type: 'square', filter: 900, vibrato: 7.5 });
        break;
      case 'fanfare': {
        const seq = [0, 2, 4, 5];
        seq.forEach((n, i) => this.tone(penta(n), 0.25, { vol: 0.12, type: 'triangle', delay: i * 0.13 }));
        [5, 7, 9].forEach((n) => this.tone(penta(n), 1.2, { vol: 0.08, type: 'triangle', delay: 0.55, attack: 0.03 }));
        break;
      }
      case 'musicBox':
        this.bell(penta(arg) * 2, 0.9, 0.09);
        break;
      case 'whale':
        this.tone(320, 1.6, { vol: 0.14, glide: 170, vibrato: 3, attack: 0.2 });
        this.tone(480, 1.2, { vol: 0.05, glide: 260, vibrato: 3, attack: 0.3, delay: 0.3 });
        break;
      case 'firework':
        this.tone(200, 0.4, { vol: 0.08, glide: 900 });
        this.noise(0.6, { vol: 0.14, type: 'bandpass', freq: 3000, endFreq: 600, delay: 0.35 });
        for (let i = 0; i < 5; i++) this.tone(2000 + Math.random() * 2000, 0.03, { vol: 0.04, delay: 0.45 + i * 0.05 });
        break;
      case 'giggle':
        for (let i = 0; i < 5; i++) this.tone(1300 - i * 90, 0.07, { vol: 0.1, glide: 1500 - i * 90, delay: i * 0.08 });
        break;
      case 'hug':
        [0, 4, 7].forEach((st, i) => this.tone(noteFreq(-9 + st), 3.2, { vol: 0.07, attack: 0.9, type: 'sine', delay: i * 0.12 }));
        [0, 2, 4].forEach((n, i) => this.bell(penta(n), 1.6, 0.05, 1.2 + i * 0.4));
        break;
      case 'step':
        this.noise(0.05, { vol: 0.03, type: 'bandpass', freq: 1500 });
        break;
      case 'bloop':
        this.tone(320 + Math.random() * 60, 0.18, { vol: 0.18, glide: 160 });
        break;
      case 'drum':
        this.tone(120, 0.12, { vol: 0.2, glide: 70 });
        this.noise(0.06, { vol: 0.05, type: 'highpass', freq: 3000 });
        break;
      case 'organ':
        this.tone(penta(arg) / 2, 0.6, { vol: 0.08, type: 'square', filter: 1800, attack: 0.03, vibrato: 5 });
        this.tone(penta(arg), 0.6, { vol: 0.05, type: 'triangle', attack: 0.03 });
        break;
      case 'hoot':
        this.tone(420, 0.25, { vol: 0.12, glide: 380, filter: 900 });
        this.tone(400, 0.35, { vol: 0.12, glide: 340, filter: 900, delay: 0.32 });
        break;
      case 'yawn':
        this.tone(500, 0.8, { vol: 0.06, glide: 250, type: 'triangle', attack: 0.2 });
        break;
      case 'wake':
        this.bell(penta(5), 1.4, 0.14);
        this.bell(penta(7), 1.4, 0.1, 0.12);
        this.bell(penta(10), 1.8, 0.08, 0.24);
        break;
    }
  }
}

export type SoundName =
  | 'tap'
  | 'pop'
  | 'boing'
  | 'chime'
  | 'sparkle'
  | 'magic'
  | 'whoosh'
  | 'splash'
  | 'knock'
  | 'creak'
  | 'squeak'
  | 'baa'
  | 'fanfare'
  | 'musicBox'
  | 'whale'
  | 'firework'
  | 'giggle'
  | 'hug'
  | 'step'
  | 'bloop'
  | 'drum'
  | 'organ'
  | 'hoot'
  | 'yawn'
  | 'wake';

export const sfx = new Synth();
