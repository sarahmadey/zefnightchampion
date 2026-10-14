// Zustand stores: the persisted save and the transient game/UI state.

import { create } from 'zustand';
import {
  applyDerived,
  clampGoal,
  loadSave,
  newQuest,
  persistSave,
  seenFromRecords,
  startOver,
  withRecord,
  type Profile,
  type SaveData,
  type Seen,
  type Settings,
} from './save';
import { computeQuest, type DateKey, type NightResult, type QuestState } from './progress';
import type { Prize, Slot } from '../game/rewards';

interface SaveStore {
  data: SaveData;
  storageOk: boolean;
  record: (date: DateKey, result: NightResult | null) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setProfile: (patch: Partial<Profile>) => void;
  setGoal: (goal: number) => void;
  setPrizes: (prizes: Prize[]) => void;
  setPrizeGiven: (i: number, given: boolean) => void;
  setOutfit: (slot: Slot, accessory: number) => void;
  pickUnderpants: (design: number) => void;
  undoUnderpants: () => void;
  markSeen: (patch: Partial<Seen>) => void;
  replace: (data: SaveData) => void;
  startNewQuest: () => void;
  startOver: () => void;
}

function commit(data: SaveData): boolean {
  return persistSave(data);
}

export const useSave = create<SaveStore>((set, get) => {
  const put = (next: SaveData) => set({ data: next, storageOk: commit(next) });
  return {
    data: loadSave(),
    storageOk: true,
    record(date, result) {
      const prev = get().data;
      const next = withRecord(prev, date, result);
      if (next !== prev) put(next);
    },
    setSettings(patch) {
      put({ ...get().data, settings: { ...get().data.settings, ...patch } });
    },
    setProfile(patch) {
      put({ ...get().data, profile: { ...get().data.profile, ...patch } });
    },
    setGoal(goal) {
      const d = get().data;
      put(applyDerived({ ...d, rules: { ...d.rules, goal: clampGoal(goal) } }));
    },
    setPrizes(prizes) {
      put({ ...get().data, prizes });
    },
    setPrizeGiven(i, given) {
      const d = get().data;
      const s = new Set(d.prizesGiven);
      if (given) s.add(i);
      else s.delete(i);
      put({ ...d, prizesGiven: [...s].sort((a, b) => a - b) });
    },
    setOutfit(slot, accessory) {
      const d = get().data;
      put({ ...d, outfit: { ...d.outfit, [slot]: accessory } });
    },
    pickUnderpants(design) {
      const d = get().data;
      put({ ...d, underpants: { ...d.underpants, pick: design } });
    },
    undoUnderpants() {
      const d = get().data;
      const next = applyDerived({ ...d, underpants: { earned: false, on: null, pick: null } });
      put({ ...next, seen: { ...next.seen, underpants: next.underpants.earned } });
    },
    markSeen(patch) {
      put({ ...get().data, seen: { ...get().data.seen, ...patch } });
    },
    replace(data) {
      put(applyDerived(data));
    },
    startNewQuest() {
      const next = newQuest(get().data);
      put({ ...next, seen: seenFromRecords(next) });
    },
    startOver() {
      put(startOver(get().data));
    },
  };
});

/** What the morning screen and the 3D board are showing. */
export type Phase =
  | 'boot'
  | 'setup' // first-time: name, pick a dino, the mission
  | 'splash' // tap the egg to start (unlocks sound)
  | 'ask' // the two big buttons
  | 'event' // a celebration, hug, prize or store visit is playing
  | 'done'; // today is recorded: see you tomorrow

export type PreviewKind = 'dry' | 'wet' | 'prize' | 'store' | 'intro';

export interface PreviewState {
  kind: PreviewKind;
  /** the child's own "Watch it again", not a grown-up's preview */
  replay?: boolean;
}

/** A line of text shown while the coach talks (also read to screen readers). */
export interface Caption {
  text: string;
  who: 'coach' | 'zef';
}

export type SceneId = 'board' | 'store' | 'setup';
export type SetupStep = 'name' | 'dino' | 'color';

interface GameStore {
  phase: Phase;
  scene: SceneId;
  setupStep: SetupStep | null;
  /** accessories the board shows as unlocked (the egg reveals the newest) */
  shownAccessories: number;
  /** chests the board shows as opened */
  openedChests: number;
  /** the dino wears its store underpants */
  showUnderpants: boolean;
  /** underwear picked during a preview (never saved) */
  previewUnderpants: number | null;
  /** the overlay piece Coach Rex is talking about */
  highlight: 'meter' | 'stars' | null;
  preview: PreviewState | null;
  /** name of the running event, null when idle */
  cutscene: string | null;
  parentOpen: boolean;
  caption: Caption | null;
  /** 0 = clear, 1 = covered (scene transitions) */
  fade: number;
  /** the 3D scene has built */
  ready: boolean;
  /** the board land in view */
  land: number;
  /** star count the board shows (animates up during a celebration) */
  shownStars: number;
  /** meter value the overlay shows (animates during events) */
  shownMeter: number;
  /** the store scene is showing instead of the board */
  inStore: boolean;
  /** dress-up shelf is open */
  dressUp: boolean;
  /** waiting for the child to tap something during an event */
  awaiting: null | 'highfive' | 'egg' | 'collect' | 'roar' | 'chest' | 'store-pick' | 'hug-done';
  /** increments to ask the director to re-check progress */
  checkToken: number;
  set: (patch: Partial<Omit<GameStore, 'set'>>) => void;
}

export const useGame = create<GameStore>((set) => ({
  phase: 'boot',
  scene: 'board',
  setupStep: null,
  shownAccessories: 0,
  openedChests: 0,
  showUnderpants: true,
  previewUnderpants: null,
  highlight: null,
  preview: null,
  cutscene: null,
  parentOpen: false,
  caption: null,
  fade: 0,
  ready: false,
  land: 0,
  shownStars: 0,
  shownMeter: 0,
  inStore: false,
  dressUp: false,
  awaiting: null,
  checkToken: 0,
  set: (patch) => set(patch),
}));

export function questOf(data: SaveData): QuestState {
  return computeQuest(data.records, data.rules);
}

/** React hook for the quest numbers. */
export function useQuest(): QuestState {
  const records = useSave((s) => s.data.records);
  const rules = useSave((s) => s.data.rules);
  return computeQuest(records, rules);
}
