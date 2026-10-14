# Zef's Dino Underpants Quest

A morning ritual for a four-year-old learning to stay dry at night. Zef
wakes up, runs to a grown-up, and presses one big button himself: the
smiling sun for a dry night, or the heart for a not-dry night. Coach Rex,
a big friendly T. rex, does the rest.

Everything you see is built in code with React Three Fiber and Three.js:
the dinosaurs, the lands, the plants and the effects. The dinosaurs are
sculpted when the game loads: each is one smooth, skinned body blended from
soft shapes (a snout and jaw with teeth, muscled legs, clawed toes, a long
tail, a scaly skin with a banded belly) over the skeleton the animations
drive. Coach Rex's voice is pre-recorded into small audio clips that ship
with the game. The game loads nothing from the internet and makes no AI
calls while it runs.

## The morning

1. **Tap to start.** Coach Rex says good morning.
2. **Press a button.**
   - **Dry!** A big star flies onto the next stepping stone, Zef's dino
     hops onto it, the underpants meter ticks up, and one surprise plays.
     The surprises rotate:
     - a mystery egg with a new accessory (caps, sunglasses, a basketball
       jersey, a soccer ball, sneakers, a cape and more)
     - a high five with Coach Rex
     - a dance party
     - a roar-off
   - **Not dry.** Coach Rex walks over for a big hug ("My arms are tiny,
     but my hugs are huge!"). The underpants meter starts fresh. Every star
     stays.
3. **See you tomorrow!** A replay button lets Zef watch it again. One press
   counts per morning, and refreshing never replays or double-counts.

## Two things to fill up

- **Stars (the board).** Every dry morning is a star, and stars never go
  away. The board winds through seven lands: Jungle Jumble, Volcano Valley,
  Splashy Lagoon, Fossil Canyon, Snowball Mountain, Crystal Caves and
  Rainbow Meadow. Each land ends at a treasure chest with a real-world
  prize. The first chest is at 10 stars, then one every 15 stars (25, 40,
  55, ...). The default prizes are candy, movie night, McDonald's, a
  squishy, candy, and a pizza party, then the list starts over. All of
  them can be edited.
- **The underpants meter.** This counts dry nights in a row and has the
  underpants at the top. When it fills, a pterodactyl flies Zef to the
  Underpants Store, where he picks his own dino underpants. His dino wears
  them from then on, and then it's time for the real ones. The default goal
  is 20 and can be changed.

A morning with no record is unknown. It never counts as dry or not dry: it
doesn't add a star and doesn't reset the meter.

## First time

1. A grown-up enters the name (Zef).
2. Zef picks his dino (T. rex, triceratops, stegosaurus or long-neck) and
   its color.
3. Coach Rex explains the mission.

## Parent corner

Press and hold the moon button (top right), then answer a quick
multiplication question. In the parent corner you can:

- record or correct any morning, with a note on exactly what will change
- see stars, the meter, the best run, the next prize and the last four
  weeks
- set the underpants goal; it shows how long the goal typically takes at
  the recent dry rate
- edit the prizes and tick off the ones you've handed over
- preview a dry morning, the hug, a prize chest, the Underpants Store or the
  intro, without changing real progress
- change the name, dino and color, and turn sound, music and reduced motion
  on or off
- back up and restore (old candy-castle backups bring their nights along)
- start a new quest

Progress is saved in this browser's local storage.

## Coach Rex's voice

The lines live in `src/voice/lines.ts`. `scripts/voice/generate.py` records
them into `src/voice/clips/` with the open-source Qwen3-TTS model, using its
built-in voice "Ryan" directed like a fun kids' TV host, with a mood for
each kind of line (cheering for dry mornings, gentle for hugs, giggly for
taps). It shortens long pauses and evens out the loudness with ffmpeg.
Every clip is checked before it's kept: a speech recognizer (Whisper) must
hear the right words, and a voice classifier must still hear a man; a clip
that fails is re-recorded. Re-running only re-records lines that changed.
Lines that say "Zef" have name-free twins ("buddy") used if the name is
changed.

To use a different voice, replace the clips with files of the same names.

```sh
pip install qwen-tts torch faster-whisper librosa soundfile
python scripts/voice/generate.py --models <folder with Qwen3-TTS-12Hz-1.7B-CustomVoice/, whisper-small.en/ and optionally agegender/>
```

## Developing

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # progress, save and voice-line tests
npm run build        # static site in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

`/lab.html` (dev server only) shows one dinosaur under studio lights, e.g.
`/lab.html?species=trex&color=0&view=34&outfit=0,1&pants=2`.

`?debug` in the URL exposes a small test API on `window.__dino`. With it
you can seed nights, press the buttons, run previews, and project dinos and
props to screen positions. The `scripts/dino-*.mjs` files use it with
Playwright to play through setup, mornings, chests, the store and the
parent corner.

### Layout

- `src/state`: dates, stars, the meter, prizes, save data, import/export
  (pure and unit tested)
- `src/game`: the director (every morning event), actors, camera, rewards
- `src/dino`: the sculpting kit (`sdf.ts`), skin shader, the sculpted T. rex
  and four-legged dinos, the animator, accessories, underpants
- `src/board`: the lands, path, chests, plants and rocks (`nature.ts`),
  landmarks, sky and lights
- `src/store`: the Underpants Store
- `src/setup`: the pick-your-dino stage
- `src/voice`: Coach Rex's lines and the clip player
- `src/audio`: sound effects and music, all synthesized
- `src/ui`: the big buttons, the meter, captions and the parent corner
