// The HTML layer over the 3D board, designed for a four-year-old who can't
// read yet: two giant picture buttons (a smiling sun for "dry", a hugging
// heart for "not dry"), the star counter, the meter of dry nights in a row
// with the underwear at the top, and Coach Rex's words as a caption. Grown-up
// controls hide behind the moon button.

import { useEffect, useRef, useState } from 'react';
import { useGame, useQuest, useSave } from '../state/store';
import { collectPrize, endPreview, pressDry, pressWet, replayToday, setupDone, setupNameDone, setupPickColor, setupPickSpecies, skipIntro, startFromSplash } from '../game/director';
import { ParentButton, ParentPanel } from './ParentArea';
import { ArrowIcon, BigHeartIcon, BigSunIcon, ChestIcon, ReplayIcon, SoundOffIcon, SoundOnIcon, StarIcon, UnderpantsIcon } from './icons';
import { landRange, landOf } from '../state/progress';
import { DINO_COLORS, SPECIES } from '../game/rewards';
import { setSoundOn } from '../audio/core';
import { sfx } from '../audio/sfx';

function Fade() {
  const fade = useGame((s) => s.fade);
  return <div className="fade" style={{ opacity: fade }} aria-hidden />;
}

function SoundToggle() {
  const on = useSave((s) => s.data.settings.sound);
  return (
    <button
      className={`corner-btn sound-btn${on ? ' on' : ''}`}
      aria-label={on ? 'Turn sound off' : 'Turn sound on'}
      aria-pressed={on}
      onClick={() => {
        useSave.getState().setSettings({ sound: !on });
        setSoundOn(!on);
        if (!on) setTimeout(() => sfx.play('sparkle'), 60);
      }}
    >
      {on ? <SoundOnIcon /> : <SoundOffIcon />}
    </button>
  );
}

function StarCounter() {
  const shown = useGame((s) => s.shownStars);
  const scene = useGame((s) => s.scene);
  const highlight = useGame((s) => s.highlight);
  const rules = useSave((s) => s.data.rules);
  const [bump, setBump] = useState(false);
  const prev = useRef(shown);
  useEffect(() => {
    if (shown > prev.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 700);
      prev.current = shown;
      return () => clearTimeout(t);
    }
    prev.current = shown;
  }, [shown]);
  if (scene !== 'board') return null;
  const land = landOf(shown, rules);
  const end = landRange(land, rules).end;
  const left = end - shown;
  return (
    <div className={`star-counter${bump ? ' bump' : ''}${highlight === 'stars' ? ' glow' : ''}`} role="status" aria-label={`${shown} stars. ${left} more to the treasure chest.`}>
      <span className="star-total">
        <StarIcon size={34} />
        <b>{shown}</b>
      </span>
      <span className="chest-left" title="Stars to the next treasure chest">
        <ChestIcon size={26} />
        <b>{left}</b>
      </span>
    </div>
  );
}

function UnderwearMeter() {
  const meter = useGame((s) => s.shownMeter);
  const scene = useGame((s) => s.scene);
  const highlight = useGame((s) => s.highlight);
  const goal = useSave((s) => s.data.rules.goal);
  const earned = useSave((s) => s.data.underpants.earned);
  if (scene !== 'board') return null;
  const filled = Math.min(goal, meter);
  const dots = Array.from({ length: goal }, (_, i) => goal - 1 - i);
  return (
    <div className={`meter${highlight === 'meter' ? ' glow' : ''}${earned ? ' earned' : ''}`} role="img" aria-label={`Underwear meter: ${filled} of ${goal} dry nights in a row${earned ? ' — ready for underwear at night!' : ''}`}>
      <div className="meter-top">
        <UnderpantsIcon size={46} gold={earned || filled >= goal} />
      </div>
      <div className="meter-track" style={{ ['--n' as string]: goal }}>
        {dots.map((i) => (
          <span key={i} className={`meter-dot${i < filled ? ' on' : ''}${i === filled - 1 ? ' newest' : ''}`} />
        ))}
      </div>
      <div className="meter-count">
        {filled}/{goal}
      </div>
    </div>
  );
}

function Caption() {
  const caption = useGame((s) => s.caption);
  if (!caption) return null;
  return (
    <div className="caption" role="status" aria-live="polite">
      <p>{caption.text}</p>
    </div>
  );
}

function Splash() {
  const phase = useGame((s) => s.phase);
  const ready = useGame((s) => s.ready);
  if (phase !== 'splash') return null;
  return (
    <button className="splash" onClick={() => startFromSplash()} disabled={!ready} aria-label="Tap to start">
      <span className="splash-sun">
        <BigSunIcon />
      </span>
      <span className="splash-text">{ready ? 'Tap to start!' : 'Waking up the dinos...'}</span>
    </button>
  );
}

function MorningButtons() {
  const phase = useGame((s) => s.phase);
  const preview = useGame((s) => s.preview);
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    if (phase === 'ask') setPressed(false);
  }, [phase]);
  if (phase !== 'ask' || preview) return null;
  return (
    <div className="morning" role="group" aria-label="How was last night?">
      <button
        className="big-btn dry"
        disabled={pressed}
        onClick={() => {
          if (pressed) return;
          setPressed(true);
          pressDry();
        }}
        aria-label="Dry! I stayed dry"
      >
        <span className="big-icon">
          <BigSunIcon />
        </span>
        <span className="big-label">Dry!</span>
      </button>
      <button
        className="big-btn wet"
        disabled={pressed}
        onClick={() => {
          if (pressed) return;
          setPressed(true);
          pressWet();
        }}
        aria-label="Not dry. Hug time"
      >
        <span className="big-icon">
          <BigHeartIcon />
        </span>
        <span className="big-label">Not dry</span>
      </button>
    </div>
  );
}

function Done() {
  const phase = useGame((s) => s.phase);
  const cutscene = useGame((s) => s.cutscene);
  const quest = useQuest();
  if (phase !== 'done' || cutscene) return null;
  return (
    <div className="done">
      <div className="done-card">
        <span className="done-text">See you tomorrow!</span>
        <span className="done-sub">
          {quest.latest?.result === 'wet' ? 'Big hug! Tonight is a new try.' : 'Go potty before bed tonight!'}
        </span>
      </div>
      <button className="round-btn" onClick={() => replayToday()} aria-label="Watch it again">
        <ReplayIcon />
      </button>
    </div>
  );
}

/** The big button under the prize that floats out of the egg. */
function CollectButton() {
  const awaiting = useGame((s) => s.awaiting);
  if (awaiting !== 'collect') return null;
  return (
    <button className="collect-btn" onClick={() => collectPrize()} aria-label="Collect the prize">
      <StarIcon size={40} />
      <span>Collect!</span>
    </button>
  );
}

/** Only for a grown-up's preview: a "Watch it again" replay is just the game. */
function PreviewBanner() {
  const preview = useGame((s) => s.preview);
  const setupStep = useGame((s) => s.setupStep);
  if (!preview || preview.replay || preview.kind === 'intro' || setupStep) return null;
  return (
    <div className="preview-banner" role="status">
      <span>Grown-up preview</span>
      <button className="btn small" onClick={() => endPreview()}>
        Stop
      </button>
    </div>
  );
}

function SkipIntro() {
  const cut = useGame((s) => s.cutscene);
  const preview = useGame((s) => s.preview);
  if (!(cut?.startsWith('setup-done') || preview?.kind === 'intro')) return null;
  return (
    <button className="skip-btn" onClick={() => skipIntro()}>
      Skip intro <ArrowIcon />
    </button>
  );
}

// ----------------------------------------------------------- setup steps

function SetupName() {
  const name = useSave((s) => s.data.profile.name);
  const [value, setValue] = useState(name || 'Zef');
  return (
    <form
      className="setup-card"
      onSubmit={(e) => {
        e.preventDefault();
        setupNameDone(value);
      }}
    >
      <h1>Dino Underwear Quest</h1>
      <p className="muted">For grown-ups: who is going on this quest?</p>
      <label className="name-field">
        <span>Name</span>
        <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={24} autoComplete="off" />
      </label>
      <p className="muted small">Each morning your child presses one big button: the smiling sun for a dry night, the heart for a not-dry night. Coach Rex does the rest. Grown-up controls are behind the moon button.</p>
      <button className="btn primary big" type="submit">
        Next <ArrowIcon />
      </button>
    </form>
  );
}

function SetupDino() {
  return (
    <div className="setup-bottom" role="group" aria-label="Pick your dino">
      <p className="setup-hint">Pick your dino!</p>
      <div className="species-row">
        {SPECIES.map((s) => (
          <button key={s.id} className="btn chip-btn" onClick={() => setupPickSpecies(s.id)}>
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function SetupColor() {
  const color = useSave((s) => s.data.profile.color);
  const busy = useGame((s) => s.cutscene !== null);
  return (
    <div className="setup-bottom" role="group" aria-label="Pick a color">
      <div className="swatches">
        {DINO_COLORS.map((c, i) => (
          <button
            key={c.name}
            className={`swatch${i === color ? ' on' : ''}`}
            style={{ background: c.body }}
            aria-label={c.name}
            aria-pressed={i === color}
            onClick={() => setupPickColor(i)}
          />
        ))}
      </div>
      <button className="btn primary big go-btn" disabled={busy} onClick={() => setupDone()}>
        Let's go! <ArrowIcon />
      </button>
    </div>
  );
}

function useSetupStep() {
  const step = useGame((s) => s.setupStep);
  const scene = useGame((s) => s.scene);
  return step && scene === 'setup' ? step : null;
}

function Setup() {
  return useSetupStep() === 'name' ? <SetupName /> : null;
}

/** The setup choices that sit along the bottom edge. */
function SetupBottom() {
  const step = useSetupStep();
  if (step === 'dino') return <SetupDino />;
  if (step === 'color') return <SetupColor />;
  return null;
}

export function Overlay() {
  const parentOpen = useGame((s) => s.parentOpen);
  return (
    <>
      <Fade />
      <div className="hud" aria-hidden={parentOpen}>
        <SoundToggle />
        <ParentButton />
        <StarCounter />
        <UnderwearMeter />
        <SkipIntro />
        <Setup />
        <div className="dock">
          <Caption />
          <CollectButton />
          <MorningButtons />
          <Done />
          <SetupBottom />
        </div>
      </div>
      <Splash />
      <PreviewBanner />
      <ParentPanel />
    </>
  );
}
