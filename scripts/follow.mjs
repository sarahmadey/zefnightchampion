import { chromium } from 'playwright';
const [w = '900', h = '650', name = 'follow', at = '0', dpr = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
await page.addInitScript(() => localStorage.setItem('zefs-dry-night-quest:welcomed', '1'));
await page.goto(`http://127.0.0.1:5173/?debug&noevents&lit=15&at=${at}&cam=follow`, { waitUntil: 'load' });
await page.waitForTimeout(8000);
// step Zef a little down the path so the follow camera is in its usual state
await page.evaluate(() => { const z = window.__zef.zef; });
await page.screenshot({ path: `scripts/out/${name}.png`, timeout: 120000 });
await browser.close();
