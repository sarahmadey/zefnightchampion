// Screenshot a list of stops in one session: node scripts/stops.mjs "2,3,4" [w] [h] [prefix]
import { chromium } from 'playwright';
const [list = '1', w = '900', h = '650', prefix = 'stop', extra = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: true });
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|DevTools|THREE.Clock/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(() => localStorage.setItem('zefs-dry-night-quest:welcomed', '1'));
await page.goto(`http://127.0.0.1:5173/?debug&noevents&lit=15${extra}`, { waitUntil: 'load' });
await page.waitForTimeout(6000);
for (const id of list.split(',').map(Number)) {
  await page.evaluate((i) => window.__zef.goto(i), id);
  await page.waitForTimeout(3500);
  const file = `scripts/out/${prefix}-${String(id).padStart(2, '0')}.png`;
  await page.screenshot({ path: file, timeout: 120000 });
  console.log('shot', file);
}
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
