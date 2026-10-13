// 5 dry nights already seen, then a wet morning: the hug, the button, then a refresh.
import { chromium } from 'playwright';
const [w = '900', h = '650', name = 'wet'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: true });
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|DevTools|THREE.Clock/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(() => localStorage.setItem('zefs-dry-night-quest:welcomed', '1'));
await page.goto('http://127.0.0.1:5173/?debug&speed=1.5', { waitUntil: 'load' });
await page.waitForTimeout(4000);
await page.evaluate(() => {
  const z = window.__zef;
  z.recordRun(5, -1);
  const d = z.save();
  localStorage.setItem('zefs-dry-night-quest:v1', JSON.stringify({ ...d, seen: { stop: 5, hugDate: null, streak: 5 } }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(6000);
const st = () => page.evaluate(() => ({ scene: window.__zef.game().scene, lit: window.__zef.game().litStop, cut: window.__zef.game().cutscene, keep: window.__zef.save().keepsakes, seen: window.__zef.save().seen }));
console.log('before', JSON.stringify(await st()));
await page.screenshot({ path: `scripts/out/${name}-00-before.png`, timeout: 120000 });
await page.evaluate(() => window.__zef.record(0, 'wet'));
for (let i = 1; i <= 4; i++) {
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `scripts/out/${name}-0${i}.png`, timeout: 120000 });
  console.log(i, JSON.stringify(await st()));
}
// press the single big button
await page.getByRole('button', { name: /Back to the cottage/ }).click({ timeout: 20000 });
await page.waitForTimeout(6000);
await page.screenshot({ path: `scripts/out/${name}-05-cottage.png`, timeout: 120000 });
console.log('after button', JSON.stringify(await st()));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(8000);
await page.screenshot({ path: `scripts/out/${name}-06-reloaded.png`, timeout: 120000 });
console.log('after reload', JSON.stringify(await st()));
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
