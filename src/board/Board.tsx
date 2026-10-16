// The board scene: the land Zef is in (plus its neighbours), the path of
// stepping stones, the chests, the far-off Underpants Store, Zef's dino,
// Coach Rex, and the props that pop up during morning events.

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame, useSave } from '../state/store';
import { landOf, landRange } from '../state/progress';
import { Atmosphere } from './Atmosphere';
import { Land, NextRing } from './Land';
import { StoreLandmark } from './StoreLandmark';
import { EventProps } from './EventProps';
import { spacePos, storeLandmarkPos } from './layout';
import { Dino } from '../dino/Dino';
import { coach, hero } from '../game/actors';
import { boardView } from '../game/CameraRig';
import { DINO_COLORS, prizeAt, resolveOutfit, type DinoColor, type Slot } from '../game/rewards';
import { tapCoach, tapHero } from '../game/director';

export const COACH_COLOR: DinoColor = { name: 'Coach', body: '#2bb59f', belly: '#fff3bf', accent: '#ff922b' };

/** What the dino wears: the newest accessory per slot, unless the child picked something else. */
export function useOutfit(): Partial<Record<Slot, number>> {
  const shownAcc = useGame((s) => s.shownAccessories);
  const chosen = useSave((s) => s.data.outfit);
  return useMemo(() => resolveOutfit(shownAcc, chosen), [shownAcc, chosen]);
}

function BoardView({ stars, end }: { stars: number; end: number }) {
  useFrame(() => {
    boardView.anchor.copy(hero.pos);
    boardView.ahead.copy(spacePos(Math.min(stars + 4, end)));
  });
  return null;
}

export function Board() {
  const shown = useGame((s) => s.shownStars);
  const shownMeter = useGame((s) => s.shownMeter);
  const openedChests = useGame((s) => s.openedChests);
  const rules = useSave((s) => s.data.rules);
  const prizes = useSave((s) => s.data.prizes);
  const profile = useSave((s) => s.data.profile);
  const pick = useSave((s) => s.data.underpants.pick);
  const earned = useSave((s) => s.data.underpants.earned);
  const showPants = useGame((s) => s.showUnderpants);
  const previewPants = useGame((s) => s.previewUnderpants);
  const outfit = useOutfit();
  const land = landOf(shown, rules);
  const end = landRange(land, rules).end;
  const lands = [land - 1, land, land + 1].filter((l) => l >= 0);
  const color = DINO_COLORS[profile.color] ?? DINO_COLORS[0];
  return (
    <>
      <Atmosphere land={land} />
      {lands.map((l) => (
        <Land key={l} land={l} stars={shown} rules={rules} prize={prizeAt(prizes, l)} opened={openedChests > l} full={l >= land} />
      ))}
      <NextRing stars={shown} rules={rules} />
      <BoardView stars={shown} end={end} />
      <StoreLandmark position={storeLandmarkPos(land, rules)} meterFrac={earned ? 1 : Math.min(1, shownMeter / rules.goal)} />
      <Dino actor={hero} species={profile.species} color={color} outfit={outfit} underpants={previewPants ?? (earned && showPants ? pick : null)} onTap={() => tapHero()} />
      <Dino actor={coach} species="trex" color={COACH_COLOR} coach onTap={() => tapCoach()} />
      <EventProps />
    </>
  );
}
