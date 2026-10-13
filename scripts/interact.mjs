// Drive real pointer gestures against stops: node scripts/interact.mjs "1,2,3" [w] [h]
import { chromium } from 'playwright';
const [list = '1', w = '900', h = '650', prefix = 'act'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|DevTools|THREE.Clock/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(() => localStorage.setItem('zefs-dry-night-quest:welcomed', '1'));
await page.goto(`http://127.0.0.1:5173/?debug&noevents&lit=15&speed=1.5`, { waitUntil: 'load' });
await page.waitForTimeout(6000);
const ev = (fn, arg) => page.evaluate(fn, arg);
const P = (stop, x, y, z) => ev(([s, a, b, c]) => window.__zef.localScreen(s, a, b, c), [stop, x, y, z]);
const obj = (stop) => ev((s) => window.__zef.stopScreen(s, 'object'), stop);
async function tap(p, hold = 60) {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(hold);
  await page.mouse.up();
}
async function drag(a, b, steps = 14, pause = 40) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
    await page.waitForTimeout(pause);
  }
  await page.mouse.up();
}
async function shot(id, label) {
  const f = `scripts/out/${prefix}-${String(id).padStart(2, '0')}-${label}.png`;
  await page.screenshot({ path: f, timeout: 120000 });
  console.log('shot', f);
}
const tests = {
  1: async () => { const o = await obj(1); await drag({ x: o.x - 140, y: o.y - 60 }, { x: o.x + 140, y: o.y - 40 }, 16); await page.waitForTimeout(2500); },
  2: async () => {
    for (let k = 0; k < 6; k++) {
      const a = Math.PI * 0.15 + (k / 5) * Math.PI * 0.7;
      const p = await P(2, -3.9 + Math.cos(a) * 1.55, 0.25, -0.6 + Math.sin(a) * 1.55 - 0.2);
      await tap(p); await page.waitForTimeout(500);
    }
    await page.waitForTimeout(3500);
  },
  3: async () => { const o = await P(3, 3.8, 1.4, -1.3); await tap(o); await page.waitForTimeout(5500); },
  4: async () => { const o = await P(4, -3.3, 1.0, -0.6); for (let k = 0; k < 4; k++) { await tap(o); await page.waitForTimeout(900); } },
  5: async () => {
    for (let k = 0; k < 5; k++) {
      const bs = await ev(() => window.__zef.targets('sheepBubbles'));
      const c = (await ev(() => window.__zef.targets('sheepCluster')))[0];
      if (!bs.length) break;
      await drag(bs[0], c, 10); await page.waitForTimeout(700);
    }
    await page.waitForTimeout(1500);
  },
  6: async () => { const o = await P(6, -4.2, 3.6, -1.6); for (let k = 0; k < 3; k++) { await drag({ x: o.x - 120, y: o.y - 80 }, { x: o.x + 120, y: o.y + 60 }, 10, 25); } await page.waitForTimeout(1500); },
  7: async () => {
    const from = await P(7, -3.4, -0.25, -4.5);
    const to = await P(7, -3.6, -0.25, -8.6);
    await drag(from, to, 18, 60); await page.waitForTimeout(2500);
  },
  8: async () => { const o = await P(8, -4.0, 0.4, -0.6); for (let k = 0; k < 5; k++) { await drag({ x: o.x - 110, y: o.y }, { x: o.x + 110, y: o.y + 10 }, 8, 25); await drag({ x: o.x + 110, y: o.y + 10 }, { x: o.x - 110, y: o.y }, 8, 25); } await page.waitForTimeout(4000); },
  9: async () => {
    for (let k = 0; k < 14; k++) {
      const st = await ev(() => window.__zef.state('whale'));
      console.log('whale', JSON.stringify(st));
      if (st && st.whaleT >= 0) break;
      const bs = await ev(() => window.__zef.targets('fizzBubbles'));
      if (!bs.length) { await page.waitForTimeout(600); continue; }
      await tap(bs[0]); await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1200);
    console.log('whale', JSON.stringify(await ev(() => window.__zef.state('whale'))));
  },
  10: async () => { const o = await P(10, 3.55, 0.5, -0.45); for (let k = 0; k < 3; k++) { await tap(o); await page.waitForTimeout(500); } await page.waitForTimeout(2200); },
  11: async () => { const a = await P(11, -5.6, 0.05, 0.3); const b = await P(11, -2.4, 0.05, -2.8); await drag(a, b, 20, 50); await page.waitForTimeout(3000); },
  12: async () => { const o = await P(12, 4.3, 1.0, -1.2); for (let k = 0; k < 3; k++) await drag({ x: o.x - 150, y: o.y + 40 }, { x: o.x + 150, y: o.y + 40 }, 8, 20); await page.waitForTimeout(2500); },
  13: async () => {
    const L = [[-2.6, 1.1, 1.5], [-3.9, 0.5, 1.9], [-4.7, -0.7, 1.6], [-4.3, -2.0, 2.0], [-3.0, -2.6, 1.7]];
    for (const [x, z, hh] of L) { const p = await P(13, x + 0.36, hh - 0.45, z); await tap(p); await page.waitForTimeout(400); }
    await page.waitForTimeout(2500);
  },
  14: async () => { const p = await ev(() => { const z = window.__zef; return z.project(new (z.cam.pos.constructor)(-8.4, 6.5 + 5, -153 + 8.4)); }); await tap(p); await page.waitForTimeout(3500); },
  15: async () => { const p = await ev(() => { const z = window.__zef; return z.project(new (z.cam.pos.constructor)(0, 6.5 + 2, -153 + 8.6)); }); await tap(p); await page.waitForTimeout(9000); },
};
for (const id of list.split(',').map(Number)) {
  await ev((i) => window.__zef.goto(i), id);
  await page.waitForTimeout(3000);
  await shot(id, 'before');
  await tests[id]();
  await shot(id, 'after');
  const g = await ev(() => ({ scene: window.__zef.game().scene, focus: window.__zef.game().focusStop, cut: window.__zef.game().cutscene }));
  console.log(id, JSON.stringify(g));
  if (g.scene !== 'world') { await ev(() => { window.__zef.game().set({ scene: 'world', cutscene: null }); }); await page.waitForTimeout(3000); }
}
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
