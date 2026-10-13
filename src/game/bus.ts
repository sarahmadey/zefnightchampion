// Tiny event bus so cutscenes can cue effects inside scene components.

type Handler = (...args: never[]) => void;

const handlers = new Map<string, Set<Handler>>();

export type BusEvent =
  | 'lightWake'
  | 'stopWake'
  | 'castleWake'
  | 'castleDoorsOpen'
  | 'sleepyLight'
  | 'interact'
  | 'fireworks'
  | 'balloonGo';

export const bus = {
  on<A extends unknown[]>(evt: BusEvent, fn: (...args: A) => void): () => void {
    let set = handlers.get(evt);
    if (!set) {
      set = new Set();
      handlers.set(evt, set);
    }
    set.add(fn as unknown as Handler);
    return () => set!.delete(fn as unknown as Handler);
  },
  emit(evt: BusEvent, ...args: unknown[]) {
    const set = handlers.get(evt);
    if (!set) return;
    for (const fn of [...set]) (fn as (...a: unknown[]) => void)(...args);
  },
};
