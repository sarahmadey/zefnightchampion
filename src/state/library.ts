// Every child's adventure on this device, and how it lines up with the
// family's copy online. Pure functions, unit tested; the store does the
// saving and the cloud module does the talking.
//
// A device keeps a library: one save per child (the same shape a single
// save always had), which child played last, and the sound settings (those
// belong to the device, not the child). Online, each child is one document,
// `journeys/<child id>`, holding that child's save. A child removed by a
// grown-up becomes a small "deleted" note there, so a phone that was offline
// at the time removes it too instead of putting it back.

import { computeQuest, type Records } from './progress';
import { APP_ID, applyDerived, defaultSave, normalizeSave, readLegacySave, storage, type SaveData, type Settings } from './save';

export const LIBRARY_KEY = 'zefs-dino-underpants-quest:v2';
export const LIBRARY_BACKUP_KEY = 'zefs-dino-underpants-quest:v2:previous';

export interface Child {
  data: SaveData;
  /** changed here since the online copy last heard about it */
  dirty: boolean;
  /** brought over from the one-child version; joins an online child of the same name */
  legacy?: boolean;
}

export interface Library {
  app: typeof APP_ID;
  version: 2;
  /** the child who played last on this device */
  current: string | null;
  settings: Settings;
  children: Record<string, Child>;
  /** children removed here whose online copy still has to be told */
  removed: string[];
}

/** One child's document online. */
export interface CloudDoc {
  id: string;
  updatedAt: string;
  deleted?: boolean;
  journey?: unknown;
}

export function newChildId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `c-${crypto.randomUUID()}`;
  } catch {
    /* fall through */
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyLibrary(settings: Settings = defaultSave().settings): Library {
  return { app: APP_ID, version: 2, current: null, settings, children: {}, removed: [] };
}

/** A brand-new child, not set up yet: no name until a grown-up types one. */
export function newChildSave(now: Date = new Date()): SaveData {
  const d = defaultSave(now);
  return { ...d, profile: { ...d.profile, name: '' } };
}

/** The one-child save from before, as a library with that child in it. */
export function libraryFromLegacy(old: SaveData | null, now: Date = new Date()): Library {
  const lib = emptyLibrary(old?.settings);
  if (old && (old.profile.setupDone || Object.keys(old.records).length > 0)) {
    const id = newChildId();
    lib.children[id] = { data: old, dirty: true, legacy: true };
    lib.current = id;
  }
  void now;
  return lib;
}

/** Normalise a stored library. Returns null when it clearly isn't ours. */
export function normalizeLibrary(raw: unknown, now: Date = new Date()): Library | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.app !== APP_ID || r.version !== 2) return null;
  const base = defaultSave(now);
  const s = (r.settings ?? {}) as Record<string, unknown>;
  const settings: Settings = {
    sound: s.sound !== false,
    music: s.music !== false,
    reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : base.settings.reducedMotion,
  };
  const children: Record<string, Child> = {};
  const rawChildren = (r.children ?? {}) as Record<string, unknown>;
  for (const [id, c] of Object.entries(rawChildren)) {
    if (!validId(id) || !c || typeof c !== 'object') continue;
    const cc = c as Record<string, unknown>;
    const data = normalizeSave(cc.data, now);
    if (!data) continue;
    children[id] = { data: { ...data, settings }, dirty: cc.dirty === true, ...(cc.legacy === true ? { legacy: true } : {}) };
  }
  const removed = Array.isArray(r.removed) ? (r.removed as unknown[]).filter((x): x is string => typeof x === 'string' && validId(x)).slice(-50) : [];
  const current = typeof r.current === 'string' && children[r.current] ? r.current : null;
  return { app: APP_ID, version: 2, current, settings, children, removed };
}

/** Child ids are used as online document names: letters, digits and a few marks. */
export function validId(id: string): boolean {
  return /^[A-Za-z0-9_\-.~:@+]{1,120}$/.test(id) && id !== '.' && id !== '..';
}

/** The children in a steady order: oldest adventure first. */
export function childOrder(lib: Library): string[] {
  return Object.keys(lib.children).sort((a, b) => {
    const ca = lib.children[a].data.createdAt;
    const cb = lib.children[b].data.createdAt;
    return ca < cb ? -1 : ca > cb ? 1 : a < b ? -1 : 1;
  });
}

/** What goes online for one child (the sound settings stay on the device). */
export function cloudBody(data: SaveData): Record<string, unknown> {
  const { settings: _settings, ...journey } = data;
  void _settings;
  return { v: 1, updatedAt: data.updatedAt, journey };
}

/** Everything but the bookkeeping (when it changed, how it sounds on this device). */
export function sameContent(a: SaveData, b: SaveData): boolean {
  return JSON.stringify(contentOf(a)) === JSON.stringify(contentOf(b));
}

function contentOf(d: SaveData): unknown {
  const sorted = (o: Record<string, unknown>) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  return {
    records: sorted(d.records),
    rules: d.rules,
    prizes: d.prizes,
    prizesGiven: d.prizesGiven,
    underpants: d.underpants,
    profile: d.profile,
    outfit: sorted(d.outfit as Record<string, unknown>),
    seen: d.seen,
    questId: d.questId,
  };
}

export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase() && a.trim() !== '';
}

/**
 * Two copies of one child's adventure that both changed: keep every
 * recorded morning (the newer copy wins a morning both changed), everything
 * either copy has already shown, and the newer copy's settings.
 */
export function mergeJourney(a: SaveData, b: SaveData): SaveData {
  const [older, newer] = a.updatedAt <= b.updatedAt ? [a, b] : [b, a];
  const records: Records = { ...older.records, ...newer.records };
  const merged: SaveData = {
    ...newer,
    records,
    prizesGiven: [...new Set([...older.prizesGiven, ...newer.prizesGiven])].sort((x, y) => x - y),
    underpants: {
      earned: older.underpants.earned || newer.underpants.earned,
      on: newer.underpants.on ?? older.underpants.on,
      pick: newer.underpants.pick ?? older.underpants.pick,
    },
    seen: {
      stars: Math.max(older.seen.stars, newer.seen.stars),
      prizes: Math.max(older.seen.prizes, newer.seen.prizes),
      hugDate: newer.seen.hugDate ?? older.seen.hugDate,
      underpants: older.seen.underpants || newer.seen.underpants,
      meter: newer.seen.meter,
    },
  };
  // never show more than the records hold
  const q = computeQuest(merged.records, merged.rules);
  merged.seen.stars = Math.min(merged.seen.stars, q.stars);
  merged.seen.prizes = Math.min(merged.seen.prizes, q.prizes);
  return applyDerived(merged);
}

export interface MergeResult {
  lib: Library;
  /** children whose online copy needs this device's version */
  upload: string[];
  /** removed children whose online copy needs a "deleted" note */
  tombstones: string[];
}

/**
 * Fold the online copies into this device's library. `definitive` is true
 * once the list is the server's own (not a cached first look): only then
 * does a child missing online get uploaded, and a brought-over child join
 * an online one of the same name.
 */
export function mergeCloud(lib: Library, docs: CloudDoc[], definitive: boolean, now: Date = new Date()): MergeResult {
  const children: Record<string, Child> = { ...lib.children };
  let removed = [...lib.removed];
  let current = lib.current;
  const upload = new Set<string>();
  const online = new Map<string, SaveData>();
  const gone = new Set<string>();

  for (const doc of docs) {
    if (!validId(doc.id)) continue;
    if (doc.deleted) {
      gone.add(doc.id);
      removed = removed.filter((x) => x !== doc.id);
      const local = children[doc.id];
      if (local && !(local.dirty && local.data.updatedAt > doc.updatedAt)) {
        delete children[doc.id];
        if (current === doc.id) current = null;
      }
      continue;
    }
    const data = normalizeSave(doc.journey && typeof doc.journey === 'object' ? { ...(doc.journey as object), app: APP_ID } : null, now);
    if (!data) continue;
    const withSettings = { ...data, settings: lib.settings };
    online.set(doc.id, withSettings);
    if (removed.includes(doc.id)) continue;
    const local = children[doc.id];
    if (!local) {
      children[doc.id] = { data: withSettings, dirty: false };
    } else if (local.data.updatedAt === withSettings.updatedAt) {
      // the same version (often this device's own write coming back)
    } else if (local.dirty) {
      // changed in both places: keep everything from both. When one side
      // already has it all, keep that version as it is (so devices agree
      // without a new round); otherwise a fresh time so every device takes
      // the combined one. Either way it's sent again, so it lands after any
      // older write of ours still on its way.
      const merged = mergeJourney(local.data, withSettings);
      const data = sameContent(merged, withSettings)
        ? withSettings
        : sameContent(merged, local.data)
          ? local.data
          : { ...merged, updatedAt: now.toISOString() };
      children[doc.id] = { ...local, data, dirty: true };
      upload.add(doc.id);
    } else {
      children[doc.id] = { data: withSettings, dirty: false };
    }
  }

  if (definitive) {
    for (const [id, child] of Object.entries(children)) {
      const there = online.get(id);
      if (there || gone.has(id)) {
        if (child.dirty && there?.updatedAt !== child.data.updatedAt) upload.add(id);
        continue;
      }
      if (child.legacy) {
        // the same child set up on another device first: join that adventure
        const twin = [...online.keys()].find((oid) => oid !== id && children[oid] && sameName(children[oid].data.profile.name, child.data.profile.name));
        if (twin) {
          children[twin] = { data: { ...mergeJourney(children[twin].data, child.data), updatedAt: now.toISOString() }, dirty: true };
          delete children[id];
          if (current === id) current = twin;
          upload.add(twin);
          continue;
        }
        // first device online: it becomes an ordinary child
        children[id] = { data: child.data, dirty: true };
      }
      upload.add(id);
    }
  }

  if (current && !children[current]) current = null;
  return {
    lib: { ...lib, children, removed, current },
    upload: [...upload].filter((id) => children[id]),
    tombstones: definitive ? removed : [],
  };
}

/** This device's library: the saved one, or the old one-child save brought over, or empty. */
export function loadLibrary(now: Date = new Date()): Library {
  const s = storage();
  if (s) {
    for (const key of [LIBRARY_KEY, LIBRARY_BACKUP_KEY]) {
      try {
        const text = s.getItem(key);
        if (!text) continue;
        const lib = normalizeLibrary(JSON.parse(text), now);
        if (lib) return lib;
      } catch {
        /* try the next copy */
      }
    }
  }
  return libraryFromLegacy(readLegacySave(now), now);
}

export function persistLibrary(lib: Library): boolean {
  const s = storage();
  if (!s) return false;
  try {
    const prev = s.getItem(LIBRARY_KEY);
    if (prev) s.setItem(LIBRARY_BACKUP_KEY, prev);
    s.setItem(LIBRARY_KEY, JSON.stringify(lib));
    return true;
  } catch {
    return false;
  }
}
