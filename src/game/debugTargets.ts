// Moving things automated checks may want to aim at (bubbles…). Cheap to keep.
import type * as THREE from 'three';

export const debugTargets = new Map<string, () => THREE.Vector3[]>();

/** Small state snapshots stops can expose to automated checks. */
export const debugState = new Map<string, () => unknown>();
