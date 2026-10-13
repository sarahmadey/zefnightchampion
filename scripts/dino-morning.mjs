// A morning: seed N seen dry nights, tap to start, press a button, and tap
// through whatever surprise comes (egg, high five, roar, chest, store).
import { chromium } from 'playwright';
const [, , seedArg = '4', which = 'dry', sizeArg = 'phone', tagArg] = process.argv;
const seed = Number(seedArg);
const size = sizeArg === 'tablet' ? { width: 1024, height: 768 } : { width: 390, height: 844 };
const tag = tagArg ?? `m${seed}-${which}-${sizeArg}`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|DevTools|THREE.Clock|Download the React/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://127.0.0.1:5173/?debug', { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.evaluate((n) => window.__dino.seed(n), seed);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(5000);
let shot = 0;
const snap = async (name) => page.screenshot({ path: `scripts/out/${tag}-${String(shot++).padStart(2, '0')}-${name}.png`, timeout: 120000 });
await snap('splash');
await page.getByRole('button', { name: 'Tap to start' }).click();
await page.waitForTimeout(1500);
await snap('greet');
await page.waitForFunction(() => window.__dino.game().phase === 'ask', null, { timeout: 60000 });
await page.waitForTimeout(800);
await snap('ask');
await page.getByRole('button', { name: which === 'dry' ? /Dry! I stayed dry/ : /Not dry/ }).click();
const start = Date.now();
let lastAwait = null;
while (Date.now() - start < 150000) {
  await page.waitForTimeout(1600);
  const st = await page.evaluate(() => { const g = window.__dino.game(); return { phase: g.phase, awaiting: g.awaiting, cut: g.cutscene, cap: g.caption?.text ?? '', scene: g.scene }; });
  if (st.awaiting && st.awaiting !== lastAwait) {
    lastAwait = st.awaiting;
    await snap(`await-${st.awaiting}`);
  }
  if (st.awaiting === 'egg') {
    for (let i = 0; i < 3; i++) {
      const p = await page.evaluate(() => window.__dino.eggScreen());
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(500);
    }
  } else if (st.awaiting === 'highfive') {
    const p = await page.evaluate(() => window.__dino.handScreen());
    await page.mouse.click(p.x, p.y);
  } else if (st.awaiting === 'roar') {
    for (let i = 0; i < 3; i++) {
      const p = await page.evaluate(() => window.__dino.heroScreen());
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(1700);
    }
  } else if (st.awaiting === 'chest') {
    const p = await page.evaluate(() => { const g = window.__dino.game(); return window.__dino.chestScreen(g.land - 1 >= 0 ? g.land - 1 : 0); });
    await snap('chest-before');
    await page.mouse.click(p.x, p.y);
  } else if (st.awaiting === 'store-pick') {
    const p = await page.evaluate(() => window.__dino.pedestalScreen(1));
    await page.mouse.click(p.x, p.y);
  } else {
    await snap(st.cut ?? st.phase);
  }
  if (st.phase === 'done' && !st.cut) break;
}
await page.waitForTimeout(800);
await snap('end');
const final = await page.evaluate(() => { const d = window.__dino.save(); const g = window.__dino.game(); return { seen: d.seen, phase: g.phase, shownStars: g.shownStars, shownMeter: g.shownMeter, acc: g.shownAccessories }; });
console.log(JSON.stringify(final));
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
