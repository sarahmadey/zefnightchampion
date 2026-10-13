// Zustand stores: the persisted save and the transient game/UI state.

import { create } from 'zustand';
import {
  applyDerived,
  loadSave,
  newAdventure,
  persistSave,
  withRecord,
  type SaveData,
  type Seen,
  type Settings,
} from './save';
import { computeStreak, STOP_COUNT, type DateKey, type NightResult } from './progress';

interface SaveStore {
  data: SaveData;
  storageOk: boolean;
  record: (date: DateKey, result: NightResult | null) => void;
  setSettings: (patch: Partial<Settings>) => void;
  markSeen: (patch: Partial<Seen>) => void;
  replace: (data: SaveData) => void;
  startNewAdventure: () => void;
}

function commit(data: SaveData): boolean {
  return persistSave(data);
}

export const useSave = create<SaveStore>((set, get) => ({
  data: loadSave(),
  storageOk: true,
  record(date, result) {
    const prev = get().data;
    const next = withRecord(prev, date, result);
    if (next === prev) return;
    set({ data: next, storageOk: commit(next) });
  },
  setSettings(patch) {
    const next = { ...get().data, settings: { ...get().data.settings, ...patch } };
    set({ data: next, storageOk: commit(next) });
  },
  markSeen(patch) {
    const next = { ...get().data, seen: { ...get().data.seen, ...patch } };
    set({ data: next, storageOk: commit(next) });
  },
  replace(data) {
    const next = applyDerived(data);
    set({ data: next, storageOk: commit(next) });
  },
  startNewAdventure() {
    const next = newAdventure(get().data);
    set({ data: next, storageOk: commit(next) });
  },
}));

export type SceneId = 'world' | 'castle' | 'hug';
export type Room = 'hall' | 'garden';

export interface PreviewState {
  kind: 'stop' | 'hug';
  stop: number;
}

interface GameStore {
  scene: SceneId;
  room: Room;
  preview: PreviewState | null;
  /** name of the running cutscene, null while Zef is free to play */
  cutscene: string | null;
  /** stop Zef is standing at with the camera framing it */
  focusStop: number | null;
  /** keepsake shelf is being looked at */
  shelfFocus: boolean;
  parentOpen: boolean;
  hugCaption: boolean;
  /** 0 = clear, 1 = covered (scene transitions) */
  fade: number;
  /** stop whose interaction hint should show */
  hintStop: number | null;
  /** increments to ask the director to re-check progress */
  checkToken: number;
  /** path lights currently awake (stops reachable in the world right now) */
  litStop: number;
  /** the 3D scene has built and is ready for cutscenes */
  ready: boolean;
  set: (patch: Partial<Omit<GameStore, 'set'>>) => void;
}

export const useGame = create<GameStore>((set) => ({
  scene: 'world',
  room: 'hall',
  preview: null,
  cutscene: null,
  focusStop: null,
  shelfFocus: false,
  parentOpen: false,
  hugCaption: false,
  fade: 0,
  hintStop: null,
  checkToken: 0,
  litStop: 0,
  ready: false,
  set: (patch) => set(patch),
}));

export interface Journey {
  activeStop: number;
  castleUnlocked: boolean;
  keepsakes: Set<number>;
  streak: number;
  isPreview: boolean;
}

export function journeyOf(data: SaveData, preview: PreviewState | null): Journey {
  if (preview) {
    const stop = preview.kind === 'hug' ? 0 : preview.stop;
    const keepsakes = new Set<number>();
    for (let i = 1; i <= Math.max(stop, preview.kind === 'hug' ? 5 : 0); i++) keepsakes.add(i);
    return { activeStop: stop, castleUnlocked: stop >= STOP_COUNT, keepsakes, streak: stop, isPreview: true };
  }
  const info = computeStreak(data.records);
  return {
    activeStop: info.activeStop,
    castleUnlocked: data.castleUnlocked,
    keepsakes: new Set(data.keepsakes),
    streak: info.streak,
    isPreview: false,
  };
}

/** React hook for the journey the child currently sees (real or preview). */
export function useJourney(): Journey {
  const data = useSave((s) => s.data);
  const preview = useGame((s) => s.preview);
  return journeyOf(data, preview);
}

/** Non-reactive read for per-frame code. */
export function currentJourney(): Journey {
  return journeyOf(useSave.getState().data, useGame.getState().preview);
}
