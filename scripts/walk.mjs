// Tap the ground to make Zef walk; capture frames to show movement and camera parallax.
import { chromium } from 'playwright';
const [w = '390', h = '844', name = 'walk', dpr = '2'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, hasTouch: true, isMobile: +w < 700 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|DevTools|THREE.Clock/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(() => localStorage.setItem('zefs-dry-night-quest:welcomed', '1'));
await page.goto('http://127.0.0.1:5173/?debug&noevents&lit=6&at=0&cam=follow&speed=1', { waitUntil: 'load' });
await page.waitForTimeout(7000);
const pos = () => page.evaluate(() => { const z = window.__zef.zef; const c = window.__zef.cam; return { zef: [z.pos.x.toFixed(2), z.pos.z.toFixed(2)], speed: z.speed.toFixed(2), info: window.__zef.info() }; });
console.log('start', JSON.stringify(await pos()));
await page.screenshot({ path: `scripts/out/${name}-0.png`, timeout: 120000 });
// tap far down the path toward the strawberry garden
await page.touchscreen.tap(+w * 0.5, +h * 0.42);
for (let i = 1; i <= 4; i++) {
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `scripts/out/${name}-${i}.png`, timeout: 120000 });
  console.log(i, JSON.stringify(await pos()));
}
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
