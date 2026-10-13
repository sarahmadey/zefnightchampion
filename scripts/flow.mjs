// Drive the game with the debug API and capture screenshots of a scripted flow.
// node scripts/flow.mjs <name> <width> <height> <steps-json>
import { chromium } from 'playwright';

const [name, w = '900', h = '650', stepsJson = '[]', query = 'debug'] = process.argv.slice(2);
const steps = JSON.parse(stepsJson);
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => {
  const t = m.text();
  if (!/vite|DevTools|THREE.Clock/.test(t)) logs.push(`[${m.type()}] ${t}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:5173/?${query}`, { waitUntil: 'load' });
let shot = 0;
for (const s of steps) {
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.eval) {
    const r = await page.evaluate(s.eval);
    if (r !== undefined) console.log('eval:', JSON.stringify(r));
  }
  if (s.tap) await page.touchscreen.tap(s.tap[0], s.tap[1]);
  if (s.click) await page.mouse.click(s.click[0], s.click[1]);
  if (s.drag) {
    const [x0, y0, x1, y1, n = 12] = s.drag;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= n; i++) {
      await page.mouse.move(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
  }
  if (s.clickText) await page.getByText(s.clickText, { exact: false }).first().click();
  if (s.shot) {
    const file = `scripts/out/${name}-${String(++shot).padStart(2, '0')}-${s.shot}.png`;
    await page.screenshot({ path: file, timeout: 120000 });
    console.log('shot', file);
  }
  if (s.reload) await page.reload({ waitUntil: 'load' });
}
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
