// The seven lands of Dino Land, in the order Zef travels through them. Each
// has its own sky, ground, stepping-stone colours and decorations. After the
// seventh land the journey loops round to the jungle again.

import type * as THREE from 'three';
import {
  bonesGeometry,
  crystalGeometry,
  iceCrystalGeometry,
  mushroomGeometry,
  shellGeometry,
  snowballsGeometry,
  starfishGeometry,
  steamVentGeometry,
  tumbleweedGeometry,
  umbrellaGeometry,
  beachBallGeometry,
  balloonGeometry,
} from './props';
import { boulder, bush, cactus, fern, grassTuft, log, palm, pine, wildflower } from './nature';

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
  /** low enough to grow in front of the camera */
  low?: boolean;
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
      { geo: () => palm(0), count: 9, scale: [0.9, 1.25], clear: 3.4, maxX: 15, sway: 0.03, shadow: true, edge: true },
      { geo: () => palm(1), count: 7, scale: [0.9, 1.2], clear: 3.4, maxX: 15, sway: 0.03, shadow: true, edge: true },
      { geo: () => fern(0), count: 34, scale: [0.8, 1.3], clear: 1.35, maxX: 13, sway: 0.06, low: true },
      { geo: () => bush(0), count: 14, scale: [0.8, 1.3], clear: 2.0, maxX: 15, shadow: true },
      { geo: () => bush(1, '#1d5e2a', '#9ad35a'), count: 10, scale: [0.6, 1.0], clear: 1.8, maxX: 14 },
      { geo: () => grassTuft(0, '#3d8a2c', '#b5e26a', 16, 0.16, 1.4), count: 260, scale: [0.8, 1.3], clear: 0.95, maxX: 12, sway: 0.25, low: true },
      { geo: () => grassTuft(5, '#4a9a34', '#a8dc5e', 11, 0.2, 0.9), count: 720, scale: [0.7, 1.1], clear: 0.85, maxX: 6, sway: 0.3, low: true },
      { geo: () => wildflower('#ff6b9a'), count: 22, scale: [0.8, 1.3], clear: 1.2, maxX: 11, sway: 0.12, low: true },
      { geo: () => wildflower('#ffa94d', '#fff3bf', 5), count: 18, scale: [0.8, 1.3], clear: 1.2, maxX: 11, sway: 0.12, low: true },
      { geo: () => mushroomGeometry('#ff6b6b'), count: 6, scale: [0.6, 1.1], clear: 1.4, maxX: 10 },
      { geo: () => boulder(0, '#8f989f', '#6a9a3a'), count: 9, scale: [0.5, 1.2], clear: 1.6, maxX: 13, shadow: true },
      { geo: log, count: 3, scale: [0.8, 1.0], clear: 2.6, maxX: 11 },
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
      { geo: () => boulder(1, '#4f4444', null, 0.8), count: 18, scale: [0.6, 1.6], clear: 1.8, maxX: 15, shadow: true },
      { geo: () => boulder(2, '#6b5656'), count: 12, scale: [0.4, 1.0], clear: 1.4, maxX: 13 },
      { geo: () => bush(3, '#7a2a12', '#f08c3a'), count: 12, scale: [0.6, 1.1], clear: 1.8, maxX: 14 },
      { geo: () => fern(1), count: 12, scale: [0.7, 1.1], clear: 1.4, maxX: 13, sway: 0.06, low: true },
      { geo: () => grassTuft(1, '#6b5a2a', '#c9a24a'), count: 154, scale: [0.7, 1.2], clear: 1.0, maxX: 12, sway: 0.25, low: true },
      { geo: steamVentGeometry, count: 5, scale: [0.9, 1.3], clear: 2.2, maxX: 10, glow: '#ff922b' },
      { geo: () => wildflower('#ffd43b', '#ff6b6b'), count: 14, scale: [0.8, 1.2], clear: 1.2, maxX: 11, sway: 0.12, low: true },
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
      { geo: () => palm(2), count: 12, scale: [0.9, 1.3], clear: 3.2, maxX: 15, sway: 0.03, shadow: true, edge: true },
      { geo: () => grassTuft(2, '#7f8f3f', '#d9cf86'), count: 154, scale: [0.8, 1.3], clear: 1.0, maxX: 13, sway: 0.25, low: true },
      { geo: shellGeometry, count: 14, scale: [0.7, 1.2], clear: 1.0, maxX: 11 },
      { geo: starfishGeometry, count: 12, scale: [0.6, 1.0], clear: 1.0, maxX: 11 },
      { geo: umbrellaGeometry, count: 3, scale: [0.9, 1.0], clear: 2.6, maxX: 11, shadow: true },
      { geo: beachBallGeometry, count: 4, scale: [0.8, 1.0], clear: 1.6, maxX: 10 },
      { geo: () => boulder(3, '#a9b2bc'), count: 8, scale: [0.5, 1.1], clear: 1.6, maxX: 14 },
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
      { geo: () => cactus(0), count: 10, scale: [0.8, 1.2], clear: 2.0, maxX: 15, shadow: true },
      { geo: () => cactus(1), count: 8, scale: [0.6, 1.0], clear: 2.0, maxX: 15 },
      { geo: () => grassTuft(3, '#8a6a3a', '#d8b86a'), count: 132, scale: [0.7, 1.2], clear: 1.0, maxX: 12, sway: 0.25, low: true },
      { geo: bonesGeometry, count: 3, scale: [0.9, 1.2], clear: 2.6, maxX: 11, shadow: true },
      { geo: tumbleweedGeometry, count: 6, scale: [0.8, 1.2], clear: 1.4, maxX: 12 },
      { geo: () => boulder(4, '#c9784a', null, 0.85), count: 14, scale: [0.6, 1.6], clear: 1.8, maxX: 15, shadow: true },
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
      { geo: () => pine(0, true), count: 12, scale: [0.9, 1.5], clear: 2.6, maxX: 15, shadow: true, edge: true },
      { geo: () => pine(1, true), count: 8, scale: [0.7, 1.2], clear: 2.4, maxX: 15, shadow: true },
      { geo: snowballsGeometry, count: 10, scale: [0.7, 1.2], clear: 1.4, maxX: 12 },
      { geo: iceCrystalGeometry, count: 10, scale: [0.6, 1.1], clear: 1.6, maxX: 13, glow: '#74c0fc' },
      { geo: () => boulder(5, '#7f8ea6', '#ffffff'), count: 10, scale: [0.5, 1.2], clear: 1.6, maxX: 14, shadow: true },
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
      { geo: () => boulder(6, '#5f4f96'), count: 12, scale: [0.6, 1.4], clear: 1.6, maxX: 14, shadow: true },
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
      { geo: () => wildflower('#ff6b6b', '#ffd43b', 5), count: 24, scale: [0.9, 1.4], clear: 1.2, maxX: 12, sway: 0.12, low: true },
      { geo: () => wildflower('#ffd43b', '#e8590c', 8), count: 24, scale: [0.9, 1.4], clear: 1.2, maxX: 12, sway: 0.12, low: true },
      { geo: () => wildflower('#b197fc', '#fff3bf', 6), count: 20, scale: [0.9, 1.4], clear: 1.2, maxX: 12, sway: 0.12, low: true },
      { geo: () => wildflower('#ffffff', '#ffd43b', 8), count: 26, scale: [0.9, 1.4], clear: 1.1, maxX: 13, sway: 0.12, low: true },
      { geo: () => grassTuft(4, '#4f9e36', '#c2e874', 16, 0.16, 1.4), count: 280, scale: [0.8, 1.3], clear: 0.95, maxX: 12, sway: 0.25, low: true },
      { geo: () => grassTuft(6, '#5aa83c', '#c8ec7c', 11, 0.2, 0.9), count: 720, scale: [0.7, 1.1], clear: 0.85, maxX: 6, sway: 0.3, low: true },
      { geo: () => balloonGeometry('#ff8787'), count: 3, scale: [1, 1], clear: 2.4, maxX: 10, sway: 0.03 },
      { geo: () => balloonGeometry('#74c0fc'), count: 3, scale: [1, 1], clear: 2.4, maxX: 10, sway: 0.03 },
      { geo: () => bush(7, '#2b7a2f', '#a9e36a'), count: 10, scale: [0.8, 1.3], clear: 2.0, maxX: 15, shadow: true },
    ],
  },
];

export function themeFor(land: number): Theme {
  return THEMES[((land % THEMES.length) + THEMES.length) % THEMES.length];
}
