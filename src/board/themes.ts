// The seven lands of Dino Land, in the order Zef travels through them. Each
// has its own sky, ground, stepping-stone colours and decorations. After the
// seventh land the journey loops round to the jungle again.

import type * as THREE from 'three';
import {
  bonesGeometry,
  bushGeometry,
  cactusGeometry,
  crystalGeometry,
  emberBushGeometry,
  fernGeometry,
  flowerGeometry,
  iceCrystalGeometry,
  logGeometry,
  mushroomGeometry,
  palmGeometry,
  pineGeometry,
  rockGeometry,
  shellGeometry,
  snowballsGeometry,
  starfishGeometry,
  steamVentGeometry,
  tulipGeometry,
  tumbleweedGeometry,
  umbrellaGeometry,
  beachBallGeometry,
  balloonGeometry,
} from './props';

export interface DecorSpec {
  geo: () => THREE.BufferGeometry;
  count: number;
  scale: [number, number];
  /** stay at least this far from the path */
  clear: number;
  /** stay within |x| of this */
  maxX: number;
  sway?: number;
  shadow?: boolean;
  glow?: string;
  /** only on the outer edges (big trees, cacti) */
  edge?: boolean;
}

export interface Theme {
  name: string;
  sky: { zenith: string; mid: string; horizon: string; ground: string; sun: string };
  fog: string;
  ground: [string, string, string];
  path: string;
  stones: [string, string, string];
  sun: string;
  sunIntensity: number;
  hemi: [string, string];
  decor: DecorSpec[];
}

export const THEMES: Theme[] = [
  {
    name: 'Jungle Jumble',
    sky: { zenith: '#5aa9f0', mid: '#a9d8ff', horizon: '#e9f7d8', ground: '#b7e4a5', sun: '#fff1c1' },
    fog: '#d8f0d0',
    ground: ['#6cc35a', '#8fd16a', '#4fae4f'],
    path: '#e3c08a',
    stones: ['#ffd8a8', '#ffc9de', '#c3fae8'],
    sun: '#fff1d6',
    sunIntensity: 2.6,
    hemi: ['#eaf8ff', '#5f9f4a'],
    decor: [
      { geo: () => palmGeometry(0), count: 9, scale: [0.9, 1.25], clear: 3.4, maxX: 15, sway: 0.03, shadow: true, edge: true },
      { geo: () => palmGeometry(1), count: 7, scale: [0.9, 1.2], clear: 3.4, maxX: 15, sway: 0.03, shadow: true, edge: true },
      { geo: fernGeometry, count: 26, scale: [0.7, 1.3], clear: 1.6, maxX: 13, sway: 0.08 },
      { geo: () => bushGeometry(0), count: 16, scale: [0.7, 1.3], clear: 2.0, maxX: 15 },
      { geo: () => flowerGeometry('#ff6b9a'), count: 22, scale: [0.8, 1.3], clear: 1.2, maxX: 11, sway: 0.12 },
      { geo: () => flowerGeometry('#ffa94d', '#fff3bf'), count: 18, scale: [0.8, 1.3], clear: 1.2, maxX: 11, sway: 0.12 },
      { geo: () => mushroomGeometry('#ff6b6b'), count: 8, scale: [0.6, 1.1], clear: 1.4, maxX: 10 },
      { geo: () => rockGeometry(0, '#9aa5b1'), count: 8, scale: [0.5, 1.1], clear: 1.6, maxX: 13 },
      { geo: logGeometry, count: 3, scale: [0.8, 1.0], clear: 2.6, maxX: 11 },
    ],
  },
  {
    name: 'Volcano Valley',
    sky: { zenith: '#6f8fe0', mid: '#ffc6a0', horizon: '#ffe0b8', ground: '#e0a080', sun: '#ffd8a0' },
    fog: '#f6d2b8',
    ground: ['#c9925a', '#b97c49', '#d9a56a'],
    path: '#7a5a48',
    stones: ['#ffd43b', '#ff922b', '#ffa8a8'],
    sun: '#ffe2c0',
    sunIntensity: 2.5,
    hemi: ['#fff0e0', '#8a4a2a'],
    decor: [
      { geo: () => rockGeometry(1, '#5c4d4d'), count: 18, scale: [0.6, 1.6], clear: 1.8, maxX: 15, shadow: true },
      { geo: () => rockGeometry(2, '#7a5f5f'), count: 12, scale: [0.4, 1.0], clear: 1.4, maxX: 13 },
      { geo: emberBushGeometry, count: 14, scale: [0.7, 1.2], clear: 1.8, maxX: 14 },
      { geo: steamVentGeometry, count: 5, scale: [0.9, 1.3], clear: 2.2, maxX: 10, glow: '#ff922b' },
      { geo: () => cactusGeometry(5), count: 5, scale: [0.6, 0.9], clear: 2.2, maxX: 14, edge: true },
      { geo: () => flowerGeometry('#ffd43b', '#ff6b6b'), count: 14, scale: [0.8, 1.2], clear: 1.2, maxX: 11, sway: 0.12 },
    ],
  },
  {
    name: 'Splashy Lagoon',
    sky: { zenith: '#3fa7f5', mid: '#9fdcff', horizon: '#e8fbff', ground: '#bfe8f0', sun: '#ffffff' },
    fog: '#d6f4fb',
    ground: ['#f3dca2', '#ead090', '#f8e6b8'],
    path: '#e9c98a',
    stones: ['#99e9f2', '#ffc9de', '#fff3bf'],
    sun: '#ffffff',
    sunIntensity: 2.7,
    hemi: ['#f0fbff', '#c7a96a'],
    decor: [
      { geo: () => palmGeometry(2), count: 12, scale: [0.9, 1.3], clear: 3.2, maxX: 15, sway: 0.03, shadow: true, edge: true },
      { geo: shellGeometry, count: 14, scale: [0.7, 1.2], clear: 1.0, maxX: 11 },
      { geo: starfishGeometry, count: 12, scale: [0.6, 1.0], clear: 1.0, maxX: 11 },
      { geo: umbrellaGeometry, count: 3, scale: [0.9, 1.0], clear: 2.6, maxX: 11, shadow: true },
      { geo: beachBallGeometry, count: 4, scale: [0.8, 1.0], clear: 1.6, maxX: 10 },
      { geo: () => rockGeometry(3, '#b0b8c4'), count: 8, scale: [0.5, 1.1], clear: 1.6, maxX: 14 },
    ],
  },
  {
    name: 'Fossil Canyon',
    sky: { zenith: '#4f9df0', mid: '#ffd2a6', horizon: '#ffe8c8', ground: '#e6b07a', sun: '#ffe7b0' },
    fog: '#f8dcc0',
    ground: ['#e8a86a', '#d9945a', '#f0b97c'],
    path: '#c98a52',
    stones: ['#fff3bf', '#ffd8a8', '#d0bfff'],
    sun: '#fff0d0',
    sunIntensity: 2.7,
    hemi: ['#fff6e8', '#a86a3a'],
    decor: [
      { geo: () => cactusGeometry(0), count: 10, scale: [0.8, 1.2], clear: 2.0, maxX: 15, shadow: true },
      { geo: () => cactusGeometry(1), count: 8, scale: [0.6, 1.0], clear: 2.0, maxX: 15 },
      { geo: bonesGeometry, count: 3, scale: [0.9, 1.2], clear: 2.6, maxX: 11, shadow: true },
      { geo: tumbleweedGeometry, count: 6, scale: [0.8, 1.2], clear: 1.4, maxX: 12 },
      { geo: () => rockGeometry(4, '#d9804a'), count: 14, scale: [0.6, 1.6], clear: 1.8, maxX: 15 },
    ],
  },
  {
    name: 'Snowball Mountain',
    sky: { zenith: '#5b9ae8', mid: '#c4defa', horizon: '#f2f7ff', ground: '#e4edf8', sun: '#ffffff' },
    fog: '#e8f0fb',
    ground: ['#f4f8ff', '#e3ecfa', '#ffffff'],
    path: '#c8d6ea',
    stones: ['#a5d8ff', '#ffc9de', '#d0bfff'],
    sun: '#ffffff',
    sunIntensity: 2.4,
    hemi: ['#ffffff', '#9fb8d8'],
    decor: [
      { geo: () => pineGeometry(0), count: 18, scale: [0.9, 1.5], clear: 2.6, maxX: 15, shadow: true, edge: true },
      { geo: snowballsGeometry, count: 10, scale: [0.7, 1.2], clear: 1.4, maxX: 12 },
      { geo: iceCrystalGeometry, count: 10, scale: [0.6, 1.1], clear: 1.6, maxX: 13, glow: '#74c0fc' },
      { geo: () => rockGeometry(5, '#8a9bb5'), count: 8, scale: [0.5, 1.2], clear: 1.6, maxX: 14 },
    ],
  },
  {
    name: 'Crystal Caves',
    sky: { zenith: '#5b4bb0', mid: '#a58cf0', horizon: '#f0d8ff', ground: '#c8a8e8', sun: '#ffe8ff' },
    fog: '#e0cdf6',
    ground: ['#9d86d8', '#8a72c8', '#b49ae6'],
    path: '#d8c8f0',
    stones: ['#ffd8f0', '#c3fae8', '#fff3bf'],
    sun: '#fff0ff',
    sunIntensity: 2.2,
    hemi: ['#f8eaff', '#5a3f8a'],
    decor: [
      { geo: () => crystalGeometry(1, '#b197fc'), count: 14, scale: [0.7, 1.6], clear: 2.0, maxX: 15, glow: '#9775fa', shadow: true },
      { geo: () => crystalGeometry(2, '#63e6be'), count: 10, scale: [0.6, 1.3], clear: 2.0, maxX: 15, glow: '#38d9a9' },
      { geo: () => mushroomGeometry('#f783ac'), count: 14, scale: [0.7, 1.4], clear: 1.4, maxX: 12, glow: '#f783ac' },
      { geo: () => mushroomGeometry('#74c0fc'), count: 10, scale: [0.6, 1.2], clear: 1.4, maxX: 12, glow: '#74c0fc' },
      { geo: () => rockGeometry(6, '#6c5aa8'), count: 10, scale: [0.6, 1.3], clear: 1.6, maxX: 14 },
    ],
  },
  {
    name: 'Rainbow Meadow',
    sky: { zenith: '#4fa3f7', mid: '#b5dcff', horizon: '#fff2e0', ground: '#d8f0b8', sun: '#fff6d8' },
    fog: '#fdf0e0',
    ground: ['#8fd96a', '#a6e27c', '#7acb5c'],
    path: '#f0d49a',
    stones: ['#ffc9de', '#ffe066', '#a5d8ff'],
    sun: '#fff6e0',
    sunIntensity: 2.6,
    hemi: ['#fffaf0', '#6fae4a'],
    decor: [
      { geo: () => tulipGeometry('#ff6b6b'), count: 22, scale: [0.9, 1.4], clear: 1.2, maxX: 12, sway: 0.1 },
      { geo: () => tulipGeometry('#ffd43b'), count: 22, scale: [0.9, 1.4], clear: 1.2, maxX: 12, sway: 0.1 },
      { geo: () => tulipGeometry('#b197fc'), count: 18, scale: [0.9, 1.4], clear: 1.2, maxX: 12, sway: 0.1 },
      { geo: () => flowerGeometry('#ffffff'), count: 26, scale: [0.9, 1.4], clear: 1.1, maxX: 13, sway: 0.12 },
      { geo: () => balloonGeometry('#ff8787'), count: 3, scale: [1, 1], clear: 2.4, maxX: 10, sway: 0.03 },
      { geo: () => balloonGeometry('#74c0fc'), count: 3, scale: [1, 1], clear: 2.4, maxX: 10, sway: 0.03 },
      { geo: () => bushGeometry(7), count: 10, scale: [0.8, 1.3], clear: 2.0, maxX: 15 },
    ],
  },
];

export function themeFor(land: number): Theme {
  return THEMES[((land % THEMES.length) + THEMES.length) % THEMES.length];
}
