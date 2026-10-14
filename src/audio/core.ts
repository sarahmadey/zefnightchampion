// One shared AudioContext with three buses (sound effects, music, voice)
// feeding a gentle compressor. The context is created on the first tap, as
// browsers require. The music ducks while Coach Rex is talking.

export interface AudioCore {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  music: GainNode;
  voice: GainNode;
  analyser: AnalyserNode;
}

let core: AudioCore | null = null;
let soundOn = true;
let musicOn = true;
let duck = 0;

function create(): AudioCore | null {
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    const master = ctx.createGain();
    master.gain.value = soundOn ? 1 : 0;
    master.connect(comp);
    comp.connect(ctx.destination);
    const sfx = ctx.createGain();
    sfx.gain.value = 0.55;
    sfx.connect(master);
    const music = ctx.createGain();
    music.gain.value = musicOn ? 0.22 : 0;
    music.connect(master);
    const voice = ctx.createGain();
    voice.gain.value = 1.0;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    voice.connect(analyser);
    voice.connect(master);
    return { ctx, master, sfx, music, voice, analyser };
  } catch {
    return null;
  }
}

/** The audio graph, creating it if needed (call from a user gesture the first time). */
export function audio(): AudioCore | null {
  if (!core) core = create();
  if (core && core.ctx.state === 'suspended') void core.ctx.resume().catch(() => undefined);
  return core;
}

/** The graph only if it already exists (never creates one outside a gesture). */
export function audioIfReady(): AudioCore | null {
  return core && core.ctx.state === 'running' ? core : null;
}

/**
 * The graph once it's running. Right after the first tap the browser is
 * still waking the sound up, so wait a moment for that instead of skipping
 * whatever was meant to play.
 */
export async function audioWhenReady(timeoutMs = 800): Promise<AudioCore | null> {
  if (!core) return null;
  if (core.ctx.state !== 'running') {
    let timer = 0;
    await Promise.race([
      core.ctx.resume().catch(() => undefined),
      new Promise<void>((resolve) => (timer = window.setTimeout(resolve, timeoutMs))),
    ]);
    clearTimeout(timer);
  }
  return core.ctx.state === 'running' ? core : null;
}

export function unlockAudio() {
  const c = audio();
  if (!c) return;
  // a silent blip unlocks playback on iOS
  try {
    const b = c.ctx.createBuffer(1, 1, 22050);
    const s = c.ctx.createBufferSource();
    s.buffer = b;
    s.connect(c.master);
    s.start(0);
  } catch {
    /* ignore */
  }
}

export function setSoundOn(on: boolean) {
  soundOn = on;
  if (core) core.master.gain.setTargetAtTime(on ? 1 : 0, core.ctx.currentTime, 0.05);
}

export function isSoundOn() {
  return soundOn;
}

function musicLevel() {
  return musicOn ? 0.22 * (duck > 0 ? 0.35 : 1) : 0;
}

export function setMusicOn(on: boolean) {
  musicOn = on;
  if (core) core.music.gain.setTargetAtTime(musicLevel(), core.ctx.currentTime, 0.2);
}

export function isMusicOn() {
  return musicOn;
}

/** Lower the music while someone talks. Calls nest. */
export function duckMusic(on: boolean) {
  duck = Math.max(0, duck + (on ? 1 : -1));
  if (core) core.music.gain.setTargetAtTime(musicLevel(), core.ctx.currentTime, 0.15);
}

const levelBuf = new Float32Array(1024);

/** Loudness of the voice right now (0..1), for Coach Rex's moving jaw. */
export function voiceLevel(): number {
  if (!core) return 0;
  core.analyser.getFloatTimeDomainData(levelBuf);
  let sum = 0;
  for (let i = 0; i < levelBuf.length; i++) sum += levelBuf[i] * levelBuf[i];
  return Math.min(1, Math.sqrt(sum / levelBuf.length) * 5);
}
