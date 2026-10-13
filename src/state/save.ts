// Saved game data, local persistence, and backup import/export.

import {
  STOP_COUNT,
  computeStreak,
  isValidDateKey,
  todayKey,
  type DateKey,
  type NightResult,
  type Records,
} from './progress';

export const APP_ID = 'zefs-dry-night-quest';
export const STORAGE_KEY = 'zefs-dry-night-quest:v1';
const BACKUP_KEY = 'zefs-dry-night-quest:v1:previous';

export interface Settings {
  sound: boolean;
  reducedMotion: boolean;
}

/** What the child has already been shown, so refreshes never replay or double-advance. */
export interface Seen {
  stop: number;
  hugDate: DateKey | null;
  streak: number;
}

export interface SaveData {
  app: typeof APP_ID;
  version: 1;
  adventureId: string;
  createdAt: string;
  updatedAt: string;
  records: Records;
  keepsakes: number[];
  castleUnlocked: boolean;
  castleUnlockedAt: string | null;
  seen: Seen;
  settings: Settings;
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `adv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function defaultSave(now: Date = new Date()): SaveData {
  const iso = now.toISOString();
  return {
    app: APP_ID,
    version: 1,
    adventureId: newId(),
    createdAt: iso,
    updatedAt: iso,
    records: {},
    keepsakes: [],
    castleUnlocked: false,
    castleUnlockedAt: null,
    seen: { stop: 0, hugDate: null, streak: 0 },
    settings: { sound: false, reducedMotion: prefersReducedMotion() },
  };
}

function cleanRecords(input: unknown, today: DateKey): { records: Records; dropped: number } {
  const records: Records = {};
  let dropped = 0;
  if (!input || typeof input !== 'object') return { records, dropped };
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (isValidDateKey(k) && (v === 'dry' || v === 'wet') && k <= today) records[k] = v;
    else dropped += 1;
  }
  return { records, dropped };
}

function cleanKeepsakes(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<number>();
  for (const v of input) {
    if (Number.isInteger(v) && v >= 1 && v <= STOP_COUNT) set.add(v);
  }
  return [...set].sort((a, b) => a - b);
}

/** Recompute everything that follows from the records: keepsakes and the castle. */
export function applyDerived(data: SaveData, now: Date = new Date()): SaveData {
  const info = computeStreak(data.records);
  const keep = new Set(data.keepsakes);
  for (let i = 1; i <= info.activeStop; i++) keep.add(i);
  const keepsakes = [...keep].sort((a, b) => a - b);
  const reachedCastle = info.activeStop >= STOP_COUNT;
  return {
    ...data,
    keepsakes,
    castleUnlocked: data.castleUnlocked || reachedCastle,
    castleUnlockedAt: data.castleUnlockedAt ?? (reachedCastle ? now.toISOString() : null),
  };
}

/** Normalise anything that looks like save data. Returns null when it clearly isn't ours. */
export function normalizeSave(raw: unknown, now: Date = new Date()): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.app !== undefined && r.app !== APP_ID) return null;
  if (r.version !== undefined && r.version !== 1) return null;
  if (!('records' in r)) return null;
  const base = defaultSave(now);
  const { records } = cleanRecords(r.records, todayKey(now));
  const seenRaw = (r.seen ?? {}) as Record<string, unknown>;
  const settingsRaw = (r.settings ?? {}) as Record<string, unknown>;
  const data: SaveData = {
    ...base,
    adventureId: typeof r.adventureId === 'string' && r.adventureId ? r.adventureId : base.adventureId,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : base.createdAt,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : base.updatedAt,
    records,
    keepsakes: cleanKeepsakes(r.keepsakes),
    castleUnlocked: r.castleUnlocked === true,
    castleUnlockedAt: typeof r.castleUnlockedAt === 'string' ? r.castleUnlockedAt : null,
    seen: {
      stop: Number.isInteger(seenRaw.stop) ? Math.max(0, Math.min(STOP_COUNT, seenRaw.stop as number)) : 0,
      hugDate: isValidDateKey(seenRaw.hugDate) ? (seenRaw.hugDate as string) : null,
      streak: Number.isInteger(seenRaw.streak) ? Math.max(0, seenRaw.streak as number) : 0,
    },
    settings: {
      sound: settingsRaw.sound === true,
      reducedMotion:
        typeof settingsRaw.reducedMotion === 'boolean' ? settingsRaw.reducedMotion : base.settings.reducedMotion,
    },
  };
  return applyDerived(data, now);
}

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSave(now: Date = new Date()): SaveData {
  const s = storage();
  if (!s) return defaultSave(now);
  for (const key of [STORAGE_KEY, BACKUP_KEY]) {
    try {
      const text = s.getItem(key);
      if (!text) continue;
      const data = normalizeSave(JSON.parse(text), now);
      if (data) return data;
    } catch {
      /* try the next copy */
    }
  }
  return defaultSave(now);
}

export function persistSave(data: SaveData): boolean {
  const s = storage();
  if (!s) return false;
  try {
    const prev = s.getItem(STORAGE_KEY);
    if (prev) s.setItem(BACKUP_KEY, prev);
    s.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Set (or clear, with null) the result for one morning. Idempotent per date. */
export function withRecord(
  data: SaveData,
  date: DateKey,
  result: NightResult | null,
  now: Date = new Date(),
): SaveData {
  if (!isValidDateKey(date)) throw new Error('Invalid date');
  if (date > todayKey(now)) throw new Error('Cannot record a future morning');
  const current = data.records[date] ?? null;
  if (current === result) return data;
  const records: Records = { ...data.records };
  if (result) records[date] = result;
  else delete records[date];
  return applyDerived({ ...data, records, updatedAt: now.toISOString() }, now);
}

/** Mark the current state as already shown (used after imports so nothing replays). */
export function seenFromRecords(data: SaveData): Seen {
  const info = computeStreak(data.records);
  return {
    stop: info.activeStop,
    hugDate: info.latest && info.latest.result === 'wet' ? info.latest.date : data.seen.hugDate,
    streak: info.streak,
  };
}

export function newAdventure(data: SaveData, now: Date = new Date()): SaveData {
  const fresh = defaultSave(now);
  return { ...fresh, settings: data.settings };
}

export function exportBackup(data: SaveData, now: Date = new Date()): string {
  const { settings: _settings, ...rest } = data;
  void _settings;
  return JSON.stringify({ ...rest, exportedAt: now.toISOString() }, null, 2);
}

export type ImportResult =
  | { ok: true; data: SaveData; recordCount: number; dropped: number }
  | { ok: false; error: string };

export function parseBackup(text: string, current: SaveData, now: Date = new Date()): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't a readable backup (it isn't valid JSON)." };
  }
  if (!raw || typeof raw !== 'object' || (raw as Record<string, unknown>).app !== APP_ID) {
    return { ok: false, error: "That file doesn't look like a Zef's Dry Night Quest backup." };
  }
  const { dropped } = cleanRecords((raw as Record<string, unknown>).records, todayKey(now));
  const normalized = normalizeSave(raw, now);
  if (!normalized) return { ok: false, error: 'That backup is from an unknown version.' };
  const data: SaveData = { ...normalized, settings: current.settings };
  data.seen = seenFromRecords(data);
  return { ok: true, data, recordCount: Object.keys(data.records).length, dropped };
}
