import { describe, expect, it } from 'vitest';
import { addDays, type Records } from '../src/state/progress';
import { applyDerived, defaultSave, type SaveData } from '../src/state/save';
import {
  childOrder,
  cloudBody,
  emptyLibrary,
  libraryFromLegacy,
  mergeCloud,
  mergeJourney,
  newChildSave,
  normalizeLibrary,
  sameContent,
  type CloudDoc,
  type Library,
} from '../src/state/library';

const NOW = new Date(2026, 9, 14, 8, 0, 0);
const TODAY = '2026-10-14';

function run(end: string, n: number, result: 'dry' | 'wet' = 'dry'): Records {
  const r: Records = {};
  for (let i = 0; i < n; i++) r[addDays(end, -i)] = result;
  return r;
}

function child(name: string, records: Records, updatedAt: string, extra: Partial<SaveData> = {}): SaveData {
  const d = defaultSave(NOW);
  return applyDerived({ ...d, ...extra, records, updatedAt, profile: { ...d.profile, name, setupDone: true } });
}

function lib(children: Record<string, { data: SaveData; dirty?: boolean; legacy?: boolean }>, extra: Partial<Library> = {}): Library {
  const l = emptyLibrary();
  for (const [id, c] of Object.entries(children)) l.children[id] = { data: c.data, dirty: c.dirty ?? false, ...(c.legacy ? { legacy: true } : {}) };
  return { ...l, current: Object.keys(children)[0] ?? null, ...extra };
}

function doc(id: string, data: SaveData): CloudDoc {
  const body = cloudBody(data);
  return { id, updatedAt: body.updatedAt as string, journey: body.journey };
}

describe('the library of children', () => {
  it('brings the one-child save over as the first child', () => {
    const old = child('Zef', run(TODAY, 3), NOW.toISOString());
    const l = libraryFromLegacy(old, NOW);
    expect(Object.keys(l.children)).toHaveLength(1);
    const id = l.current!;
    expect(l.children[id].legacy).toBe(true);
    expect(l.children[id].data.records).toEqual(old.records);
    expect(libraryFromLegacy(null, NOW).children).toEqual({});
    // a save that was never set up and has no nights isn't worth bringing over
    expect(libraryFromLegacy(defaultSave(NOW), NOW).children).toEqual({});
  });

  it('survives a round trip through storage and keeps a new child nameless', () => {
    const l = lib({ a: { data: child('Zef', run(TODAY, 2), '2026-10-14T08:00:00.000Z') }, b: { data: newChildSave(NOW), dirty: true } });
    const back = normalizeLibrary(JSON.parse(JSON.stringify(l)), NOW)!;
    expect(back.children.a.data.records).toEqual(l.children.a.data.records);
    expect(back.children.b.data.profile.name).toBe('');
    expect(back.children.b.dirty).toBe(true);
    expect(normalizeLibrary({ app: 'something-else', version: 2 }, NOW)).toBeNull();
  });

  it('orders children oldest first', () => {
    const older = { ...child('Zef', {}, 'x'), createdAt: '2026-01-01T00:00:00.000Z' };
    const newer = { ...child('Mia', {}, 'x'), createdAt: '2026-05-01T00:00:00.000Z' };
    expect(childOrder(lib({ m: { data: newer }, z: { data: older } }))).toEqual(['z', 'm']);
  });
});

describe('merging two copies of one child', () => {
  it('keeps every morning and everything already shown', () => {
    const a = child('Zef', run('2026-10-10', 3), '2026-10-12T08:00:00.000Z', { seen: { stars: 3, prizes: 0, hugDate: null, underpants: false, meter: 3 } });
    const b = child('Zef', { ...run('2026-10-10', 3), '2026-10-11': 'dry', '2026-10-10': 'wet' }, '2026-10-13T08:00:00.000Z');
    const m = mergeJourney(a, b);
    expect(Object.keys(m.records).sort()).toEqual(['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    // the newer copy wins a morning both changed
    expect(m.records['2026-10-10']).toBe('wet');
    expect(m.seen.stars).toBe(3);
  });
});

describe('lining up with the online copy', () => {
  const t1 = '2026-10-13T08:00:00.000Z';
  const t2 = '2026-10-14T08:00:00.000Z';

  it('adds children from other devices and takes newer versions', () => {
    const mine = child('Zef', run(TODAY, 2), t1);
    const res = mergeCloud(lib({ z: { data: mine } }), [doc('z', child('Zef', run(TODAY, 3), t2)), doc('m', child('Mia', run(TODAY, 1), t1))], true, NOW);
    expect(Object.keys(res.lib.children).sort()).toEqual(['m', 'z']);
    expect(Object.keys(res.lib.children.z.data.records)).toHaveLength(3);
    expect(res.upload).toEqual([]);
  });

  it('ignores its own write coming back', () => {
    const mine = child('Zef', run(TODAY, 2), t2);
    const res = mergeCloud(lib({ z: { data: mine, dirty: true } }), [doc('z', mine)], true, NOW);
    expect(res.lib.children.z.data).toBe(mine);
    expect(res.upload).toEqual([]);
  });

  it('combines changes made in two places and sends the result', () => {
    const mine = child('Zef', { ...run('2026-10-12', 2), [TODAY]: 'dry' }, t2);
    const theirs = child('Zef', { ...run('2026-10-12', 2), '2026-10-13': 'dry' }, t1);
    const res = mergeCloud(lib({ z: { data: mine, dirty: true } }), [doc('z', theirs)], true, NOW);
    expect(Object.keys(res.lib.children.z.data.records)).toHaveLength(4);
    expect(res.lib.children.z.dirty).toBe(true);
    expect(res.upload).toEqual(['z']);
  });

  it('keeps the online version when it already has everything, and still re-sends it', () => {
    const mine = child('Zef', run(TODAY, 2), t1);
    const theirs = child('Zef', run(TODAY, 3), t2);
    const res = mergeCloud(lib({ z: { data: mine, dirty: true } }), [doc('z', theirs)], true, NOW);
    expect(sameContent(res.lib.children.z.data, theirs)).toBe(true);
    expect(res.lib.children.z.data.updatedAt).toBe(t2);
    expect(res.upload).toEqual(['z']);
  });

  it('removes a child another device removed', () => {
    const res = mergeCloud(lib({ z: { data: child('Zef', {}, t1) } }), [{ id: 'z', updatedAt: t2, deleted: true }], true, NOW);
    expect(res.lib.children).toEqual({});
    expect(res.lib.current).toBeNull();
  });

  it("doesn't bring back a child removed here, and tells the online copy", () => {
    const l = { ...lib({}), removed: ['z'] };
    const res = mergeCloud(l, [doc('z', child('Zef', {}, t1))], true, NOW);
    expect(res.lib.children).toEqual({});
    expect(res.tombstones).toEqual(['z']);
  });

  it('sends children the online copy lacks, but only once the list is definitive', () => {
    const l = lib({ z: { data: child('Zef', run(TODAY, 1), t1) } });
    expect(mergeCloud(l, [], false, NOW).upload).toEqual([]);
    expect(mergeCloud(l, [], true, NOW).upload).toEqual(['z']);
  });

  it('joins a brought-over child to the online child with the same name', () => {
    const online = child('Zef', run('2026-10-12', 3), t1);
    const local = child('zef', { [TODAY]: 'dry' }, t2);
    const res = mergeCloud(lib({ old: { data: local, dirty: true, legacy: true } }), [doc('z', online)], true, NOW);
    expect(Object.keys(res.lib.children)).toEqual(['z']);
    expect(res.lib.current).toBe('z');
    expect(Object.keys(res.lib.children.z.data.records)).toHaveLength(4);
    expect(res.upload).toEqual(['z']);
  });

  it('puts a brought-over child online as its own when nobody has it yet', () => {
    const local = child('Zef', run(TODAY, 2), t1);
    const res = mergeCloud(lib({ old: { data: local, dirty: true, legacy: true } }), [doc('m', child('Mia', {}, t1))], true, NOW);
    expect(res.lib.children.old.legacy).toBeUndefined();
    expect(res.upload).toEqual(['old']);
  });
});
