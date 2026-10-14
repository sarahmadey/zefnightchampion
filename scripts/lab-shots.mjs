// Screenshots of one dinosaur in the dev lab: node scripts/lab-shots.mjs trex 0 34,front,side,back,face tag [coach] [action]
import { chromium } from 'playwright';
const [, , species = 'trex', color = '0', viewsArg = '34,front,side,back,face', tag = 'lab', coach = '0', action = 'none', extra = ''] = process.argv;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 })).newPage();
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|DevTools|Download the React/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:5173/lab.html?species=${species}&color=${color}&coach=${coach}&action=${action}${extra}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__lab, null, { timeout: 120000 });
await page.waitForTimeout(2500);
for (const v of viewsArg.split(',')) {
  await page.evaluate((v) => window.__lab.setView(v), v);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `scripts/out/${tag}-${species}-${v}.png`, timeout: 120000 });
}
console.log(logs.join('\n'));
await browser.close();
