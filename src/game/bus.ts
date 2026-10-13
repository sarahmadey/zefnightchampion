// Tiny event bus so events can cue effects inside scene components.

type Handler = (...args: never[]) => void;

const handlers = new Map<string, Set<Handler>>();

export type BusEvent =
  /** a dino's foot came down hard (actor, foot) */
  | 'stomp'
  /** a big roar (actor, strength 0..1) */
  | 'roar'
  /** the egg wobbled or cracked (stage) */
  | 'egg'
  /** the chest at the end of the land opened */
  | 'chest'
  /** a star flew to the board (space index) */
  | 'star'
  /** the high five landed */
  | 'slap';

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
