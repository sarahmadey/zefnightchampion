import { describe, expect, it } from 'vitest';
import {
  addDays,
  computeStreak,
  daysBetween,
  holesInHistory,
  isValidDateKey,
  missingSinceLatest,
  type Records,
} from '../src/state/progress';
import {
  applyDerived,
  defaultSave,
  exportBackup,
  newAdventure,
  normalizeSave,
  parseBackup,
  withRecord,
} from '../src/state/save';

const NOW = new Date(2026, 9, 13, 8, 0, 0); // Oct 13 2026, local morning

function dryRun(end: string, n: number): Records {
  const r: Records = {};
  for (let i = 0; i < n; i++) r[addDays(end, -i)] = 'dry';
  return r;
}

describe('date keys', () => {
  it('validates real calendar dates only', () => {
    expect(isValidDateKey('2026-10-13')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('20261013')).toBe(false);
    expect(isValidDateKey(42)).toBe(false);
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09'); // US DST start
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02'); // US DST end
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(daysBetween('2026-10-01', '2026-10-13')).toBe(12);
  });
});

describe('streaks', () => {
  it('is zero with no records', () => {
    const s = computeStreak({});
    expect(s.streak).toBe(0);
    expect(s.activeStop).toBe(0);
    expect(s.latest).toBeNull();
  });

  it('counts adjacent dry mornings ending at the latest record', () => {
    const s = computeStreak(dryRun('2026-10-13', 7));
    expect(s.streak).toBe(7);
    expect(s.activeStop).toBe(7);
    expect(s.runStart).toBe('2026-10-07');
  });

  it('caps the journey at 15 stops while the streak keeps counting', () => {
    const s = computeStreak(dryRun('2026-10-13', 20));
    expect(s.streak).toBe(20);
    expect(s.activeStop).toBe(15);
  });

  it('a wet latest morning resets the active journey', () => {
    const r = dryRun('2026-10-12', 5);
    r['2026-10-13'] = 'wet';
    const s = computeStreak(r);
    expect(s.streak).toBe(0);
    expect(s.activeStop).toBe(0);
    expect(s.runBrokenBy).toEqual({ date: '2026-10-13', reason: 'wet' });
  });

  it('dry nights after a wet one start a fresh run', () => {
    const r: Records = { '2026-10-10': 'dry', '2026-10-11': 'wet', '2026-10-12': 'dry', '2026-10-13': 'dry' };
    const s = computeStreak(r);
    expect(s.streak).toBe(2);
    expect(s.runBrokenBy).toEqual({ date: '2026-10-11', reason: 'wet' });
  });

  it('never treats an unrecorded night as dry: a gap ends the run', () => {
    const r: Records = { '2026-10-09': 'dry', '2026-10-10': 'dry', '2026-10-12': 'dry', '2026-10-13': 'dry' };
    const s = computeStreak(r);
    expect(s.streak).toBe(2);
    expect(s.runBrokenBy).toEqual({ date: '2026-10-11', reason: 'unknown' });
  });

  it('never treats an unrecorded night as wet: no record after the latest keeps the run', () => {
    const r = dryRun('2026-10-10', 4);
    const s = computeStreak(r);
    expect(s.streak).toBe(4);
    expect(missingSinceLatest(r, '2026-10-13')).toEqual(['2026-10-11', '2026-10-12']);
  });

  it('recalculates after a correction fills a gap', () => {
    const r: Records = { '2026-10-09': 'dry', '2026-10-10': 'dry', '2026-10-12': 'dry', '2026-10-13': 'dry' };
    expect(computeStreak(r).streak).toBe(2);
    expect(computeStreak({ ...r, '2026-10-11': 'dry' }).streak).toBe(5);
    expect(computeStreak({ ...r, '2026-10-11': 'wet' }).streak).toBe(2);
    expect(holesInHistory(r)).toEqual(['2026-10-11']);
  });
});

describe('save data', () => {
  it('stores at most one result per morning and repeat taps do not advance', () => {
    let d = defaultSave(NOW);
    d = withRecord(d, '2026-10-13', 'dry', NOW);
    const again = withRecord(d, '2026-10-13', 'dry', NOW);
    expect(again).toBe(d);
    expect(Object.keys(again.records)).toEqual(['2026-10-13']);
    expect(computeStreak(again.records).streak).toBe(1);
  });

  it('rejects future mornings', () => {
    const d = defaultSave(NOW);
    expect(() => withRecord(d, '2026-10-14', 'dry', NOW)).toThrow();
  });

  it('adds keepsakes as stops are reached and keeps them after a wet night', () => {
    let d = defaultSave(NOW);
    for (let i = 4; i >= 0; i--) d = withRecord(d, addDays('2026-10-12', -i), 'dry', NOW);
    expect(d.keepsakes).toEqual([1, 2, 3, 4, 5]);
    d = withRecord(d, '2026-10-13', 'wet', NOW);
    expect(computeStreak(d.records).activeStop).toBe(0);
    expect(d.keepsakes).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps the castle unlocked once earned, even after corrections', () => {
    let d = defaultSave(NOW);
    d = { ...d, records: dryRun('2026-10-13', 15) };
    d = applyDerived(d, NOW);
    expect(d.castleUnlocked).toBe(true);
    d = withRecord(d, '2026-10-05', 'wet', NOW);
    expect(computeStreak(d.records).activeStop).toBe(8);
    expect(d.castleUnlocked).toBe(true);
    expect(d.keepsakes.length).toBe(15);
  });

  it('a new adventure clears progress but keeps settings', () => {
    let d = defaultSave(NOW);
    d = { ...applyDerived({ ...d, records: dryRun('2026-10-13', 15) }, NOW), settings: { sound: true, reducedMotion: true } };
    const fresh = newAdventure(d, NOW);
    expect(fresh.records).toEqual({});
    expect(fresh.castleUnlocked).toBe(false);
    expect(fresh.keepsakes).toEqual([]);
    expect(fresh.settings).toEqual({ sound: true, reducedMotion: true });
    expect(fresh.adventureId).not.toBe(d.adventureId);
  });

  it('round-trips a backup and does not replay events after import', () => {
    let d = defaultSave(NOW);
    d = applyDerived({ ...d, records: dryRun('2026-10-12', 6) }, NOW);
    d = withRecord(d, '2026-10-13', 'wet', NOW);
    const text = exportBackup(d, NOW);
    const res = parseBackup(text, defaultSave(NOW), NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.records).toEqual(d.records);
    expect(res.data.keepsakes).toEqual([1, 2, 3, 4, 5, 6]);
    expect(res.data.seen).toEqual({ stop: 0, hugDate: '2026-10-13', streak: 0 });
  });

  it('rejects files that are not backups', () => {
    expect(parseBackup('not json', defaultSave(NOW), NOW).ok).toBe(false);
    expect(parseBackup('{"hello":1}', defaultSave(NOW), NOW).ok).toBe(false);
  });

  it('drops malformed entries when normalising', () => {
    const d = normalizeSave(
      {
        app: 'zefs-dry-night-quest',
        version: 1,
        records: { '2026-10-12': 'dry', bad: 'dry', '2026-10-11': 'maybe', '2030-01-01': 'dry' },
        keepsakes: [1, 1, 99, 'x'],
      },
      NOW,
    );
    expect(d?.records).toEqual({ '2026-10-12': 'dry' });
    expect(d?.keepsakes).toEqual([1]);
  });
});
