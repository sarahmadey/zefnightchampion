// Test hooks, only installed when the page URL has ?debug. They let automated
// checks drive the game (record nights, press buttons, project objects).

import * as THREE from 'three';
import { cam, coach, hero, timeScale } from './game/actors';
import { useGame, useSave } from './state/store';
import { addDays, computeQuest, prizesEarned, todayKey } from './state/progress';
import { dayShift, endPreview, playChild, pressDry, pressWet, replayToday, showTitle, startPreview, tapCoach, tapHero, resetBoardView } from './game/director';
import { fx } from './board/EventProps';
import { chestPos } from './board/layout';
import { pedestalHeight, pedestalPos } from './store/StoreScene';
import type { PreviewKind } from './state/store';

export function installDebug() {
  if (typeof window === 'undefined' || !new URLSearchParams(location.search).has('debug')) return;
  const q = new URLSearchParams(location.search);
  const speed = Number(q.get('speed') ?? '1');
  if (speed > 0) timeScale.value = speed;
  // software-rendered test browsers run at a few fps: let game time keep up
  timeScale.maxDt = Number(q.get('maxdt') ?? '0.25');
  dayShift.days = Number(q.get('dayshift') ?? '0') || 0;
  const api = {
    hero,
    coach,
    cam,
    fx,
    game: () => useGame.getState(),
    save: () => useSave.getState().data,
    lib: () => useSave.getState().library,
    removeChild: (id: string) => useSave.getState().removeChild(id),
    cloud: () => useSave.getState().cloud,
    record(dateOffset: number, result: 'dry' | 'wet' | null) {
      useSave.getState().record(addDays(todayKey(), dateOffset), result);
    },
    recordRun(n: number, endOffset = 0) {
      for (let i = n - 1; i >= 0; i--) useSave.getState().record(addDays(todayKey(), endOffset - i), 'dry');
    },
    /** Jump the board: n dry nights ending yesterday (or today, with `today`), all already seen. */
    seed(n: number, opts: { wetLast?: boolean; setup?: boolean; name?: string; today?: boolean } = {}) {
      if (!useSave.getState().library.current) {
        useSave.getState().addChild();
        useSave.getState().setProfile({ name: opts.name ?? 'Zef' });
      }
      const s = useSave.getState();
      const last = opts.today ? 0 : -1;
      for (let i = n - 1; i >= 0; i--) s.record(addDays(todayKey(), last - i), 'dry');
      if (opts.wetLast) s.record(addDays(todayKey(), last), 'wet');
      const d = useSave.getState().data;
      const quest = { stars: Object.values(d.records).filter((r) => r === 'dry').length };
      const q = computeQuest(d.records, d.rules);
      s.markSeen({ stars: quest.stars, prizes: prizesEarned(quest.stars, d.rules), meter: q.meter, hugDate: opts.wetLast ? addDays(todayKey(), last) : null, underpants: d.underpants.earned });
      if (opts.setup !== false) s.setProfile({ setupDone: true });
    },
    /** Start the current (or first) child's morning from the title screen. */
    splash() {
      const lib = useSave.getState().library;
      const id = lib.current ?? Object.keys(lib.children)[0];
      if (id) playChild(id);
    },
    title: showTitle,
    dry: pressDry,
    wet: pressWet,
    replay: replayToday,
    tapHero,
    tapCoach,
    preview(kind: PreviewKind) {
      startPreview(kind);
    },
    endPreview,
    resetBoardView,
    setParentOpen(v: boolean) {
      useGame.getState().set({ parentOpen: v });
    },
    heroScreen() {
      return api.project(hero.pos.clone().add(new THREE.Vector3(0, 0.6 + hero.air, 0)));
    },
    coachScreen() {
      return api.project(coach.pos.clone().add(new THREE.Vector3(0, 1.2, 0)));
    },
    eggScreen() {
      return api.project(fx.egg.pos.clone().add(new THREE.Vector3(0, 0.45, 0)));
    },
    handScreen() {
      return api.project(fx.hand.pos.clone());
    },
    balloonScreen(i: number) {
      const b = fx.balloons.items[i];
      return b && !b.popped ? api.project(b.pos.clone().add(new THREE.Vector3(0, 0.38, 0))) : null;
    },
    bushScreen(i: number) {
      const b = fx.bushes.items[i];
      return b ? api.project(b.pos.clone().add(new THREE.Vector3(0, 0.55, 0))) : null;
    },
    fruitScreen(i: number) {
      const f = fx.fruit.items[i];
      return f && !f.flying ? api.project(f.pos.clone().add(new THREE.Vector3(0, 0.2, 0))) : null;
    },
    rockScreen(i: number) {
      const r = fx.rocks.items[i];
      return r ? api.project(r.pos.clone().add(new THREE.Vector3(0, 0.2, 0))) : null;
    },
    introStarScreen() {
      return api.project(fx.introStar.pos.clone());
    },
    chestScreen(land: number) {
      return api.project(chestPos(land).clone().add(new THREE.Vector3(0, 0.9, 0)));
    },
    pedestalScreen(i: number) {
      return api.project(pedestalPos(i).clone().add(new THREE.Vector3(0, pedestalHeight(i) + 0.45, 0)));
    },
    info() {
      const r = (window as unknown as { __renderer?: THREE.WebGLRenderer }).__renderer;
      return r ? { calls: r.info.render.calls, triangles: r.info.render.triangles, geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: r.info.programs?.length } : null;
    },
    heavy(n = 25) {
      const scene = (window as unknown as { __scene?: THREE.Scene }).__scene;
      const camera = (window as unknown as { __camera?: THREE.Camera }).__camera;
      if (!scene || !camera) return [];
      const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const rows: { name: string; tris: number; shadow: boolean }[] = [];
      scene.traverseVisible((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.geometry || !m.geometry.getAttribute('position')) return;
        const im = o as THREE.InstancedMesh;
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        const bs = (im.isInstancedMesh ? im.boundingSphere : m.geometry.boundingSphere)?.clone().applyMatrix4(o.matrixWorld);
        if (bs && m.frustumCulled !== false && !frustum.intersectsSphere(bs)) return;
        const t = (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3;
        const count = im.isInstancedMesh ? im.count : 1;
        const label = (m.geometry.name || '') + '|' + ((m.material as THREE.Material).name || (m.material as THREE.Material).type);
        rows.push({ name: label, tris: Math.round(t * count), shadow: m.castShadow });
      });
      rows.sort((a, b) => b.tris - a.tris);
      return rows.slice(0, n);
    },
    project(p: THREE.Vector3) {
      const camera = (window as unknown as { __camera?: THREE.Camera }).__camera;
      if (!camera) return null;
      const v = p.clone().project(camera);
      return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
    },
  };
  (window as unknown as { __dino: typeof api }).__dino = api;
}
