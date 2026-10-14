// Plays Coach Rex's pre-recorded lines. Clips are decoded on demand (and a
// few kept around), routed through the voice bus so the music ducks and the
// coach's jaw can follow the loudness. If a clip is missing or sound is off,
// the line still shows as a caption for about as long as it would take to say.

import { audio, audioIfReady, audioWhenReady, duckMusic } from '../audio/core';
import { SPOKEN_GOAL, clipId, lineText } from './lines';
import { index, pack } from 'virtual:voice-pack';

let bytes: Uint8Array | null = null;

/** The packed clips as bytes, decoded once on first use. */
function packBytes(): Uint8Array {
  if (!bytes) {
    const bin = atob(pack);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

const cache = new Map<string, Promise<AudioBuffer | null>>();
const order: string[] = [];

function load(id: string): Promise<AudioBuffer | null> {
  const hit = cache.get(id);
  if (hit) return hit;
  const range = index[id];
  const c = audio();
  if (!range || !c) return Promise.resolve(null);
  // decodeAudioData takes ownership of its buffer, so hand it a copy
  const buf = packBytes().slice(range[0], range[0] + range[1]).buffer;
  const p = new Promise<AudioBuffer | null>((resolve) => {
    try {
      c.ctx.decodeAudioData(buf, (b) => resolve(b), () => resolve(null));
    } catch {
      resolve(null);
    }
  });
  cache.set(id, p);
  order.push(id);
  while (order.length > 24) {
    const old = order.shift()!;
    cache.delete(old);
  }
  return p;
}

export function hasClip(id: string): boolean {
  return !!index[id];
}

let current: AudioBufferSourceNode | null = null;
let currentDone: (() => void) | null = null;
let speakingUntil = 0;
/** Bumped by every say() and stop(), so a line still loading never talks over a newer one. */
let turn = 0;

/** Roughly how long a line takes to say (for captions when there's no audio). */
export function estimateSeconds(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, words / 2.9 + 0.4);
}

export const voice = {
  /** Warm the cache for lines that are about to be said. */
  prefetch(ids: string[], name: string, goal = SPOKEN_GOAL) {
    if (!audioIfReady()) return;
    for (const id of ids) void load(clipId(id, name, goal));
  },
  stop() {
    turn++;
    if (current) {
      try {
        current.stop();
      } catch {
        /* already stopped */
      }
    }
    current = null;
    speakingUntil = 0;
    currentDone?.();
    currentDone = null;
  },
  speaking(): boolean {
    return performance.now() < speakingUntil;
  },
  /**
   * Start saying a line. Resolves with how long it takes to say (the
   * estimated time when there's no audio, 0 if a newer line took over).
   */
  async say(id: string, name: string, enabled: boolean, goal = SPOKEN_GOAL): Promise<number> {
    this.stop();
    const mine = turn;
    const text = lineText(id, name, goal);
    const est = estimateSeconds(text);
    speakingUntil = performance.now() + est * 1000;
    const c = enabled ? await audioWhenReady() : null;
    const buf = c ? await load(clipId(id, name, goal)) : null;
    if (mine !== turn) return 0;
    if (!c || !buf) return est;
    const src = c.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(c.voice);
    duckMusic(true);
    current = src;
    speakingUntil = performance.now() + buf.duration * 1000;
    const done = new Promise<void>((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        duckMusic(false);
        resolve();
      };
      currentDone = finish;
      src.onended = finish;
      // safety net if onended never fires
      setTimeout(finish, buf.duration * 1000 + 600);
    });
    src.start();
    void done;
    return buf.duration;
  },
};
