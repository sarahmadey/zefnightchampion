// Pure progress logic: local morning dates, streaks and gaps.
//
// A record is keyed by the *local date of the morning* after the night
// (YYYY-MM-DD). At most one result is stored per morning. A streak counts
// adjacent calendar mornings that were all recorded dry; a morning with no
// record is "unknown" — it is never treated as dry or wet, but it does mean
// the dry nights on either side of it are not consecutive.

export type NightResult = 'dry' | 'wet';
export type DateKey = string;
export type Records = Record<DateKey, NightResult>;

export const STOP_COUNT = 15;

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateKey(key: unknown): key is DateKey {
  if (typeof key !== 'string') return false;
  const m = KEY_RE.exec(key);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 2000 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar date of `d` as a key. */
export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

function parts(key: DateKey): [number, number, number] {
  const m = KEY_RE.exec(key);
  if (!m) throw new Error(`Bad date key: ${key}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Day number that is immune to DST and time zones. */
function dayNumber(key: DateKey): number {
  const [y, m, d] = parts(key);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function addDays(key: DateKey, n: number): DateKey {
  const [y, m, d] = parts(key);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** b - a in whole days. */
export function daysBetween(a: DateKey, b: DateKey): number {
  return dayNumber(b) - dayNumber(a);
}

export function compareKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A Date at local noon for display purposes. */
export function keyToLocalDate(key: DateKey): Date {
  const [y, m, d] = parts(key);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function sortedKeys(records: Records): DateKey[] {
  return Object.keys(records).filter(isValidDateKey).sort(compareKeys);
}

export interface StreakInfo {
  /** Consecutive dry mornings ending at the latest record (0 when it is wet). */
  streak: number;
  /** Journey position, 0 = cottage, 15 = castle. */
  activeStop: number;
  latest: { date: DateKey; result: NightResult } | null;
  runStart: DateKey | null;
  runEnd: DateKey | null;
  /** Why the current run began: a wet night, an unknown night, or the very first record. */
  runBrokenBy: { date: DateKey; reason: 'wet' | 'unknown' } | null;
}

export function computeStreak(records: Records): StreakInfo {
  const keys = sortedKeys(records);
  if (keys.length === 0) {
    return { streak: 0, activeStop: 0, latest: null, runStart: null, runEnd: null, runBrokenBy: null };
  }
  const lastKey = keys[keys.length - 1];
  const latest = { date: lastKey, result: records[lastKey] };
  if (latest.result === 'wet') {
    return {
      streak: 0,
      activeStop: 0,
      latest,
      runStart: null,
      runEnd: null,
      runBrokenBy: { date: lastKey, reason: 'wet' },
    };
  }
  let streak = 1;
  let cursor = lastKey;
  let runBrokenBy: StreakInfo['runBrokenBy'] = null;
  for (;;) {
    const prev = addDays(cursor, -1);
    const r = records[prev];
    if (r === 'dry') {
      streak += 1;
      cursor = prev;
      continue;
    }
    if (r === 'wet') runBrokenBy = { date: prev, reason: 'wet' };
    else if (keys[0] < prev) runBrokenBy = { date: prev, reason: 'unknown' };
    break;
  }
  return {
    streak,
    activeStop: Math.min(streak, STOP_COUNT),
    latest,
    runStart: cursor,
    runEnd: lastKey,
    runBrokenBy,
  };
}

/** Unrecorded mornings strictly between the latest record and `today`. */
export function missingSinceLatest(records: Records, today: DateKey): DateKey[] {
  const keys = sortedKeys(records);
  if (keys.length === 0) return [];
  const last = keys[keys.length - 1];
  const out: DateKey[] = [];
  const span = daysBetween(last, today);
  // Cap the list so a long break doesn't produce hundreds of rows.
  for (let i = 1; i < span && out.length < 60; i++) out.push(addDays(last, i));
  return out;
}

/** Unrecorded mornings between the first and last record (holes in the history). */
export function holesInHistory(records: Records): DateKey[] {
  const keys = sortedKeys(records);
  if (keys.length < 2) return [];
  const out: DateKey[] = [];
  const span = daysBetween(keys[0], keys[keys.length - 1]);
  for (let i = 1; i < span && out.length < 400; i++) {
    const k = addDays(keys[0], i);
    if (!records[k]) out.push(k);
  }
  return out;
}

/** What streak would result if `date` were recorded as `result` (used for parent previews). */
export function streakIfRecorded(records: Records, date: DateKey, result: NightResult | null): StreakInfo {
  const next: Records = { ...records };
  if (result) next[date] = result;
  else delete next[date];
  return computeStreak(next);
}

export function formatKeyLong(key: DateKey, locale?: string): string {
  return keyToLocalDate(key).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatKeyShort(key: DateKey, locale?: string): string {
  return keyToLocalDate(key).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
