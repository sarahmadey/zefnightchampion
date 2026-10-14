// Builds a dinosaur rig for a species: a skeleton the animator drives, wrapped
// in a sculpted, skinned body (see sculpted.ts and quads.ts).

import type { DinoColor, Species } from '../game/rewards';
import { buildTrex, type Anchors, type Eye, type Leg, type Rig } from './sculpted';
import { buildLongneck, buildStego, buildTrike } from './quads';

export type { Anchors, Eye, Leg, Rig };

export function buildRig(species: Species, color: DinoColor, opts: { coach?: boolean } = {}): Rig {
  switch (species) {
    case 'trex':
      return buildTrex(color, !!opts.coach);
    case 'trike':
      return buildTrike(color);
    case 'stego':
      return buildStego(color);
    case 'longneck':
      return buildLongneck(color);
  }
}
