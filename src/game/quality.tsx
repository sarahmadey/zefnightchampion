// Device-aware quality: smaller shadow maps on phones, and a governor that
// steps resolution and then shadows down if frames are consistently slow.

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
const small = typeof window !== 'undefined' && Math.min(window.screen?.width ?? 1200, window.screen?.height ?? 1200) < 820;

export const isPhoneLike = !!(coarse && small);

export const quality = {
  shadows: true,
  shadowSize: isPhoneLike ? 1024 : 2048,
  maxDpr: isPhoneLike ? 1.5 : 1.75,
};

/** Watches frame times; lowers pixel ratio, then turns shadows off, if needed. */
export function QualityGovernor({ enabled }: { enabled: boolean }) {
  const setDpr = useThree((s) => s.setDpr);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const st = useRef({ frames: 0, time: 0, cooldown: 4, dpr: Math.min(window.devicePixelRatio || 1, quality.maxDpr) });

  useEffect(() => {
    setDpr(st.current.dpr);
  }, [setDpr]);

  useFrame((_, dt) => {
    if (!enabled) return;
    const s = st.current;
    if (s.cooldown > 0) {
      s.cooldown -= dt;
      return;
    }
    s.frames++;
    s.time += dt;
    if (s.time < 3) return;
    const avg = s.time / s.frames;
    s.frames = 0;
    s.time = 0;
    if (avg < 1 / 40) return;
    if (s.dpr > 1.01) {
      s.dpr = Math.max(1, s.dpr - 0.25);
      setDpr(s.dpr);
      s.cooldown = 3;
    } else if (quality.shadows) {
      quality.shadows = false;
      gl.shadowMap.enabled = false;
      scene.traverse((o) => {
        const l = o as THREE.DirectionalLight;
        if (l.isLight) l.castShadow = false;
      });
      s.cooldown = 3;
    }
  });
  return null;
}
