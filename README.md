# Zef's Dry Night Quest

A small 3D candy adventure for a four-year-old that celebrates dry nights.
Every consecutive dry night moves Zef and his dragon friend Pip one stop
closer to a magnificent candy castle — fifteen stops, each with its own
playful surprise. On a wet morning, Pip gives Zef a huge, cozy hug and the
journey starts again from the cottage; everything Zef has discovered stays
in his keepsake collection.

Everything you see is built in code with React Three Fiber and Three.js:
characters, candy architecture, plants, water, particles and lighting. The
game loads no images, models, fonts or other external files, and it makes
no network requests.

## Playing

- **Tap the ground** to walk. Zef can roam everywhere the path lights are
  awake; future stops stay visible but sleepy until a dry night wakes them.
- **Tap a glowing surprise** to walk over and play. Each one is a gesture:
  swipe, tap, drag or spin. A friendly ghost glove shows how if Zef waits.
- **Tap Pip** any time for a giggle, a flip, a dance or a sparkly puff.
- **Tap the keepsake shelf** by the cottage to see (and play with) every
  surprise Zef has ever found.
- Once the castle is earned, a **candy balloon** by the cottage flies there
  any time, and the castle stays open until a grown-up starts a new adventure.

### The fifteen surprises

| Region | Stops |
| --- | --- |
| Strawberry Garden | 1 swipe open the strawberry-flower gate · 2 tap jellybean beetles into a parade · 3 send Pip down the jam slide |
| Marshmallow Cloud Meadow | 4 bounce on a marshmallow cloud · 5 drag bubbles into a silly bubble sheep · 6 spin the peppermint windmill (the breeze moves everything) |
| Lemonade River | 7 steer the lemon-slice boat across · 8 braid licorice into a little bridge · 9 pop fizzy bubbles until the bubble whale rises |
| Waffle Woodland | 10 knock on a waffle-tree door (a different friend each time) · 11 trace a path for the syrup fireflies · 12 spin the cookie carousel |
| Gumdrop Mountain | 13 light the gumdrop lanterns in any order · 14 tap castle towers to light their windows · 15 open the castle doors and go inside |

Inside the castle are the **caramel-fountain hall** (fountain, chandelier,
cake throne with a crown, licorice organ, gingerbread guards) and the
**secret moonlit candy garden** (singing flowers, moon pond, swing, sleepy
owl, a winking moon and shooting stars).

## Parent corner

Press and hold the moon button (top right), then answer a quick
multiplication question.

- **Dry night / Wet night** for last night, each with a confirmation that
  says exactly what will happen.
- **Dated history**: one result per local morning. Correct any day; the
  streak is recalculated. Unrecorded nights are shown as *Not recorded*.
  They never count as dry or wet, but a streak only continues across nights
  recorded dry, and the panel explains this whenever there's a gap.
- **Preview** any stop's arrival or the hug without changing real progress.
- **Sound** (starts muted) and **reduced motion** settings.
- **Backup**: export to a file (or copy the text) and import it again.
- **Start a new adventure** clears progress (with a second confirmation).

Progress is saved in this browser's local storage. Repeat taps and
refreshes never advance the journey twice: results are stored per date, and
the game remembers which arrivals and hugs Zef has already seen.

## Developing

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # progress / save logic unit tests
npm run build        # static site in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

`?debug` in the URL exposes a small test API on `window.__zef` (record
nights, preview stops, project objects to the screen). The scripts in
`scripts/` use it with Playwright to drive the game, film arrivals, the hug,
and every surprise.

### Layout

- `src/state` — dates, streaks, save data, import/export (pure, unit tested)
- `src/game` — route, movement, camera rig, director (cutscenes), actors
- `src/characters` — Zef and Pip, jointed rigs with procedural animation
- `src/world` — terrain, path, sky, cottage, castle, regions, keepsakes
- `src/stops` — the fifteen interactive surprises
- `src/scenes` — the hug nook and the castle rooms
- `src/three` — procedural geometry, candy materials, shaders, particles
- `src/ui` — the HTML overlay: parent corner, hug message, sound toggle
