// Draw calls, triangles and the heaviest meshes on the board at a few positions.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
for (const n of [0, 12, 30, 47]) {
  await page.goto('http://127.0.0.1:5173/?debug', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.evaluate((k) => window.__dino.seed(k), n);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => window.__dino.info());
  const heavy = await page.evaluate(() => window.__dino.heavy(6));
  console.log(`stars ${n}:`, JSON.stringify(info));
  console.log('   ', heavy.map((h) => `${h.name.split('|')[0] || '?'}:${h.tris}`).join('  '));
}
await browser.close();
