// Does Coach Rex's voice load and play? Watch the coach's jaw (it follows the voice level).
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
await page.goto('http://127.0.0.1:5173/?debug', { waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.evaluate(() => window.__dino.seed(3));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(4500);
await page.getByRole('button', { name: 'Tap to start' }).click();
const samples = [];
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(500);
  samples.push(await page.evaluate(() => ({ cap: window.__dino.game().caption?.text?.slice(0, 30) ?? '', talk: +window.__dino.coach.talk.toFixed(2) })));
}
console.log(samples.map((s) => `${s.talk}  ${s.cap}`).join('\n'));
console.log(logs.join('\n') || 'no errors');
await browser.close();
