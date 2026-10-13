// First look: load fresh, walk through setup, then a seeded board.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const size = process.argv[2] === 'tablet' ? { width: 1024, height: 768 } : { width: 390, height: 844 };
const tag = process.argv[2] === 'tablet' ? 'tab' : 'ph';
const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|DevTools|THREE.Clock|Download the React/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://127.0.0.1:5173/?debug', { waitUntil: 'load' });
await page.waitForTimeout(6000);
await page.screenshot({ path: `scripts/out/d-${tag}-01-name.png`, timeout: 120000 });
await page.getByRole('button', { name: /Next/ }).click();
await page.waitForTimeout(4000);
await page.screenshot({ path: `scripts/out/d-${tag}-02-dino.png`, timeout: 120000 });
await page.getByRole('button', { name: 'Triceratops' }).click();
await page.waitForTimeout(5000);
await page.screenshot({ path: `scripts/out/d-${tag}-03-color.png`, timeout: 120000 });
await page.getByRole('button', { name: 'Blue' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `scripts/out/d-${tag}-04-blue.png`, timeout: 120000 });
await page.getByRole('button', { name: /Let's go/ }).click();
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `scripts/out/d-${tag}-05-intro-${i}.png`, timeout: 120000 });
}
console.log('state', JSON.stringify(await page.evaluate(() => { const g = window.__dino.game(); return { phase: g.phase, scene: g.scene, cut: g.cutscene, caption: g.caption?.text }; })));
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
