// Inside the candy castle: the grand caramel-fountain hall and the secret
// moonlit candy garden behind it.

import { useGame } from '../state/store';
import { CastleHall } from './CastleHall';
import { MoonGarden } from './MoonGarden';

export function CastleInterior() {
  const room = useGame((s) => s.room);
  return room === 'garden' ? <MoonGarden key="garden" /> : <CastleHall key="hall" />;
}
