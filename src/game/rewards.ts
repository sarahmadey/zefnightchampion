// What each dry morning gives: one surprise from a rotation (an egg with a
// new accessory, a high five, a silly dance or a roar-off), the prizes the
// grown-ups set, and the underpants in the store. Everything here is derived
// from the star count, so replays and refreshes always show the same thing.

export type Slot = 'head' | 'face' | 'neck' | 'body' | 'feet' | 'prop';

export interface Accessory {
  id: string;
  name: string;
  slot: Slot;
}

export const ACCESSORIES: Accessory[] = [
  { id: 'cap', name: 'baseball cap', slot: 'head' },
  { id: 'shades', name: 'sunglasses', slot: 'face' },
  { id: 'soccer', name: 'soccer ball', slot: 'prop' },
  { id: 'jersey', name: 'basketball jersey', slot: 'body' },
  { id: 'party', name: 'party hat', slot: 'head' },
  { id: 'bowtie', name: 'bow tie', slot: 'neck' },
  { id: 'cowboy', name: 'cowboy hat', slot: 'head' },
  { id: 'cape', name: 'superhero cape', slot: 'body' },
  { id: 'crown', name: 'crown', slot: 'head' },
  { id: 'basketball', name: 'basketball', slot: 'prop' },
  { id: 'propeller', name: 'propeller hat', slot: 'head' },
  { id: 'medal', name: 'gold medal', slot: 'neck' },
  { id: 'sneakers', name: 'sneakers', slot: 'feet' },
  { id: 'sweatband', name: 'sweatband', slot: 'head' },
  { id: 'football', name: 'football', slot: 'prop' },
  { id: 'pirate', name: 'pirate hat', slot: 'head' },
  { id: 'scarf', name: 'scarf', slot: 'neck' },
  { id: 'tutu', name: 'tutu', slot: 'body' },
  { id: 'chef', name: 'chef hat', slot: 'head' },
  { id: 'viking', name: 'viking helmet', slot: 'head' },
  { id: 'trophy', name: 'trophy', slot: 'prop' },
  { id: 'wizard', name: 'wizard hat', slot: 'head' },
  { id: 'boots', name: 'rain boots', slot: 'feet' },
  { id: 'goggles', name: 'swim goggles', slot: 'face' },
];

export type Surprise = 'egg' | 'highfive' | 'dance' | 'roar';

const AFTER_EGGS: Surprise[] = ['highfive', 'dance', 'roar'];

/** The surprise that star number `star` (1-based) brings. */
export function surpriseFor(star: number): Surprise {
  if (star < 1) return 'highfive';
  const eggStars = ACCESSORIES.length * 2;
  if (star <= eggStars && star % 2 === 1) return 'egg';
  const k = star <= eggStars ? star / 2 - 1 : star - eggStars - 1;
  return AFTER_EGGS[((k % 3) + 3) % 3];
}

/** The accessory hatched by star `star`, or null if that star isn't an egg. */
export function accessoryForStar(star: number): number | null {
  return surpriseFor(star) === 'egg' ? (star - 1) / 2 : null;
}

/** How many accessories `stars` stars have unlocked. */
export function accessoriesUnlocked(stars: number): number {
  return Math.min(ACCESSORIES.length, Math.ceil(Math.max(0, stars) / 2));
}

/** The newest accessory in each slot among those unlocked: what the dino wears by default. */
export function defaultOutfit(unlocked: number): Partial<Record<Slot, number>> {
  const out: Partial<Record<Slot, number>> = {};
  for (let i = 0; i < Math.min(unlocked, ACCESSORIES.length); i++) out[ACCESSORIES[i].slot] = i;
  return out;
}

// ---------------------------------------------------------------- prizes

export type PrizeIcon = 'candy' | 'movie' | 'burger' | 'squishy' | 'pizza' | 'icecream' | 'toy' | 'park' | 'book' | 'gift';

export const PRIZE_ICONS: { id: PrizeIcon; label: string }[] = [
  { id: 'candy', label: 'Candy' },
  { id: 'movie', label: 'Movie' },
  { id: 'burger', label: 'Burger and fries' },
  { id: 'squishy', label: 'Squishy' },
  { id: 'pizza', label: 'Pizza' },
  { id: 'icecream', label: 'Ice cream' },
  { id: 'toy', label: 'Toy' },
  { id: 'park', label: 'Park trip' },
  { id: 'book', label: 'Book' },
  { id: 'gift', label: 'Present' },
];

export interface Prize {
  label: string;
  icon: PrizeIcon;
}

export const DEFAULT_PRIZES: Prize[] = [
  { label: 'Candy', icon: 'candy' },
  { label: 'Movie night', icon: 'movie' },
  { label: "McDonald's", icon: 'burger' },
  { label: 'Squishy', icon: 'squishy' },
  { label: 'Candy', icon: 'candy' },
  { label: 'Pizza party', icon: 'pizza' },
];

/** The prize for prize number `i` (0-based); the list starts over when it runs out. */
export function prizeAt(prizes: Prize[], i: number): Prize {
  const list = prizes.length ? prizes : DEFAULT_PRIZES;
  return list[((i % list.length) + list.length) % list.length];
}

// ------------------------------------------------------------ underpants

export interface UnderpantsDesign {
  id: string;
  name: string;
  base: string;
  accent: string;
  motif: 'spots' | 'bolts' | 'stripes' | 'flames' | 'stars' | 'dots';
}

export const UNDERPANTS: UnderpantsDesign[] = [
  { id: 'dino', name: 'Dino spots', base: '#5cc461', accent: '#2f8a3a', motif: 'spots' },
  { id: 'bolt', name: 'Lightning', base: '#3d8bff', accent: '#ffd43b', motif: 'bolts' },
  { id: 'rainbow', name: 'Rainbow stripes', base: '#ff6b6b', accent: '#ffd43b', motif: 'stripes' },
  { id: 'volcano', name: 'Volcano', base: '#e8452c', accent: '#ffb347', motif: 'flames' },
  { id: 'stars', name: 'Night stars', base: '#2b3a8c', accent: '#ffd43b', motif: 'stars' },
  { id: 'dots', name: 'Purple dots', base: '#9b5de5', accent: '#ffffff', motif: 'dots' },
];

// ---------------------------------------------------------------- dinos

export type Species = 'trex' | 'trike' | 'stego' | 'longneck';

export const SPECIES: { id: Species; name: string }[] = [
  { id: 'trex', name: 'T. rex' },
  { id: 'trike', name: 'Triceratops' },
  { id: 'stego', name: 'Stegosaurus' },
  { id: 'longneck', name: 'Long-neck' },
];

export interface DinoColor {
  name: string;
  body: string;
  belly: string;
  accent: string;
}

export const DINO_COLORS: DinoColor[] = [
  { name: 'Green', body: '#5cc461', belly: '#e9f7b8', accent: '#ff9f43' },
  { name: 'Blue', body: '#4da3ff', belly: '#d8f0ff', accent: '#ffd43b' },
  { name: 'Orange', body: '#ff8c3a', belly: '#ffe9c2', accent: '#3fbf9f' },
  { name: 'Purple', body: '#a678f0', belly: '#f1e6ff', accent: '#5ce1a6' },
  { name: 'Red', body: '#f2545b', belly: '#ffe1d6', accent: '#ffd43b' },
  { name: 'Yellow', body: '#f7c531', belly: '#fff6d1', accent: '#ff6b9a' },
];
