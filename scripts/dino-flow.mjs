// Ritual rules: refresh never replays, a second visit says "already pressed",
// the parent corner opens and previews without changing progress, replay works.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
const st = () => page.evaluate(() => { const d = window.__dino.save(); const g = window.__dino.game(); return { phase: g.phase, cut: g.cutscene, stars: g.shownStars, meter: g.shownMeter, seen: d.seen, recs: Object.keys(d.records).length }; });
await page.goto('http://127.0.0.1:5173/?debug', { waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.evaluate(() => window.__dino.seed(3));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(4500);
await page.getByRole('button', { name: 'Tap to start' }).click();
await page.waitForFunction(() => window.__dino.game().phase === 'ask', null, { timeout: 60000 });
await page.getByRole('button', { name: /Dry! I stayed dry/ }).click();
await page.waitForTimeout(2500);
console.log('mid-event', JSON.stringify(await st()));
// refresh in the middle of the celebration
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(4500);
console.log('after refresh (splash)', JSON.stringify(await st()));
await page.getByRole('button', { name: 'Tap to start' }).click();
await page.waitForFunction(() => { const g = window.__dino.game(); return g.phase === 'done' && !g.cutscene; }, null, { timeout: 150000 });
console.log('caught up', JSON.stringify(await st()));
// another refresh: no replay, just "already"
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(4500);
await page.getByRole('button', { name: 'Tap to start' }).click();
await page.waitForTimeout(1500);
const captions = [];
for (let i = 0; i < 12; i++) { await page.waitForTimeout(600); const c = await page.evaluate(() => window.__dino.game().caption?.text); if (c && !captions.includes(c)) captions.push(c); }
console.log('second visit said:', JSON.stringify(captions), JSON.stringify(await st()));
await page.screenshot({ path: 'scripts/out/flow-01-done.png', timeout: 120000 });
// replay
await page.getByRole('button', { name: 'Watch it again' }).click();
await page.waitForTimeout(3000);
console.log('replay', JSON.stringify(await st()));
await page.waitForFunction(() => { const g = window.__dino.game(); return g.phase === 'done' && !g.cutscene && !g.preview; }, null, { timeout: 150000 });
console.log('after replay', JSON.stringify(await st()));
// parent corner: hold the moon, answer, look around
const moon = page.getByRole('button', { name: /Parent corner/ });
const box = await moon.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(1500);
await page.mouse.up();
await page.waitForTimeout(500);
const qtext = await page.locator('#gate-title + p strong').innerText();
const [a, b] = qtext.split('×').map((x) => Number(x.trim()));
await page.getByRole('button', { name: String(a * b), exact: true }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: 'scripts/out/flow-02-panel-top.png', timeout: 120000 });
await page.locator('.panel').evaluate((el) => el.scrollTo(0, 700));
await page.waitForTimeout(300);
await page.screenshot({ path: 'scripts/out/flow-03-panel-goal.png', timeout: 120000 });
await page.locator('.panel').evaluate((el) => el.scrollTo(0, 1400));
await page.waitForTimeout(300);
await page.screenshot({ path: 'scripts/out/flow-04-panel-prizes.png', timeout: 120000 });
// a preview from the panel changes nothing
const before = JSON.stringify((await st()).seen);
await page.getByRole('button', { name: 'The hug' }).click();
await page.waitForTimeout(6000);
await page.screenshot({ path: 'scripts/out/flow-05-preview-hug.png', timeout: 120000 });
await page.getByRole('button', { name: 'End preview' }).click();
await page.waitForTimeout(1500);
const after = JSON.stringify((await st()).seen);
console.log('preview left progress unchanged:', before === after, after);
console.log(logs.join('\n') || 'no errors');
await browser.close();
