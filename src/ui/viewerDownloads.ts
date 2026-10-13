// Inside the claude.ai artifact viewer a page cannot start a download itself;
// the viewer offers its own "save this file?" prompt through `downloads`.
// Anywhere else (dev server, a static host, a saved copy) there is no
// `window.claude`, or it answers null, and the backup falls back to a plain
// link download plus copyable text.

export type ViewerDownloads = {
  save(req: { filename: string; data: string | Blob }): Promise<{ status: 'saved' | 'delivered' }>;
};

let pending: Promise<ViewerDownloads | null> | null = null;

/** Asks the viewer once; call early so the answer is ready before a tap. */
export function viewerDownloads(): Promise<ViewerDownloads | null> {
  if (!pending) {
    const host = (window as unknown as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
    pending =
      typeof host?.use === 'function'
        ? host.use('downloads').then(
            (ns) => (ns as ViewerDownloads | null) ?? null,
            () => null,
          )
        : Promise.resolve(null);
  }
  return pending;
}
