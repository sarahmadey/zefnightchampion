// Grown-ups only: a hold-to-open button and a simple question guard the
// parent corner, where nights are recorded (with confirmation), the dated
// history can be corrected, previews can be played without touching real
// progress, and backups can be exported or imported.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGame, useSave } from '../state/store';
import {
  addDays,
  computeStreak,
  daysBetween,
  formatKeyLong,
  formatKeyShort,
  missingSinceLatest,
  sortedKeys,
  streakIfRecorded,
  todayKey,
  STOP_COUNT,
  type DateKey,
  type NightResult,
} from '../state/progress';
import { exportBackup, parseBackup, type SaveData } from '../state/save';
import { STOP_NAMES } from '../game/route';
import { startPreview } from '../game/director';
import { sfx } from '../audio/sfx';
import { CloseIcon, CloudHeartIcon, EyeIcon, MoonLockIcon, SunIcon } from './icons';

// ------------------------------------------------------------ the button

export function ParentButton() {
  const [holding, setHolding] = useState(false);
  const [gate, setGate] = useState(false);
  const timer = useRef<number | null>(null);
  const parentOpen = useGame((s) => s.parentOpen);

  const start = () => {
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      setGate(true);
    }, 1200);
  };
  const stop = () => {
    setHolding(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  if (parentOpen) return null;
  return (
    <>
      <button
        className={`corner-btn parent-btn${holding ? ' holding' : ''}`}
        aria-label="Parent corner — press and hold"
        title="Grown-ups: press and hold"
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setGate(true);
          }
        }}
      >
        <MoonLockIcon />
        <svg className="hold-ring" viewBox="0 0 48 48" aria-hidden>
          <circle cx="24" cy="24" r="21" />
        </svg>
      </button>
      {gate && (
        <Gate
          onPass={() => {
            setGate(false);
            useGame.getState().set({ parentOpen: true });
          }}
          onCancel={() => setGate(false)}
        />
      )}
    </>
  );
}

function makeQuestion() {
  const a = 3 + Math.floor(Math.random() * 6);
  const b = 3 + Math.floor(Math.random() * 6);
  const answer = a * b;
  const opts = new Set<number>([answer]);
  while (opts.size < 4) opts.add(answer + (Math.floor(Math.random() * 9) - 4 || 5));
  return { a, b, answer, options: [...opts].sort((x, y) => x - y) };
}

function Gate({ onPass, onCancel }: { onPass: () => void; onCancel: () => void }) {
  const [q, setQ] = useState(makeQuestion);
  const [miss, setMiss] = useState(false);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="sheet gate">
        <h2 id="gate-title">Grown-ups only</h2>
        <p>
          To open the parent corner, tap the answer to <strong>{q.a} × {q.b}</strong>.
        </p>
        <div className="answer-grid">
          {q.options.map((o) => (
            <button
              key={o}
              className="btn big"
              onClick={() => {
                if (o === q.answer) onPass();
                else {
                  setMiss(true);
                  setQ(makeQuestion());
                }
              }}
            >
              {o}
            </button>
          ))}
        </div>
        {miss && <p className="muted">Here's a new one to try.</p>}
        <button className="btn ghost" onClick={onCancel}>
          Back to the game
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- confirm

interface ConfirmSpec {
  title: string;
  body: ReactNode;
  confirm: string;
  tone?: 'warm' | 'danger';
  onConfirm: () => void;
}

function Confirm({ spec, onClose }: { spec: ConfirmSpec; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="modal-backdrop top" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="sheet confirm">
        <h2 id="confirm-title">{spec.title}</h2>
        <div className="confirm-body">{spec.body}</div>
        <div className="row end">
          <button className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            ref={ref}
            className={`btn ${spec.tone === 'danger' ? 'danger' : 'primary'}`}
            disabled={busy}
            onClick={() => {
              if (busy) return;
              setBusy(true);
              spec.onConfirm();
              onClose();
            }}
          >
            {spec.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- panel

function resultLabel(r: NightResult | undefined) {
  return r === 'dry' ? 'Dry night' : r === 'wet' ? 'Wet night' : 'Not recorded';
}

function consequence(records: SaveData['records'], date: DateKey, result: NightResult | null): string {
  const before = computeStreak(records);
  const after = streakIfRecorded(records, date, result);
  if (after.activeStop > before.activeStop) {
    const to = after.activeStop;
    return to >= STOP_COUNT
      ? 'Zef and Pip will reach the candy castle!'
      : `Zef and Pip will travel to stop ${to}: ${STOP_NAMES[to]}.`;
  }
  if (result === 'wet' && after.latest?.date === date) {
    return 'Pip will give Zef a big cozy hug, and the journey starts again from the cottage. Keepsakes (and the castle, once earned) stay.';
  }
  if (after.streak !== before.streak) return `The streak will be ${after.streak} after this change.`;
  return 'The journey stays where it is.';
}

export function ParentPanel() {
  const open = useGame((s) => s.parentOpen);
  const data = useSave((s) => s.data);
  const storageOk = useSave((s) => s.storageOk);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [showDays, setShowDays] = useState(21);
  const [pastDate, setPastDate] = useState('');
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  const today = todayKey();
  const info = useMemo(() => computeStreak(data.records), [data.records]);
  const missing = useMemo(() => missingSinceLatest(data.records, today), [data.records, today]);
  const keys = useMemo(() => sortedKeys(data.records), [data.records]);

  useEffect(() => {
    if (open) {
      setMessage(null);
      setExportText(null);
      setTimeout(() => closeBtn.current?.focus(), 30);
    }
  }, [open]);

  if (!open) return null;

  const close = () => useGame.getState().set({ parentOpen: false });

  const record = (date: DateKey, result: NightResult | null, closeAfter: boolean) => {
    const current = data.records[date];
    const gapWarning =
      result === 'dry' && date === today && missing.length > 0 ? (
        <p className="note">
          {missing.length === 1 ? formatKeyShort(missing[0]) + ' has' : `${missing.length} mornings have`} no record.
          Unknown nights don't count as dry or wet, but a streak only continues across nights recorded dry — so this
          starts a fresh run. You can fill them in from the history below first.
        </p>
      ) : null;
    setConfirm({
      title:
        result === null
          ? `Clear ${formatKeyShort(date)}?`
          : current
            ? `Change ${formatKeyShort(date)} to ${resultLabel(result).toLowerCase()}?`
            : `Record the night before ${formatKeyShort(date)} as a ${resultLabel(result).toLowerCase()}?`,
      body: (
        <>
          <p>{consequence(data.records, date, result)}</p>
          {gapWarning}
        </>
      ),
      confirm: result === null ? 'Clear it' : current ? 'Change it' : 'Yes, record it',
      onConfirm: () => {
        useSave.getState().record(date, result);
        sfx.play('tap');
        if (closeAfter) close();
        else setMessage(`Saved ${formatKeyShort(date)}.`);
      },
    });
  };

  // history rows from today back to the earliest record (at least two weeks)
  const earliest = keys[0] ?? today;
  const span = Math.max(13, daysBetween(earliest, today));
  const rows: DateKey[] = [];
  for (let i = 0; i <= Math.min(span, showDays - 1); i++) rows.push(addDays(today, -i));

  const doExport = () => {
    const text = exportBackup(data);
    setExportText(text);
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zef-dry-night-quest-backup-${today}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage('Backup file created. If no download appeared, copy the text below instead.');
    } catch {
      setMessage('Copy the backup text below and keep it somewhere safe.');
    }
  };

  const doImport = (text: string) => {
    const res = parseBackup(text, data);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    setConfirm({
      title: 'Replace progress with this backup?',
      body: (
        <p>
          The backup has {res.recordCount} recorded {res.recordCount === 1 ? 'night' : 'nights'}
          {res.dropped ? ` (${res.dropped} unreadable or future entries were skipped)` : ''}. Your current history on this
          device will be replaced.
        </p>
      ),
      confirm: 'Replace',
      tone: 'danger',
      onConfirm: () => {
        useSave.getState().replace(res.data);
        setImportText('');
        setMessage('Backup restored.');
      },
    });
  };

  const stopName = info.activeStop === 0 ? 'the cottage' : `stop ${info.activeStop}: ${STOP_NAMES[info.activeStop]}`;

  return (
    <div className="modal-backdrop panel-backdrop" role="dialog" aria-modal="true" aria-labelledby="panel-title">
      <div className="panel">
        <header className="panel-head">
          <h1 id="panel-title">Parent corner</h1>
          <button ref={closeBtn} className="icon-btn" aria-label="Close parent corner" onClick={close}>
            <CloseIcon />
          </button>
        </header>

        {!storageOk && (
          <p className="note warn">
            This browser isn't letting the game save. Progress will last until the page closes — use Export backup to
            keep it.
          </p>
        )}

        <section className="card today">
          <h2>Last night</h2>
          <p className="muted">The night before {formatKeyLong(today)}</p>
          {data.records[today] ? (
            <p className="status">
              Recorded: <strong>{resultLabel(data.records[today])}</strong>. You can change it in the history below.
            </p>
          ) : (
            <div className="row two">
              <button className="btn big dry" onClick={() => record(today, 'dry', true)}>
                <SunIcon /> Dry night
              </button>
              <button className="btn big wet" onClick={() => record(today, 'wet', true)}>
                <CloudHeartIcon /> Wet night
              </button>
            </div>
          )}
        </section>

        {missing.length > 0 && (
          <section className="card notice">
            <h2>Unknown nights</h2>
            <p>
              No record for {missing.length <= 3 ? missing.map((k) => formatKeyShort(k)).join(', ') : `${missing.length} mornings`}{' '}
              between the last record and today. Unknown nights never count as dry or wet. Fill them in below if you
              remember.
            </p>
          </section>
        )}

        <section className="card summary">
          <h2>Journey</h2>
          <dl>
            <div>
              <dt>Dry nights in a row</dt>
              <dd>{info.streak}</dd>
            </div>
            <div>
              <dt>Zef is at</dt>
              <dd>{stopName}</dd>
            </div>
            <div>
              <dt>Castle</dt>
              <dd>{data.castleUnlocked ? 'Unlocked — it stays open' : 'Not reached yet'}</dd>
            </div>
            <div>
              <dt>Keepsakes</dt>
              <dd>{data.keepsakes.length} of 15</dd>
            </div>
          </dl>
          {info.runBrokenBy?.reason === 'unknown' && info.streak > 0 && (
            <p className="muted small">
              This run began after {formatKeyShort(info.runBrokenBy.date)}, which has no record.
            </p>
          )}
        </section>

        <section className="card">
          <h2>History</h2>
          <p className="muted small">One result per morning. Tap to correct any day; the streak is recalculated.</p>
          <ul className="history">
            {rows.map((k) => {
              const r = data.records[k];
              return (
                <li key={k} className={`hist-row ${r ?? 'unknown'}`}>
                  <span className="hist-date">
                    {formatKeyShort(k)}
                    {k === today && <em> (last night)</em>}
                  </span>
                  <span className={`chip ${r ?? 'unknown'}`}>{resultLabel(r)}</span>
                  <span className="hist-actions">
                    <button className="btn small" disabled={r === 'dry'} onClick={() => record(k, 'dry', false)}>
                      Dry
                    </button>
                    <button className="btn small" disabled={r === 'wet'} onClick={() => record(k, 'wet', false)}>
                      Wet
                    </button>
                    {r && (
                      <button className="btn small ghost" onClick={() => record(k, null, false)}>
                        Clear
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {span >= showDays && (
            <button className="btn ghost" onClick={() => setShowDays((d) => d + 30)}>
              Show older days
            </button>
          )}
          <div className="row add-past">
            <label>
              Another morning
              <input type="date" max={today} value={pastDate} onChange={(e) => setPastDate(e.target.value)} />
            </label>
            <button className="btn small" disabled={!pastDate || pastDate > today} onClick={() => record(pastDate, 'dry', false)}>
              Dry
            </button>
            <button className="btn small" disabled={!pastDate || pastDate > today} onClick={() => record(pastDate, 'wet', false)}>
              Wet
            </button>
          </div>
        </section>

        <section className="card">
          <h2>
            <EyeIcon /> Preview
          </h2>
          <p className="muted small">Play any stop's arrival, or the hug, without changing real progress.</p>
          <div className="preview-grid">
            {Array.from({ length: STOP_COUNT }, (_, i) => i + 1).map((n) => (
              <button key={n} className="btn small" title={STOP_NAMES[n]} aria-label={`Preview stop ${n}: ${STOP_NAMES[n]}`} onClick={() => startPreview({ kind: 'stop', stop: n })}>
                {n}
              </button>
            ))}
          </div>
          <button className="btn" onClick={() => startPreview({ kind: 'hug', stop: 0 })}>
            Preview the hug
          </button>
        </section>

        <section className="card">
          <h2>Settings</h2>
          <label className="toggle">
            <input
              type="checkbox"
              checked={data.settings.sound}
              onChange={(e) => useSave.getState().setSettings({ sound: e.target.checked })}
            />
            <span>Sound</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={data.settings.reducedMotion}
              onChange={(e) => useSave.getState().setSettings({ reducedMotion: e.target.checked })}
            />
            <span>Reduced motion (gentler camera, fewer particles)</span>
          </label>
        </section>

        <section className="card">
          <h2>Backup</h2>
          <p className="muted small">Progress is saved on this device only. Export a backup to move or protect it.</p>
          <div className="row">
            <button className="btn" onClick={doExport}>
              Export backup
            </button>
            <label className="btn file-btn">
              Import backup file
              <input
                type="file"
                accept="application/json,.json,text/plain"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) doImport(await f.text());
                }}
              />
            </label>
          </div>
          {exportText && (
            <textarea className="code" readOnly value={exportText} rows={5} aria-label="Backup text" onFocus={(e) => e.currentTarget.select()} />
          )}
          <details>
            <summary>Paste backup text instead</summary>
            <textarea className="code" value={importText} rows={4} onChange={(e) => setImportText(e.target.value)} aria-label="Paste backup text" />
            <button className="btn small" disabled={!importText.trim()} onClick={() => doImport(importText)}>
              Import pasted text
            </button>
          </details>
        </section>

        <section className="card danger-zone">
          <h2>Start a new adventure</h2>
          <p className="muted small">Clears every recorded night, the keepsakes and the castle on this device.</p>
          <button
            className="btn danger"
            onClick={() =>
              setConfirm({
                title: 'Start a brand-new adventure?',
                body: <p>All recorded nights, keepsakes and the unlocked castle will be cleared. This can't be undone (unless you exported a backup).</p>,
                confirm: 'Start new adventure',
                tone: 'danger',
                onConfirm: () => {
                  useSave.getState().startNewAdventure();
                  useGame.getState().set({ litStop: 0 });
                  setMessage('A new adventure is ready.');
                },
              })
            }
          >
            Start new adventure
          </button>
        </section>

        {message && (
          <p className="toast" role="status">
            {message}
          </p>
        )}
        <footer className="panel-foot">
          <button className="btn primary" onClick={close}>
            Back to the game
          </button>
        </footer>
      </div>
      {confirm && <Confirm spec={confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
