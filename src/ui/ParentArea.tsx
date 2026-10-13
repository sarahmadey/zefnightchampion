// Grown-ups only: a hold-to-open button and a simple question guard the
// parent corner. In here: record or correct any morning, see stars and the
// underpants meter, set the underpants goal and the prize list, mark prizes
// as handed over, preview any moment, change the dino, and back up progress.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useGame, useSave } from '../state/store';
import {
  GOAL_MAX,
  GOAL_MIN,
  addDays,
  computeQuest,
  daysBetween,
  formatKeyLong,
  formatKeyShort,
  missingSinceLatest,
  prizeThreshold,
  questIfRecorded,
  recentRate,
  sortedKeys,
  todayKey,
  type DateKey,
  type NightResult,
} from '../state/progress';
import { exportBackup, parseBackup, type SaveData } from '../state/save';
import { resetBoardView, startPreview } from '../game/director';
import { sfx } from '../audio/sfx';
import { setMusicOn, setSoundOn } from '../audio/core';
import { music } from '../audio/music';
import { CloseIcon, EyeIcon, HeartIcon, MoonLockIcon, SunIcon } from './icons';
import { viewerDownloads } from './viewerDownloads';
import { DINO_COLORS, PRIZE_ICONS, SPECIES, prizeAt, type Prize, type PrizeIcon } from '../game/rewards';
import { UNDERPANTS } from '../game/rewards';

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
      {gate &&
        createPortal(
          <Gate
            onPass={() => {
              setGate(false);
              useGame.getState().set({ parentOpen: true });
            }}
            onCancel={() => setGate(false)}
          />,
          document.body,
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

// ---------------------------------------------------------------- helpers

function resultLabel(r: NightResult | undefined) {
  return r === 'dry' ? 'Dry' : r === 'wet' ? 'Not dry' : 'Not recorded';
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function consequence(data: SaveData, date: DateKey, result: NightResult | null): string {
  const name = data.profile.name || 'Zef';
  const goal = data.rules.goal;
  const before = computeQuest(data.records, data.rules);
  const after = questIfRecorded(data.records, date, result, data.rules);
  const parts: string[] = [];
  if (after.stars > before.stars) {
    parts.push(`${name} gets a star (${after.stars} in total).`);
    if (after.prizes > before.prizes) parts.push(`That opens a treasure chest: ${prizeAt(data.prizes, after.prizes - 1).label}!`);
  } else if (after.stars < before.stars) {
    parts.push(`Stars go from ${before.stars} to ${after.stars} (the board settles quietly, with no "taking away" on screen).`);
  }
  if (result === 'wet' && after.latest?.date === date) {
    parts.push(`Coach Rex gives ${name} a big hug. The underpants meter starts fresh; all ${after.stars} stars stay.`);
  } else if (after.meter !== before.meter) {
    if (after.goalReachedOn && !before.goalReachedOn && !data.underpants.earned) parts.push('The underpants meter fills up — the Underpants Store opens!');
    else parts.push(`The underpants meter becomes ${Math.min(after.meter, goal)} of ${goal}.`);
  }
  if (!parts.length) parts.push('Nothing on the board changes.');
  return parts.join(' ');
}

/** Average mornings until `n` dry nights in a row, at dry rate `p`. */
function expectedWait(p: number, n: number): number {
  if (p >= 0.999) return n;
  if (p <= 0.01) return Infinity;
  return (1 / Math.pow(p, n) - 1) / (1 - p);
}

function friendlyDuration(days: number): string {
  if (!isFinite(days) || days > 730) return 'more than two years';
  if (days < 14) return `about ${Math.round(days)} days`;
  if (days < 70) return `about ${Math.round(days / 7)} weeks`;
  return `about ${Math.round(days / 30)} months`;
}

// ---------------------------------------------------------------- panel

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
  const q = useMemo(() => computeQuest(data.records, data.rules), [data.records, data.rules]);
  const missing = useMemo(() => missingSinceLatest(data.records, today), [data.records, today]);
  const keys = useMemo(() => sortedKeys(data.records), [data.records]);
  const rate = useMemo(() => recentRate(data.records, today, 28), [data.records, today]);

  useEffect(() => {
    if (open) {
      setMessage(null);
      setExportText(null);
      setTimeout(() => closeBtn.current?.focus(), 30);
      void viewerDownloads();
    }
  }, [open]);

  if (!open) return null;

  const name = data.profile.name || 'Zef';
  const close = () => useGame.getState().set({ parentOpen: false });

  const record = (date: DateKey, result: NightResult | null, closeAfter: boolean) => {
    const current = data.records[date];
    setConfirm({
      title:
        result === null
          ? `Clear ${formatKeyShort(date)}?`
          : current
            ? `Change ${formatKeyShort(date)} to "${resultLabel(result)}"?`
            : `Record the night before ${formatKeyShort(date)} as "${resultLabel(result)}"?`,
      body: <p>{consequence(data, date, result)}</p>,
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

  const doExport = async () => {
    const text = exportBackup(data);
    const filename = `dino-underpants-quest-backup-${today}.json`;
    setExportText(text);
    const viewer = await viewerDownloads();
    if (viewer) {
      try {
        await viewer.save({ filename, data: text });
        setMessage('Backup file saved.');
      } catch (e) {
        const code = (e as { code?: string } | null)?.code;
        setMessage(
          code === 'declined'
            ? 'Backup not saved. You can copy the text below instead.'
            : code === 'rate_limited'
              ? 'A save prompt is already open.'
              : 'Saving a file is not available here. Copy the backup text below instead.',
        );
      }
      return;
    }
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
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
          {res.dropped ? ` (${res.dropped} unreadable or future entries were skipped)` : ''}.
          {res.fromOldVersion ? ' It comes from the candy-castle version, so only the nights are brought over.' : ''} Your current
          history on this device will be replaced.
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

  const goal = data.rules.goal;
  const recorded = rate.dry + rate.wet;
  const p = recorded ? rate.dry / recorded : 0;
  const nextPrize = prizeAt(data.prizes, q.prizes);
  const toNext = q.nextPrizeAt - q.stars;

  const setPrize = (i: number, patch: Partial<Prize>) => {
    const list = data.prizes.map((x, k) => (k === i ? { ...x, ...patch } : x));
    useSave.getState().setPrizes(list);
  };

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
            This browser isn't letting the game save. Progress will last until the page closes — use Export backup to keep it.
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
            <>
              <p className="muted small">Usually {name} presses the big button. You can record it here instead.</p>
              <div className="row two">
                <button className="btn big dry" onClick={() => record(today, 'dry', true)}>
                  <SunIcon /> Dry
                </button>
                <button className="btn big wet" onClick={() => record(today, 'wet', true)}>
                  <HeartIcon /> Not dry
                </button>
              </div>
            </>
          )}
        </section>

        {missing.length > 0 && (
          <section className="card notice">
            <h2>Missing mornings</h2>
            <p>
              No record for {missing.length <= 3 ? missing.map((k) => formatKeyShort(k)).join(', ') : `${missing.length} mornings`} between the last
              record and today. A missing morning never counts as dry or not dry: it doesn't add a star and doesn't reset the underpants meter. Fill
              them in below if you know.
            </p>
          </section>
        )}

        <section className="card summary">
          <h2>{name}'s quest</h2>
          <dl>
            <div>
              <dt>Stars</dt>
              <dd>{q.stars}</dd>
            </div>
            <div>
              <dt>Underpants meter</dt>
              <dd>
                {Math.min(q.meter, goal)} of {goal}
              </dd>
            </div>
            <div>
              <dt>Best run</dt>
              <dd>{q.best} in a row</dd>
            </div>
            <div>
              <dt>Next prize</dt>
              <dd>
                {nextPrize.label} in {toNext} {toNext === 1 ? 'star' : 'stars'}
              </dd>
            </div>
            <div>
              <dt>Underpants</dt>
              <dd>{data.underpants.earned ? `Earned ${data.underpants.on ? formatKeyShort(data.underpants.on) : ''}${data.underpants.pick !== null ? ` (${UNDERPANTS[data.underpants.pick].name})` : ''}` : 'Not yet'}</dd>
            </div>
            <div>
              <dt>Last 4 weeks</dt>
              <dd>
                {rate.dry} dry · {rate.wet} not dry
              </dd>
            </div>
          </dl>
          <p className="muted small">The meter counts dry mornings since the last not-dry one. Stars never go away.</p>
        </section>

        <section className="card">
          <h2>Underpants goal</h2>
          <p className="muted small">Dry nights in a row needed to open the Underpants Store.</p>
          <div className="row stepper">
            <button className="btn" aria-label="Fewer nights" disabled={goal <= GOAL_MIN} onClick={() => useSave.getState().setGoal(goal - 1)}>
              −
            </button>
            <strong className="stepper-value">{goal} nights</strong>
            <button className="btn" aria-label="More nights" disabled={goal >= GOAL_MAX} onClick={() => useSave.getState().setGoal(goal + 1)}>
              +
            </button>
          </div>
          {recorded >= 7 ? (
            <p className="note">
              Lately {name} has been dry {rate.dry} of {recorded} recorded nights. At that rate, {goal} in a row takes {friendlyDuration(expectedWait(p, goal))} on
              average{p < 0.85 && goal > 10 ? ' — a smaller goal might feel more reachable for now; you can raise it later' : ''}.
            </p>
          ) : (
            <p className="muted small">After a week of mornings, this shows how long the goal is likely to take.</p>
          )}
          {data.underpants.earned && !q.goalReachedOn && (
            <button
              className="btn small ghost"
              onClick={() =>
                setConfirm({
                  title: 'Undo the underpants?',
                  body: <p>The records no longer reach the goal (maybe a button was pressed by mistake). This puts the Underpants Store back to "not yet".</p>,
                  confirm: 'Undo',
                  onConfirm: () => useSave.getState().undoUnderpants(),
                })
              }
            >
              Undo underpants
            </button>
          )}
        </section>

        <section className="card">
          <h2>Prizes</h2>
          <p className="muted small">
            A treasure chest opens at {prizeThreshold(0, data.rules)} stars, then every {data.rules.prizeEvery} stars. When the list runs out it starts over.
          </p>
          <ol className="prize-list">
            {data.prizes.map((pz, i) => (
              <li key={i} className="prize-row">
                <span className="prize-at">{prizeThreshold(i, data.rules)}★</span>
                <input aria-label={`${ordinal(i + 1)} prize`} value={pz.label} maxLength={40} onChange={(e) => setPrize(i, { label: e.target.value })} onBlur={(e) => !e.target.value.trim() && setPrize(i, { label: 'Prize' })} />
                <select aria-label={`${ordinal(i + 1)} prize picture`} value={pz.icon} onChange={(e) => setPrize(i, { icon: e.target.value as PrizeIcon })}>
                  {PRIZE_ICONS.map((ic) => (
                    <option key={ic.id} value={ic.id}>
                      {ic.label}
                    </option>
                  ))}
                </select>
                <button className="btn small ghost" aria-label={`Remove ${pz.label}`} disabled={data.prizes.length <= 1} onClick={() => useSave.getState().setPrizes(data.prizes.filter((_, k) => k !== i))}>
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ol>
          <button className="btn small" onClick={() => useSave.getState().setPrizes([...data.prizes, { label: 'Surprise', icon: 'gift' }])}>
            Add a prize
          </button>
          {q.prizes > 0 && (
            <>
              <h3>Earned</h3>
              <ul className="earned-list">
                {Array.from({ length: q.prizes }, (_, i) => (
                  <li key={i}>
                    <label className="toggle">
                      <input type="checkbox" checked={data.prizesGiven.includes(i)} onChange={(e) => useSave.getState().setPrizeGiven(i, e.target.checked)} />
                      <span>
                        {prizeAt(data.prizes, i).label} <span className="muted small">({prizeThreshold(i, data.rules)} stars) — handed over</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card">
          <h2>History</h2>
          <p className="muted small">One result per morning. Tap to correct any day; everything is recalculated.</p>
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
                      Not dry
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
              Not dry
            </button>
          </div>
        </section>

        <section className="card">
          <h2>
            <EyeIcon /> Preview
          </h2>
          <p className="muted small">Play any moment without changing real progress.</p>
          <div className="row">
            <button className="btn small" onClick={() => startPreview('dry')}>
              A dry morning
            </button>
            <button className="btn small" onClick={() => startPreview('wet')}>
              The hug
            </button>
            <button className="btn small" onClick={() => startPreview('prize')}>
              A prize chest
            </button>
            <button className="btn small" onClick={() => startPreview('store')}>
              The Underpants Store
            </button>
            <button className="btn small" onClick={() => startPreview('intro')}>
              Coach Rex's intro
            </button>
          </div>
        </section>

        <section className="card">
          <h2>{name}'s dino</h2>
          <label className="field">
            <span>Name</span>
            <input
              value={data.profile.name}
              maxLength={24}
              onChange={(e) => useSave.getState().setProfile({ name: e.target.value })}
              onBlur={(e) => !e.target.value.trim() && useSave.getState().setProfile({ name: 'Zef' })}
            />
          </label>
          <p className="muted small">Coach Rex's recorded voice says "Zef"; with another name he says "buddy" instead.</p>
          <div className="row">
            {SPECIES.map((s) => (
              <button key={s.id} className={`btn small${data.profile.species === s.id ? ' primary' : ''}`} onClick={() => useSave.getState().setProfile({ species: s.id })}>
                {s.name}
              </button>
            ))}
          </div>
          <div className="swatches small-swatches">
            {DINO_COLORS.map((c, i) => (
              <button key={c.name} className={`swatch${i === data.profile.color ? ' on' : ''}`} style={{ background: c.body }} aria-label={c.name} onClick={() => useSave.getState().setProfile({ color: i })} />
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Settings</h2>
          <label className="toggle">
            <input
              type="checkbox"
              checked={data.settings.sound}
              onChange={(e) => {
                useSave.getState().setSettings({ sound: e.target.checked });
                setSoundOn(e.target.checked);
              }}
            />
            <span>Sound and Coach Rex's voice</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={data.settings.music}
              onChange={(e) => {
                useSave.getState().setSettings({ music: e.target.checked });
                setMusicOn(e.target.checked);
                if (e.target.checked) music.start();
              }}
            />
            <span>Background music</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={data.settings.reducedMotion} onChange={(e) => useSave.getState().setSettings({ reducedMotion: e.target.checked })} />
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
            <>
              <textarea id="backup-text" className="code" readOnly value={exportText} rows={5} aria-label="Backup text" onFocus={(e) => e.currentTarget.select()} />
              <button
                className="btn small"
                onClick={() => {
                  const select = () => {
                    const el = document.getElementById('backup-text') as HTMLTextAreaElement | null;
                    el?.focus();
                    el?.select();
                  };
                  try {
                    navigator.clipboard
                      .writeText(exportText)
                      .then(() => setMessage('Backup text copied.'))
                      .catch(() => {
                        select();
                        setMessage('Select the text above and copy it.');
                      });
                  } catch {
                    select();
                    setMessage('Select the text above and copy it.');
                  }
                }}
              >
                Copy backup text
              </button>
            </>
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
          <h2>Start a new quest</h2>
          <p className="muted small">Clears every recorded night, the stars, the prizes and the underpants on this device. Keeps the dino, the prize list and the goal.</p>
          <button
            className="btn danger"
            onClick={() =>
              setConfirm({
                title: 'Start a brand-new quest?',
                body: <p>All recorded nights, stars, opened chests and the underpants will be cleared. This can't be undone (unless you exported a backup).</p>,
                confirm: 'Start new quest',
                tone: 'danger',
                onConfirm: () => {
                  useSave.getState().startNewQuest();
                  useGame.getState().set({ shownStars: 0, shownMeter: 0, shownAccessories: 0, openedChests: 0, land: 0, showUnderpants: false });
                  resetBoardView();
                  setMessage('A new quest is ready.');
                },
              })
            }
          >
            Start new quest
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
