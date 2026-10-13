"""Record Coach Rex's lines ahead of time.

Reads every line from src/voice/lines.ts (via node), speaks it with the
open-source Kokoro voice model, brightens and evens it out with ffmpeg, and
writes small MP3 clips to src/voice/clips/<id>.mp3. Clips whose text and
voice settings haven't changed are skipped, so re-running is cheap.

Usage (from the repo root):
  python scripts/voice/generate.py --models <dir with kokoro-v1.0.onnx and voices-v1.0.bin> [--voice am_fenrir] [--speed 1.2] [--pitch 1]

The game never synthesises speech while it runs; it only plays these files.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf
import librosa
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'src', 'voice', 'clips')


def load_lines():
    js = "import('./src/voice/lines.ts').then(m => console.log(JSON.stringify(m.LINES)))"
    res = subprocess.run(['node', '--experimental-strip-types', '--no-warnings', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def voice_style(k, spec):
    total = None
    for part in spec.split('+'):
        name, _, w = part.partition('*')
        v = k.get_voice_style(name) * (float(w) if w else 1.0)
        total = v if total is None else total + v
    return total


def speak(k, style, text, speed):
    parts = []
    sr = 24000
    for s in [s for s in re.split(r'(?<=[.!?])\s+', text) if s]:
        a, sr = k.create(s, voice=style, speed=speed, lang='en-us')
        a, _ = librosa.effects.trim(a, top_db=38)
        parts.append(a)
        parts.append(np.zeros(int(sr * (0.16 if s.endswith(('!', '?')) else 0.12)), dtype=np.float32))
    return np.concatenate(parts[:-1] if len(parts) > 1 else parts), sr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--models', required=True)
    ap.add_argument('--voice', default='am_fenrir')
    ap.add_argument('--speed', type=float, default=1.2)
    ap.add_argument('--pitch', type=float, default=1.0, help='semitones up')
    ap.add_argument('--only', default='', help='comma-separated ids to (re)record')
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    manifest_path = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    lines = load_lines()
    jobs = []
    for lid, line in lines.items():
        jobs.append((lid, line['text']))
        if line.get('nameless'):
            jobs.append((f'{lid}--nameless', line['nameless']))
    only = set(x for x in a.only.split(',') if x)
    k = Kokoro(os.path.join(a.models, 'kokoro-v1.0.onnx'), os.path.join(a.models, 'voices-v1.0.bin'))
    style = voice_style(k, a.voice)
    ratio = 2 ** (a.pitch / 12)
    fx = (f'rubberband=pitch={ratio:.4f}:formant=preserved,highpass=f=85,'
          'equalizer=f=3000:t=q:w=1.2:g=3,equalizer=f=250:t=q:w=1:g=-2,'
          'acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=2,'
          'loudnorm=I=-16:TP=-1.5:LRA=9')
    done = 0
    for lid, text in jobs:
        key = hashlib.sha1(f'{text}|{a.voice}|{a.speed}|{a.pitch}'.encode()).hexdigest()[:12]
        dst = os.path.join(OUT, f'{lid}.mp3')
        if only and lid not in only and lid.split('--')[0] not in only:
            continue
        if not a.force and manifest.get(lid) == key and os.path.exists(dst):
            continue
        audio, sr = speak(k, style, text, a.speed)
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            sf.write(tmp.name, audio, sr)
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp.name, '-af', fx, '-ar', '24000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '48k', dst], check=True)
            os.unlink(tmp.name)
        manifest[lid] = key
        done += 1
        print(f'{lid}: {text}', flush=True)
    json.dump(manifest, open(manifest_path, 'w'), indent=1, sort_keys=True)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.endswith('.mp3'))
    print(f'recorded {done} clips; {len([f for f in os.listdir(OUT) if f.endswith(".mp3")])} clips, {total / 1024:.0f} KB in total')


if __name__ == '__main__':
    sys.exit(main())
