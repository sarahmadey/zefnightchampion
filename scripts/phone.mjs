// Screenshot stops at a phone size (DPR 2) and report hit-target sizes in CSS px.
import { chromium } from 'playwright';
const [list = '2,5,9,13', w = '390', h = '844', prefix = 'phone'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true, isMobile: +w < 700 });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(() => localStorage.setItem('zefs-dry-night-quest:welcomed', '1'));
await page.goto(`http://127.0.0.1:5173/?debug&noevents&lit=15`, { waitUntil: 'load' });
await page.waitForTimeout(6000);
for (const id of list.split(',').map(Number)) {
  await page.evaluate((i) => window.__zef.goto(i), id);
  await page.waitForTimeout(4000);
  // size of a 0.42-radius target at the stop's object, in CSS pixels
  const size = await page.evaluate((i) => {
    const z = window.__zef;
    const a = z.stopScreen(i, 'object');
    const cam = window.__camera;
    const p = cam.position.clone();
    const o = z.cam.target.clone();
    return { obj: a, camDist: p.distanceTo(o).toFixed(1) };
  }, id);
  const file = `scripts/out/${prefix}-${String(id).padStart(2, '0')}.png`;
  await page.screenshot({ path: file, timeout: 120000 });
  console.log(file, JSON.stringify(size));
}
console.log(logs.join('\n'));
await browser.close();
