// All fifteen surprises placed along the route.

import { Stop01Gate } from './Stop01Gate';
import { Stop02Beetles } from './Stop02Beetles';
import { Stop03JamSlide } from './Stop03JamSlide';
import { Stop04Cloud } from './Stop04Cloud';
import { Stop05BubbleSheep } from './Stop05BubbleSheep';
import { Stop06Windmill } from './Stop06Windmill';
import { Stop07LemonBoat } from './Stop07LemonBoat';
import { Stop08Braid } from './Stop08Braid';
import { Stop09Whale } from './Stop09Whale';
import { Stop10Door } from './Stop10Door';
import { Stop11Fireflies } from './Stop11Fireflies';
import { Stop12Carousel } from './Stop12Carousel';
import { Stop13Lanterns, Stop14Towers, Stop15Doors } from './Stop13to15';

export function Stops() {
  return (
    <group>
      <Stop01Gate />
      <Stop02Beetles />
      <Stop03JamSlide />
      <Stop04Cloud />
      <Stop05BubbleSheep />
      <Stop06Windmill />
      <Stop07LemonBoat />
      <Stop08Braid />
      <Stop09Whale />
      <Stop10Door />
      <Stop11Fireflies />
      <Stop12Carousel />
      <Stop13Lanterns />
      <Stop14Towers />
      <Stop15Doors />
    </group>
  );
}
