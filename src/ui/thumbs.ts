// Little pictures of the accessories for the wardrobe, drawn from the same 3D
// models the dino wears, with a small renderer of their own (made when the
// wardrobe first opens and kept for next time).

import * as THREE from 'three';
import { showcaseModel } from '../board/EventProps';
import type { Species } from '../game/rewards';

const SIZE = 160;
let renderer: THREE.WebGLRenderer | null = null;
const cache = new Map<string, string>();

function scene(): { scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight('#ffffff', '#c9d8b8', 1.7));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4);
  sun.position.set(2, 3, 4);
  s.add(sun);
  const fill = new THREE.DirectionalLight('#fff4e0', 0.8);
  fill.position.set(-3, 1, 2);
  s.add(fill);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 10);
  camera.position.set(0, 0, 2.3);
  camera.lookAt(0, 0, 0);
  return { scene: s, camera };
}

/** A picture of accessory `index` as worn by a `species` dino (a data: URL), or null if it can't be drawn here. */
export function accessoryThumb(index: number, species: Species): string | null {
  const key = `${index}|${species}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(SIZE, SIZE, false);
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.setClearColor(0x000000, 0);
    }
    const { scene: s, camera } = scene();
    const model = showcaseModel(index, species);
    // a friendly three-quarter view
    model.rotation.set(0.3, -0.55, 0);
    s.add(model);
    renderer.render(s, camera);
    const url = renderer.domElement.toDataURL('image/png');
    cache.set(key, url);
    return url;
  } catch {
    return null;
  }
}
