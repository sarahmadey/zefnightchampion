// The title screen's stage: Coach Rex in the middle with every child's dino
// beside him, each in the outfit they've collected (or, the very first time,
// one of each kind of dino), all waving and wiggling while the camera
// drifts. Tapping a child's dino starts that child's adventure.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Dino } from '../dino/Dino';
import { cam, frameDt, makeActor, play, type DinoAction, type DinoActor } from '../game/actors';
import { childList, useGame, useSave } from '../state/store';
import { computeQuest } from '../state/progress';
import { DINO_COLORS, SPECIES, accessoriesUnlocked, resolveOutfit, type DinoColor, type Slot, type Species } from '../game/rewards';
import { COACH_COLOR } from '../board/Board';
import { playChild } from '../game/director';
import { sfx } from '../audio/sfx';
import { motion } from '../game/settings';
import { SETUP_ORIGIN, StageSet } from './SetupStage';
import type { SaveData } from '../state/save';

const MAX_CAST = 4;
const titleCoach: DinoActor = { ...makeActor(SETUP_ORIGIN.x, SETUP_ORIGIN.z - 1.1), heading: 0, scale: 1.6 };
const castActors: DinoActor[] = Array.from({ length: MAX_CAST }, () => ({ ...makeActor(SETUP_ORIGIN.x, SETUP_ORIGIN.z), heading: 0, scale: 1.3 }));

interface CastMember {
  key: string;
  childId: string | null;
  species: Species;
  color: DinoColor;
  outfit: Partial<Record<Slot, number>>;
  pants: number | null;
}

/** What a child's dino wears: what they've collected, as they last chose it. */
function outfitOf(d: SaveData): Partial<Record<Slot, number>> {
  const q = computeQuest(d.records, d.rules);
  return resolveOutfit(accessoriesUnlocked(Math.min(d.seen.stars, q.stars)), d.outfit);
}

/** Where each of n dinos stands, with Coach Rex behind the middle. */
function layout(n: number): { coachX: number; xs: number[] } {
  if (n <= 1) return { coachX: -0.75, xs: [0.95] };
  const gap = n >= 4 ? 1.62 : 1.85;
  return { coachX: 0, xs: Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * gap) };
}

const MOVES: DinoAction[] = ['wave', 'cheer', 'giggle', 'wave', 'spin', 'nod'];

export function TitleStage() {
  const library = useSave((s) => s.library);
  const cast = useMemo<CastMember[]>(() => {
    const kids = childList(library).filter((c) => c.data.profile.setupDone && c.data.profile.name.trim());
    if (!kids.length) {
      return SPECIES.map((sp, i) => ({ key: sp.id, childId: null, species: sp.id, color: DINO_COLORS[i % DINO_COLORS.length], outfit: {}, pants: null }));
    }
    return kids.slice(0, MAX_CAST).map((k) => ({
      key: k.id,
      childId: k.id,
      species: k.data.profile.species,
      color: DINO_COLORS[k.data.profile.color] ?? DINO_COLORS[0],
      outfit: outfitOf(k.data),
      pants: k.data.underpants.earned && k.data.seen.underpants ? k.data.underpants.pick : null,
    }));
  }, [library]);

  const placed = useRef('');
  const st = useRef({ t: 0, next: 1.2, base: new THREE.Vector3(), target: new THREE.Vector3() });
  useFrame((_, raw) => {
    const dt = frameDt(raw);
    const s = st.current;
    s.t += dt;
    const sig = cast.map((c) => c.key).join('|');
    if (placed.current !== sig) {
      placed.current = sig;
      const { coachX, xs } = layout(cast.length);
      titleCoach.pos.set(SETUP_ORIGIN.x + coachX, 0.12, SETUP_ORIGIN.z - 1.1);
      cast.forEach((_, i) => {
        const a = castActors[i];
        a.pos.set(SETUP_ORIGIN.x + xs[i], 0.12, SETUP_ORIGIN.z + 0.55 - Math.abs(xs[i]) * 0.12);
        a.heading = -xs[i] * 0.08;
        a.visible = true;
      });
      for (let i = cast.length; i < MAX_CAST; i++) castActors[i].visible = false;
      // frame the whole cast: closer for one or two dinos, wider for four
      const fit = [4.4, 4.4, 5.2, 6.2, 7.2][Math.min(MAX_CAST, cast.length)];
      s.target.set(SETUP_ORIGIN.x, 1.0, SETUP_ORIGIN.z - 0.3);
      s.base.set(SETUP_ORIGIN.x, 2.2, SETUP_ORIGIN.z + 1.0 + fit * 0.95);
      if (useGame.getState().phase === 'title') {
        cam.mode = 'shot';
        cam.pos.copy(s.base);
        cam.target.copy(s.target);
        cam.fitWidth = fit;
      }
    }
    // now and then someone waves, cheers or giggles
    s.next -= dt;
    if (s.next <= 0) {
      s.next = 1.6 + Math.random() * 1.8;
      const pick = Math.floor(Math.random() * (cast.length + 1));
      const who = pick === cast.length ? titleCoach : castActors[pick];
      if (who.action.name === 'none') play(who, MOVES[Math.floor(Math.random() * MOVES.length)], 1.4);
    }
    // the camera drifts gently from side to side
    if (useGame.getState().phase === 'title' && cam.mode === 'shot' && !motion.reduced) {
      const ang = Math.sin(s.t * 0.17) * 0.22;
      const off = s.base.clone().sub(s.target);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      cam.pos.copy(s.target).add(off);
    }
  });

  return (
    <>
      <StageSet />
      <Dino
        actor={titleCoach}
        species="trex"
        color={COACH_COLOR}
        coach
        onTap={() => {
          play(titleCoach, 'giggle', 1.1);
          sfx.play('boing');
        }}
      />
      {cast.map((c, i) => (
        <Dino
          key={c.key}
          actor={castActors[i]}
          species={c.species}
          color={c.color}
          outfit={c.outfit}
          underpants={c.pants}
          hit={0.95}
          onTap={() => {
            if (c.childId) {
              playChild(c.childId);
              return;
            }
            play(castActors[i], 'giggle', 1);
            sfx.play('giggle');
          }}
        />
      ))}
    </>
  );
}
