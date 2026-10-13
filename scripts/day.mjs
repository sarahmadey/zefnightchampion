// Fresh adventure, then record N dry nights via the debug API and film the arrival.
// node scripts/day.mjs <name> <dryNights> [w] [h] [shots] [interval]
import { chromium } from 'playwright';
const [name, n = '1', w = '900', h = '650', shots = '6', interval = '3000', query = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: true });
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|DevTools|THREE.Clock/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(() => localStorage.setItem('zefs-dry-night-quest:welcomed', '1'));
await page.goto(`http://127.0.0.1:5173/?debug&speed=1.5${query}`, { waitUntil: 'load' });
await page.waitForTimeout(5000);
// seed n-1 nights as already seen (so only the last night plays), then record the newest night
await page.evaluate((k) => {
  const z = window.__zef;
  if (k > 1) {
    z.recordRun(k - 1, -1);
    const d = z.save();
    // mark earlier stops as seen and place Zef there
    localStorage.setItem('zefs-dry-night-quest:v1', JSON.stringify({ ...d, seen: { stop: k - 1, hugDate: null, streak: k - 1 } }));
  }
}, +n);
if (+n > 1) {
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(6000);
}
await page.screenshot({ path: `scripts/out/${name}-00-before.png`, timeout: 120000 });
await page.evaluate(() => window.__zef.record(0, 'dry'));
for (let i = 1; i <= +shots; i++) {
  await page.waitForTimeout(+interval);
  const file = `scripts/out/${name}-${String(i).padStart(2, '0')}.png`;
  await page.screenshot({ path: file, timeout: 120000 });
  const st = await page.evaluate(() => ({ cut: window.__zef.game().cutscene, focus: window.__zef.game().focusStop, lit: window.__zef.game().litStop, scene: window.__zef.game().scene }));
  console.log(file, JSON.stringify(st));
}
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
