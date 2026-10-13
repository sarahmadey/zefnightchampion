import { it } from 'vitest';
import * as THREE from 'three';
import { pipedSwirl, puckGeometry, puffGeometry, strawberryGeometry, gumdropGeometry } from '../src/three/geometry';
import { strawberryPlantGeometry, cakeGeometry } from '../src/world/regions/Garden';
import { cottonTreeGeometry } from '../src/world/regions/Meadow';
import { waffleTreeGeometry } from '../src/world/regions/Woods';

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

it('profile', () => {
  const rows: [string, number][] = [
    ['swirl small', tris(pipedSwirl({ radius: 0.22, height: 0.28, thickness: 0.09, turns: 2.2 }))],
    ['strawberry 60', tris(strawberryGeometry(1, 60))],
    ['strawberry 24', tris(strawberryGeometry(1, 24))],
    ['plant v0', tris(strawberryPlantGeometry(0))],
    ['plant v2', tris(strawberryPlantGeometry(2))],
    ['cake 3', tris(cakeGeometry(3, 2.6, 1))],
    ['puck paver', tris(puckGeometry(0.3, 0.07, 18, 0.3))],
    ['puff d3', tris(puffGeometry(1, 9, 1.6, 3))],
    ['puff d2', tris(puffGeometry(1, 9, 1.6, 2))],
    ['cotton tree', tris(cottonTreeGeometry(0))],
    ['waffle tree', tris(waffleTreeGeometry(1))],
    ['gumdrop', tris(gumdropGeometry())],
  ];
  console.log(rows.map(([k, v]) => `${k}: ${Math.round(v)}`).join('\n'));
});
