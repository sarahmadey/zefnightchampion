// Frames of the store preview's pterodactyl flight: node scripts/ptero-shot.mjs tag
import { chromium } from 'playwright';
const tag = process.argv[2] ?? 'ptero';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://127.0.0.1:5173/?debug', { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.evaluate(() => window.__dino.seed(6));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(6000);
await page.evaluate(() => window.__dino.preview('store'));
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(900);
  const vis = await page.evaluate(() => window.__dino.game().cutscene);
  if (i >= 3) await page.screenshot({ path: `scripts/out/${tag}-${String(i).padStart(2, '0')}.png`, timeout: 120000 });
  if (i === 15) console.log('cut', vis);
}
console.log(logs.join('\n'));
await browser.close();
