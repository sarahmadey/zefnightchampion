import { chromium } from 'playwright';
const [w = '390', h = '844', name = 'hugphone'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true, isMobile: +w < 700 });
await page.addInitScript(() => localStorage.setItem('zefs-dry-night-quest:welcomed', '1'));
await page.goto('http://127.0.0.1:5173/?debug&speed=1.5', { waitUntil: 'load' });
await page.waitForTimeout(4000);
// a real wet night (not a preview) so there's no preview banner
await page.evaluate(() => { const z = window.__zef; z.recordRun(3, -1); });
await page.waitForTimeout(9000);
await page.evaluate(() => window.__zef.record(0, 'wet'));
for (let i = 0; i < 40; i++) {
  const g = await page.evaluate(() => ({ cut: window.__zef.game().cutscene, cap: window.__zef.game().hugCaption, scene: window.__zef.game().scene }));
  if (i % 4 === 0) console.log(i, JSON.stringify(g));
  if (g.cap) break;
  await page.waitForTimeout(3000);
}
await page.waitForTimeout(2000);
await page.screenshot({ path: `scripts/out/${name}.png`, timeout: 120000 });
console.log(JSON.stringify(await page.evaluate(() => ({ cap: window.__zef.game().hugCaption, scene: window.__zef.game().scene }))));
await browser.close();
