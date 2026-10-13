// Shared plumbing for the fifteen surprises: a group placed in a stop's
// local frame, unlock/focus state, idle hints, interaction gating and a
// drag helper that turns pointer moves into points on a plane.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../state/store';
import { stopFrame } from '../game/route';
import { requestStopInteraction } from '../game/world';
import { bus } from '../game/bus';
import { frameDt } from '../game/actors';
import { useDistanceCull } from '../world/decor';

/**
 * Children use the stop's local frame: +x right of the path, -z forward.
 * Far-away stops are hidden (they'd be lost in the haze) to keep phones fast.
 */
export function StopFrame({ id, children, cull = 70 }: { id: number; children: ReactNode; cull?: number }) {
  const f = useMemo(() => stopFrame(id), [id]);
  const ref = useRef<THREE.Group>(null);
  useDistanceCull(ref, cull, f.origin, 6);
  return (
    <group ref={ref} position={f.origin} rotation={[0, f.yaw, 0]}>
      {children}
    </group>
  );
}

export interface StopState {
  unlocked: boolean;
  focused: boolean;
  /** show the gesture hint */
  hint: boolean;
  /** call on any meaningful interaction to reset the idle-hint timer */
  touch: () => void;
  /** gate a tap: walks Zef over first if needed; true when the surprise may react */
  ask: () => boolean;
}

export function useStop(id: number, idleHintAfter = 6): StopState {
  const lit = useGame((s) => s.litStop);
  const focus = useGame((s) => s.focusStop);
  const hintStop = useGame((s) => s.hintStop);
  const cutscene = useGame((s) => s.cutscene);
  const unlocked = id <= lit;
  const focused = focus === id;
  const idle = useRef(0);
  const [idleHint, setIdleHint] = useState(false);
  useFrame((_, rawDt) => {
    if (!focused || cutscene) {
      idle.current = 0;
      return;
    }
    idle.current += frameDt(rawDt);
    const want = idle.current > idleHintAfter;
    if (want !== idleHint) setIdleHint(want);
  });
  useEffect(() => {
    if (!focused) setIdleHint(false);
  }, [focused]);
  const touch = () => {
    idle.current = 0;
    if (idleHint) setIdleHint(false);
    if (useGame.getState().hintStop === id) useGame.getState().set({ hintStop: null });
  };
  const ask = () => {
    const ok = requestStopInteraction(id);
    if (ok) touch();
    return ok;
  };
  return { unlocked, focused, hint: focused && !cutscene && (hintStop === id || idleHint), touch, ask };
}

/** Run a callback when the director reveals this stop. */
export function useStopWake(id: number, fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(
    () =>
      bus.on('stopWake', (i: number) => {
        if (i === id) ref.current();
      }),
    [id],
  );
}

export interface DragInfo {
  /** point on the drag plane (world) */
  point: THREE.Vector3;
  /** screen position in CSS pixels */
  screen: THREE.Vector2;
  /** movement since the last event, in CSS pixels */
  delta: THREE.Vector2;
  /** total movement since the drag started, in CSS pixels */
  total: THREE.Vector2;
  event: ThreeEvent<PointerEvent>;
}

export interface DragOpts {
  /** plane to project onto; a function so it can follow moving objects */
  plane?: () => THREE.Plane;
  onStart?: (d: DragInfo) => boolean | void;
  onMove?: (d: DragInfo) => void;
  onEnd?: (d: DragInfo) => void;
}

export type DragHandlers = {
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
  onPointerCancel: (e: ThreeEvent<PointerEvent>) => void;
};

/**
 * Pointer handlers for dragging (not a hook: safe to create per item). Uses
 * pointer capture so the drag keeps going even when the finger leaves the
 * object. `get` returns the latest options.
 */
export function createDrag(get: () => DragOpts): DragHandlers {
  const st = { active: false, id: -1, start: new THREE.Vector2(), last: new THREE.Vector2() };
  const info = (e: ThreeEvent<PointerEvent>): DragInfo => {
    const screen = new THREE.Vector2(e.nativeEvent.clientX, e.nativeEvent.clientY);
    const point = new THREE.Vector3();
    const plane = get().plane?.();
    if (plane) {
      if (!e.ray.intersectPlane(plane, point)) point.copy(e.point);
    } else point.copy(e.point);
    return { point, screen, delta: screen.clone().sub(st.last), total: screen.clone().sub(st.start), event: e };
  };
  return {
    onPointerDown: (e) => {
      e.stopPropagation();
      st.start.set(e.nativeEvent.clientX, e.nativeEvent.clientY);
      st.last.copy(st.start);
      const d = info(e);
      if (get().onStart?.(d) === false) return;
      st.active = true;
      st.id = e.pointerId;
      (e.target as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      if (!st.active || e.pointerId !== st.id) return;
      e.stopPropagation();
      const d = info(e);
      st.last.copy(d.screen);
      get().onMove?.(d);
    },
    onPointerUp: (e) => {
      if (!st.active || e.pointerId !== st.id) return;
      e.stopPropagation();
      st.active = false;
      try {
        (e.target as unknown as { releasePointerCapture: (id: number) => void }).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      get().onEnd?.(info(e));
    },
    onPointerCancel: (e) => {
      if (!st.active) return;
      st.active = false;
      get().onEnd?.(info(e));
    },
  };
}

/** Hook form of createDrag for a single draggable thing. */
export function useDrag(opts: DragOpts): DragHandlers {
  const o = useRef(opts);
  o.current = opts;
  return useMemo(() => createDrag(() => o.current), []);
}

/** A soft pulsing ring on the ground that says "something to play with here". */
export function PlayRing({ visible, radius = 1, position = [0, 0.05, 0] as [number, number, number], color = '#fff3a8' }: { visible: boolean; radius?: number; position?: [number, number, number]; color?: string }) {
  const ref = useRef<THREE.Mesh>(null!);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }), [color]);
  const geo = useMemo(() => new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), []);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.visible = visible;
    const t = state.clock.elapsedTime;
    const k = (t * 0.6) % 1;
    ref.current.scale.setScalar(radius * (0.8 + k * 0.5));
    mat.opacity = 0.55 * (1 - k);
  });
  return <mesh ref={ref} geometry={geo} material={mat} position={position} raycast={() => null} />;
}
