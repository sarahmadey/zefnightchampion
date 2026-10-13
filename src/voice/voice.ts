// Plays Coach Rex's pre-recorded lines. Clips are decoded on demand (and a
// few kept around), routed through the voice bus so the music ducks and the
// coach's jaw can follow the loudness. If a clip is missing or sound is off,
// the line still shows as a caption for about as long as it would take to say.

import { audio, audioIfReady, duckMusic } from '../audio/core';
import { clipId, lineText } from './lines';

const clipUrls = import.meta.glob('./clips/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function urlFor(id: string): string | null {
  return clipUrls[`./clips/${id}.mp3`] ?? null;
}

const cache = new Map<string, Promise<AudioBuffer | null>>();
const order: string[] = [];

function load(id: string): Promise<AudioBuffer | null> {
  const hit = cache.get(id);
  if (hit) return hit;
  const url = urlFor(id);
  const c = audio();
  if (!url || !c) return Promise.resolve(null);
  const p = fetch(url)
    .then((r) => r.arrayBuffer())
    .then(
      (buf) =>
        new Promise<AudioBuffer | null>((resolve) => {
          c.ctx.decodeAudioData(buf, (b) => resolve(b), () => resolve(null));
        }),
    )
    .catch(() => null);
  cache.set(id, p);
  order.push(id);
  while (order.length > 24) {
    const old = order.shift()!;
    cache.delete(old);
  }
  return p;
}

export function hasClip(id: string): boolean {
  return !!urlFor(id);
}

let current: AudioBufferSourceNode | null = null;
let currentDone: (() => void) | null = null;
let speakingUntil = 0;

/** Roughly how long a line takes to say (for captions when there's no audio). */
export function estimateSeconds(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, words / 2.9 + 0.4);
}

export const voice = {
  /** Warm the cache for lines that are about to be said. */
  prefetch(ids: string[], name: string) {
    if (!audioIfReady()) return;
    for (const id of ids) void load(clipId(id, name));
  },
  stop() {
    if (current) {
      try {
        current.stop();
      } catch {
        /* already stopped */
      }
    }
    current = null;
    currentDone?.();
    currentDone = null;
  },
  speaking(): boolean {
    return performance.now() < speakingUntil;
  },
  /**
   * Say a line. Resolves when it has been said (or after the estimated time
   * when there's no audio). `onStart` fires as the sound begins.
   */
  async say(id: string, name: string, enabled: boolean): Promise<number> {
    this.stop();
    const text = lineText(id, name);
    const est = estimateSeconds(text);
    const c = enabled ? audioIfReady() : null;
    const buf = c ? await load(clipId(id, name)) : null;
    if (!c || !buf) {
      speakingUntil = performance.now() + est * 1000;
      return est;
    }
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
