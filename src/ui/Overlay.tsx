// The thin HTML layer over the 3D game: scene fades, the hug message and
// its single big button, the preview banner, the sound toggle and the
// parent corner. Everything Zef plays with lives in the 3D scene.

import { useEffect, useState } from 'react';
import { useGame, useSave } from '../state/store';
import { endPreview, finishHug } from '../game/director';
import { ParentButton, ParentPanel } from './ParentArea';
import { HouseIcon, SoundOffIcon, SoundOnIcon } from './icons';
import { sfx } from '../audio/sfx';
import { STOP_NAMES } from '../game/route';

function Fade() {
  const fade = useGame((s) => s.fade);
  return <div className="fade" style={{ opacity: fade }} aria-hidden />;
}

function HugCaption() {
  const show = useGame((s) => s.hugCaption);
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    if (show) setPressed(false);
  }, [show]);
  if (!show) return null;
  return (
    <div className="hug-caption" role="dialog" aria-label="A hug from Pip">
      <p className="hug-text">I'm right here, Zef. Tonight we can set off together again.</p>
      <button
        className="hug-btn"
        disabled={pressed}
        onClick={() => {
          if (pressed) return;
          setPressed(true);
          sfx.play('tap');
          finishHug();
        }}
      >
        <HouseIcon />
        <span>Back to the cottage</span>
      </button>
    </div>
  );
}

function PreviewBanner() {
  const preview = useGame((s) => s.preview);
  if (!preview) return null;
  const label = preview.kind === 'hug' ? 'the hug' : `stop ${preview.stop}: ${STOP_NAMES[preview.stop]}`;
  return (
    <div className="preview-banner" role="status">
      <span>
        Preview of {label} — real progress is unchanged
      </span>
      <button className="btn small" onClick={() => endPreview()}>
        End preview
      </button>
    </div>
  );
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
        if (!on) setTimeout(() => sfx.play('sparkle'), 60);
      }}
    >
      {on ? <SoundOnIcon /> : <SoundOffIcon />}
    </button>
  );
}

function FirstRunNote() {
  const busy = useGame((s) => s.cutscene !== null || s.scene !== 'world' || s.preview !== null);
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem('zefs-dry-night-quest:welcomed');
    } catch {
      return false;
    }
  });
  if (!show || busy) return null;
  return (
    <div className="welcome" role="note">
      <p>
        <strong>Grown-ups:</strong> each morning, press and hold the moon button (top right) to record the night. Dry
        nights move Zef toward the candy castle.
      </p>
      <button
        className="btn small"
        onClick={() => {
          setShow(false);
          try {
            localStorage.setItem('zefs-dry-night-quest:welcomed', '1');
          } catch {
            /* ignore */
          }
        }}
      >
        Got it
      </button>
    </div>
  );
}

export function Overlay() {
  const parentOpen = useGame((s) => s.parentOpen);
  return (
    <>
      <Fade />
      <div className="hud" aria-hidden={parentOpen}>
        <SoundToggle />
        <ParentButton />
      </div>
      <PreviewBanner />
      <HugCaption />
      <FirstRunNote />
      <ParentPanel />
    </>
  );
}
