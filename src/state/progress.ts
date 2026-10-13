// Pure progress logic: local morning dates, stars, the underpants meter and
// prizes.
//
// A record is keyed by the *local date of the morning* after the night
// (YYYY-MM-DD), at most one per morning.
//
// - Every dry morning is a star. Stars never go away: the board only ever
//   moves forward.
// - The underpants meter counts dry mornings since the most recent wet one.
//   A wet morning starts it fresh. A morning with no record is unknown: it
//   neither adds to the meter nor resets it.
// - Prizes come from total stars: the first at `firstPrize` stars, then one
//   every `prizeEvery` stars after that (10, 25, 40, ... by default).

export type NightResult = 'dry' | 'wet';
export type DateKey = string;
export type Records = Record<DateKey, NightResult>;

export interface QuestRules {
  /** Dry nights in a row that earn underpants. */
  goal: number;
  /** Stars for the first prize. */
  firstPrize: number;
  /** Stars between later prizes. */
  prizeEvery: number;
}

export const DEFAULT_RULES: QuestRules = { goal: 20, firstPrize: 10, prizeEvery: 15 };
export const GOAL_MIN = 3;
export const GOAL_MAX = 60;

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

// ---------------------------------------------------------------- prizes

/** Stars needed for prize number `i` (0-based). */
export function prizeThreshold(i: number, rules: QuestRules = DEFAULT_RULES): number {
  return rules.firstPrize + i * rules.prizeEvery;
}

/** How many prizes `stars` stars have earned. */
export function prizesEarned(stars: number, rules: QuestRules = DEFAULT_RULES): number {
  if (stars < rules.firstPrize) return 0;
  return 1 + Math.floor((stars - rules.firstPrize) / rules.prizeEvery);
}

/**
 * The board is split into lands, each ending at a prize chest. Land 0 holds
 * spaces 1..firstPrize; land i holds the spaces after prize i-1 up to prize i.
 * `start` is the space the land begins from (0 = the nest).
 */
export function landRange(land: number, rules: QuestRules = DEFAULT_RULES): { start: number; end: number } {
  if (land <= 0) return { start: 0, end: rules.firstPrize };
  return { start: prizeThreshold(land - 1, rules), end: prizeThreshold(land, rules) };
}

/** The land that board position `stars` is shown in (a finished land moves on to the next). */
export function landOf(stars: number, rules: QuestRules = DEFAULT_RULES): number {
  return prizesEarned(stars, rules);
}

// ---------------------------------------------------------------- quest

export interface QuestState {
  /** Every dry morning ever recorded. */
  stars: number;
  wets: number;
  /** Dry mornings since the latest wet one (unknown mornings pause it). */
  meter: number;
  /** Longest meter run ever. */
  best: number;
  latest: { date: DateKey; result: NightResult } | null;
  lastWet: DateKey | null;
  /** First morning the meter reached the goal, if it ever has. */
  goalReachedOn: DateKey | null;
  prizes: number;
  nextPrizeAt: number;
}

export function computeQuest(records: Records, rules: QuestRules = DEFAULT_RULES): QuestState {
  let stars = 0;
  let wets = 0;
  let run = 0;
  let best = 0;
  let lastWet: DateKey | null = null;
  let goalReachedOn: DateKey | null = null;
  const keys = sortedKeys(records);
  for (const k of keys) {
    if (records[k] === 'dry') {
      stars++;
      run++;
      if (run > best) best = run;
      if (run >= rules.goal && !goalReachedOn) goalReachedOn = k;
    } else {
      wets++;
      run = 0;
      lastWet = k;
    }
  }
  const last = keys[keys.length - 1];
  const prizes = prizesEarned(stars, rules);
  return {
    stars,
    wets,
    meter: run,
    best,
    latest: last ? { date: last, result: records[last] } : null,
    lastWet,
    goalReachedOn,
    prizes,
    nextPrizeAt: prizeThreshold(prizes, rules),
  };
}

/** What the quest would look like if `date` were recorded as `result` (parent previews). */
export function questIfRecorded(
  records: Records,
  date: DateKey,
  result: NightResult | null,
  rules: QuestRules = DEFAULT_RULES,
): QuestState {
  const next: Records = { ...records };
  if (result) next[date] = result;
  else delete next[date];
  return computeQuest(next, rules);
}

/** Recorded mornings in the `days` mornings ending today, for the grown-ups' stats. */
export function recentRate(records: Records, today: DateKey, days = 14): { dry: number; wet: number; unknown: number } {
  let dry = 0;
  let wet = 0;
  let unknown = 0;
  for (let i = 0; i < days; i++) {
    const r = records[addDays(today, -i)];
    if (r === 'dry') dry++;
    else if (r === 'wet') wet++;
    else unknown++;
  }
  return { dry, wet, unknown };
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
