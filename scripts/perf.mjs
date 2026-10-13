import { chromium } from 'playwright';
const [w = '390', h = '844'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await page.addInitScript(() => localStorage.setItem('zefs-dry-night-quest:welcomed', '1'));
await page.goto('http://127.0.0.1:5173/?debug&noevents&lit=15&at=0', { waitUntil: 'load' });
await page.waitForTimeout(6000);
for (const id of [0, 2, 5, 8, 11, 14]) {
  await page.evaluate((i) => { window.__zef.goto(i); window.__zef.game().set({ focusStop: null }); window.__zef.cam.mode = 'follow'; window.__zef.cam.fitWidth = 0; }, id);
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => window.__zef.info());
  console.log('stop', id, JSON.stringify(info));
}
await browser.close();
