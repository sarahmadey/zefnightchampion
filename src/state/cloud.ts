// Keeps each child's adventure in this page's own online database when the
// game runs inside the claude.ai viewer, so progress follows the grown-up's
// Claude account instead of one phone, and family members the page is
// shared with (as Editors) see and add to the same adventures, live.
//
// Anywhere else (a saved copy, the dev server), or for someone the page is
// shared with as a Viewer, nothing goes online: the game keeps progress on
// the device, exactly as before. The database's rules (declared when the
// page is published) let only the owner and invited Editors or Contributors
// read or write the adventures, so other families never see them.

import { cloudHooks, useSave, worthUploading } from './store';
import { cloudBody, type CloudDoc } from './library';

const COLLECTION = 'journeys';

type DbError = { code: string; message?: string };
type DocSnap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
type QuerySnap = { docs: DocSnap[]; metadata: { fromCache: boolean; hasPendingWrites: boolean } };
interface DbLike {
  doc(path: string): { set(body: Record<string, unknown>): Promise<void> };
  collection(path: string): { onSnapshot(next: (s: QuerySnap) => void, error?: (e: DbError) => void): () => void };
}
interface UserLike {
  can(name: string): Promise<boolean | null>;
}
type Host = { use?: (name: string) => Promise<unknown> };

let db: DbLike | null = null;
let unsubscribe: (() => void) | null = null;
let ready = false;
let started = false;
let resubscribes = 0;
/** what each child's document still needs: its latest data, or the "removed" note */
const queue = new Map<string, 'data' | 'tombstone'>();
const busy = new Set<string>();

/** Connect once, early. Safe to call when there is no viewer: it does nothing. */
export async function startCloud(): Promise<void> {
  if (started) return;
  started = true;
  const host = (window as unknown as { claude?: Host }).claude;
  if (typeof host?.use !== 'function') return;
  const store = useSave.getState();
  store.setCloud('connecting');
  let ns: DbLike | null = null;
  let user: UserLike | null = null;
  try {
    [ns, user] = (await Promise.all([host.use('db'), host.use('user')])) as [DbLike | null, UserLike | null];
  } catch {
    ns = null;
  }
  if (!ns) {
    useSave.getState().setCloud('off');
    return;
  }
  let can: boolean | null = null;
  try {
    can = user ? await user.can('data.write') : null;
  } catch {
    can = null;
  }
  if (can === false) {
    // looking, not saving: this person's own adventures stay on their device
    useSave.getState().setCloud('guest');
    return;
  }
  db = ns;
  cloudHooks.upload = (id) => send(id, 'data');
  cloudHooks.tombstone = (id) => send(id, 'tombstone');
  subscribe();
}

function subscribe() {
  if (!db) return;
  unsubscribe = db.collection(COLLECTION).onSnapshot(
    (snap) => {
      const docs: CloudDoc[] = [];
      for (const d of snap.docs) {
        const body = d.exists ? d.data() : undefined;
        if (!body) continue;
        docs.push({ id: d.id, updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : '', deleted: body.deleted === true, journey: body.journey });
      }
      const definitive = !snap.metadata.fromCache;
      useSave.getState().applyCloud(docs, definitive);
      if (definitive && !ready) {
        ready = true;
        useSave.getState().setCloud('on');
        for (const id of [...queue.keys()]) void flush(id);
      }
    },
    (e) => {
      unsubscribe = null;
      if (e.code === 'unavailable' && resubscribes < 3) {
        resubscribes++;
        setTimeout(subscribe, 2000 + Math.random() * 2000);
        return;
      }
      stop(e.code === 'invalid_argument' ? 'guest' : 'off');
    },
  );
}

/** Inside the viewer at all (so online saving could be switched on)? */
export function inViewer(): boolean {
  const host = (window as unknown as { claude?: Host }).claude;
  return typeof host?.use === 'function';
}

/**
 * After a "no" to the viewer's permission question: open its Permissions
 * panel, and try again once it closes.
 */
export async function retryCloud(): Promise<void> {
  const host = (window as unknown as { claude?: Host }).claude;
  if (typeof host?.use !== 'function') return;
  try {
    const perms = (await host.use('permissions')) as { manage(): Promise<void> } | null;
    await perms?.manage();
  } catch {
    /* no panel here; the artifact's own Permissions menu does the same */
  }
  unsubscribe?.();
  unsubscribe = null;
  db = null;
  ready = false;
  started = false;
  resubscribes = 0;
  await startCloud();
}

/** Stop talking to the database; progress carries on, on this device. */
function stop(status: 'off' | 'guest') {
  unsubscribe?.();
  unsubscribe = null;
  db = null;
  ready = false;
  queue.clear();
  cloudHooks.upload = () => undefined;
  cloudHooks.tombstone = () => undefined;
  useSave.getState().setCloud(status);
}

function send(id: string, what: 'data' | 'tombstone') {
  queue.set(id, what);
  if (ready) void flush(id);
}

/** One write at a time per child, always with the newest data. */
async function flush(id: string) {
  if (busy.has(id)) return;
  busy.add(id);
  try {
    while (db && queue.has(id)) {
      const what = queue.get(id)!;
      queue.delete(id);
      const ref = db.doc(`${COLLECTION}/${id}`);
      if (what === 'tombstone') {
        const ok = await write(() => ref.set({ v: 1, updatedAt: new Date().toISOString(), deleted: true }));
        if (ok) useSave.getState().markTombstoned(id);
        continue;
      }
      const child = useSave.getState().library.children[id];
      if (!child || !worthUploading(child.data)) continue;
      const data = child.data;
      const ok = await write(() => ref.set(cloudBody(data)));
      if (ok) useSave.getState().markUploaded(id, data.updatedAt);
    }
  } finally {
    busy.delete(id);
  }
}

/** A write, retried once if the platform hiccups. False when it didn't land. */
async function write(fn: () => Promise<void>): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await fn();
      return true;
    } catch (e) {
      const code = (e as DbError)?.code;
      if (code === 'invalid_argument') {
        // this person can look but not save online
        stop('guest');
        return false;
      }
      if (code === 'not_granted' || code === 'revoked' || code === 'capability_disabled' || code === 'capability_removed') {
        stop('off');
        return false;
      }
      if (attempt === 0 && (code === 'unavailable' || code === 'resource_exhausted' || code === undefined)) {
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
        continue;
      }
      // still marked as changed here; the next change or visit sends it again
      return false;
    }
  }
  return false;
}
