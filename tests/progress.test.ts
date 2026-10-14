import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  addDays,
  computeQuest,
  daysBetween,
  isValidDateKey,
  landOf,
  landRange,
  missingSinceLatest,
  prizeThreshold,
  prizesEarned,
  questIfRecorded,
  recentRate,
  type Records,
} from '../src/state/progress';
import {
  APP_ID,
  applyDerived,
  defaultSave,
  exportBackup,
  newQuest,
  normalizeSave,
  parseBackup,
  seenFromRecords,
  startOver,
  withRecord,
} from '../src/state/save';
import {
  ACCESSORIES,
  accessoriesUnlocked,
  accessoryForStar,
  defaultOutfit,
  prizeAt,
  surpriseFor,
  DEFAULT_PRIZES,
} from '../src/game/rewards';

const NOW = new Date(2026, 9, 13, 8, 0, 0); // Oct 13 2026, local morning
const TODAY = '2026-10-13';

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

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });
});

describe('prizes and lands', () => {
  it('gives the first prize at 10 stars, then every 15', () => {
    expect([0, 1, 2, 3].map((i) => prizeThreshold(i))).toEqual([10, 25, 40, 55]);
    expect(prizesEarned(9)).toBe(0);
    expect(prizesEarned(10)).toBe(1);
    expect(prizesEarned(24)).toBe(1);
    expect(prizesEarned(25)).toBe(2);
    expect(prizesEarned(100)).toBe(7);
  });

  it('splits the board into a 10-space land and then 15-space lands', () => {
    expect(landRange(0)).toEqual({ start: 0, end: 10 });
    expect(landRange(1)).toEqual({ start: 10, end: 25 });
    expect(landRange(2)).toEqual({ start: 25, end: 40 });
    expect(landOf(0)).toBe(0);
    expect(landOf(9)).toBe(0);
    // reaching the chest finishes the land and the board moves on
    expect(landOf(10)).toBe(1);
    expect(landOf(26)).toBe(2);
  });

  it('cycles through the prize list', () => {
    expect(prizeAt(DEFAULT_PRIZES, 0).label).toBe('Candy');
    expect(prizeAt(DEFAULT_PRIZES, 2).label).toBe("McDonald's");
    expect(prizeAt(DEFAULT_PRIZES, 5).label).toBe('Pizza party');
    expect(prizeAt(DEFAULT_PRIZES, 6).label).toBe('Candy');
    expect(prizeAt([], 0).label).toBe('Candy');
  });
});

describe('quest', () => {
  it('counts every dry morning as a star and keeps stars after a wet night', () => {
    const r: Records = { ...dryRun('2026-10-05', 5), '2026-10-06': 'wet', ...dryRun('2026-10-09', 3) };
    const q = computeQuest(r);
    expect(q.stars).toBe(8);
    expect(q.wets).toBe(1);
    expect(q.meter).toBe(3);
    expect(q.best).toBe(5);
    expect(q.lastWet).toBe('2026-10-06');
  });

  it('starts the meter fresh on a wet morning', () => {
    const q = computeQuest({ ...dryRun('2026-10-12', 6), [TODAY]: 'wet' });
    expect(q.meter).toBe(0);
    expect(q.stars).toBe(6);
    expect(q.latest).toEqual({ date: TODAY, result: 'wet' });
  });

  it('treats unrecorded mornings as unknown: they neither add nor reset', () => {
    const r: Records = { ...dryRun('2026-10-05', 4), ...dryRun('2026-10-12', 3) };
    const q = computeQuest(r);
    expect(q.meter).toBe(7);
    expect(q.stars).toBe(7);
    expect(missingSinceLatest({ '2026-10-10': 'dry' }, TODAY)).toEqual(['2026-10-11', '2026-10-12']);
  });

  it('reaches the underpants goal after N dry mornings in a row', () => {
    expect(computeQuest(dryRun(TODAY, 19)).goalReachedOn).toBeNull();
    expect(computeQuest(dryRun(TODAY, 20)).goalReachedOn).toBe(TODAY);
    expect(computeQuest(dryRun(TODAY, 5), { ...DEFAULT_RULES, goal: 5 }).goalReachedOn).toBe(TODAY);
  });

  it('previews a correction without changing the records', () => {
    const r = dryRun('2026-10-12', 3);
    expect(questIfRecorded(r, TODAY, 'wet').meter).toBe(0);
    expect(questIfRecorded(r, '2026-10-12', null).stars).toBe(2);
    expect(Object.keys(r)).toHaveLength(3);
  });

  it('summarises the last two weeks for grown-ups', () => {
    const r: Records = { ...dryRun(TODAY, 10), '2026-10-02': 'wet' };
    expect(recentRate(r, TODAY, 14)).toEqual({ dry: 10, wet: 1, unknown: 3 });
  });
});

describe('surprises and accessories', () => {
  it('hatches an egg on odd stars until every accessory is out', () => {
    expect(surpriseFor(1)).toBe('egg');
    expect(surpriseFor(2)).toBe('highfive');
    expect(surpriseFor(3)).toBe('egg');
    expect(surpriseFor(4)).toBe('dance');
    expect(surpriseFor(6)).toBe('roar');
    expect(surpriseFor(8)).toBe('highfive');
    expect(accessoryForStar(1)).toBe(0);
    expect(accessoryForStar(5)).toBe(2);
    expect(accessoryForStar(4)).toBeNull();
    const last = ACCESSORIES.length * 2;
    expect(accessoryForStar(last - 1)).toBe(ACCESSORIES.length - 1);
    expect(surpriseFor(last + 1)).not.toBe('egg');
  });

  it('unlocks accessories in order and dresses the dino in the newest per slot', () => {
    expect(accessoriesUnlocked(0)).toBe(0);
    expect(accessoriesUnlocked(1)).toBe(1);
    expect(accessoriesUnlocked(2)).toBe(1);
    expect(accessoriesUnlocked(1000)).toBe(ACCESSORIES.length);
    const outfit = defaultOutfit(5);
    expect(outfit.head).toBe(4); // party hat replaced the cap
    expect(outfit.face).toBe(1);
  });
});

describe('save data', () => {
  it('starts with sound on and setup to do', () => {
    const d = defaultSave(NOW);
    expect(d.settings.sound).toBe(true);
    expect(d.profile.setupDone).toBe(false);
    expect(d.rules.goal).toBe(20);
  });

  it('records idempotently, one result per morning, never in the future', () => {
    const d = defaultSave(NOW);
    const a = withRecord(d, TODAY, 'dry', NOW);
    expect(withRecord(a, TODAY, 'dry', NOW)).toBe(a);
    const b = withRecord(a, TODAY, 'wet', NOW);
    expect(Object.keys(b.records)).toEqual([TODAY]);
    expect(b.records[TODAY]).toBe('wet');
    expect(() => withRecord(d, '2026-10-14', 'dry', NOW)).toThrow();
  });

  it('earns underpants at the goal and keeps them through later wet nights', () => {
    let d = defaultSave(NOW);
    d = { ...d, records: dryRun('2026-10-12', 20) };
    d = applyDerived(d);
    expect(d.underpants.earned).toBe(true);
    expect(d.underpants.on).toBe('2026-10-12');
    d = withRecord(d, TODAY, 'wet', NOW);
    expect(d.underpants.earned).toBe(true);
    expect(computeQuest(d.records, d.rules).meter).toBe(0);
  });

  it('earns underpants when a grown-up lowers the goal below the current run', () => {
    let d = { ...defaultSave(NOW), records: dryRun(TODAY, 8) };
    d = applyDerived(d);
    expect(d.underpants.earned).toBe(false);
    d = applyDerived({ ...d, rules: { ...d.rules, goal: 7 } });
    expect(d.underpants.earned).toBe(true);
  });

  it('rejects data that is not ours', () => {
    expect(normalizeSave({ app: 'other', records: {} }, NOW)).toBeNull();
    expect(normalizeSave(null, NOW)).toBeNull();
    const ok = normalizeSave({ app: APP_ID, version: 1, records: { [TODAY]: 'dry', '2030-01-01': 'dry', bad: 'dry' } }, NOW);
    expect(ok?.records).toEqual({ [TODAY]: 'dry' });
  });

  it('round-trips a backup and marks everything as already seen', () => {
    let d = defaultSave(NOW);
    d = { ...d, records: { ...dryRun('2026-10-12', 12), [TODAY]: 'wet' }, profile: { ...d.profile, species: 'stego', setupDone: true } };
    const text = exportBackup(d, NOW);
    const res = parseBackup(text, defaultSave(NOW), NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.recordCount).toBe(13);
    expect(res.data.profile.species).toBe('stego');
    expect(res.data.seen).toEqual({ stars: 12, prizes: 1, hugDate: TODAY, underpants: false, meter: 0 });
  });

  it('imports the nights from an old candy-castle backup', () => {
    const old = JSON.stringify({ app: 'zefs-dry-night-quest', version: 1, records: dryRun(TODAY, 4) });
    const res = parseBackup(old, defaultSave(NOW), NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.fromOldVersion).toBe(true);
    expect(computeQuest(res.data.records).stars).toBe(4);
    expect(res.data.seen.stars).toBe(4);
  });

  it('refuses unreadable or foreign backups', () => {
    expect(parseBackup('not json', defaultSave(NOW), NOW).ok).toBe(false);
    expect(parseBackup('{"hello":1}', defaultSave(NOW), NOW).ok).toBe(false);
  });

  it('starts a new quest but keeps the dino, prizes and settings', () => {
    let d = defaultSave(NOW);
    d = { ...d, records: dryRun(TODAY, 30), profile: { ...d.profile, name: 'Zef', species: 'trike', setupDone: true } };
    d = applyDerived(d);
    const n = newQuest(d, NOW);
    expect(n.records).toEqual({});
    expect(n.underpants.earned).toBe(false);
    expect(n.profile.species).toBe('trike');
    expect(n.prizes).toEqual(d.prizes);
    expect(seenFromRecords(n).stars).toBe(0);
  });

  it('starts over from the very first screen, keeping only the grown-up settings', () => {
    let d = defaultSave(NOW);
    d = {
      ...d,
      records: dryRun(TODAY, 30),
      profile: { ...d.profile, name: 'Milo', species: 'stego', color: 3, setupDone: true },
      rules: { ...d.rules, goal: 14 },
      prizes: [{ label: 'Zoo trip', icon: 'gift' }],
      outfit: { head: 2 },
      settings: { ...d.settings, music: false },
    };
    d = applyDerived(d);
    const n = startOver(d, NOW);
    expect(n.records).toEqual({});
    expect(n.profile).toEqual({ ...defaultSave(NOW).profile, name: 'Milo' });
    expect(n.profile.setupDone).toBe(false);
    expect(n.outfit).toEqual({});
    expect(n.underpants.earned).toBe(false);
    expect(n.seen.stars).toBe(0);
    expect(n.rules.goal).toBe(14);
    expect(n.prizes).toEqual(d.prizes);
    expect(n.settings.music).toBe(false);
  });
});
