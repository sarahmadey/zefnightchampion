// The newer surprises and the wardrobe: through the grown-up "a surprise"
// preview (it takes them in turn), tickle Coach Rex, feed him fruit, play the
// music rocks, do the dino moves, pop the balloons, tap up fireworks and find
// Coach Rex behind a bush; then open the wardrobe, swap the cap for the party
// hat and close it.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })).newPage();
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|DevTools|THREE.Clock|Download the React/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const snap = (name) => page.screenshot({ path: `scripts/out/fresh-${name}.png`, timeout: 120000 });
await page.goto('http://127.0.0.1:5173/?debug', { waitUntil: 'load' });
await page.waitForFunction(() => window.__dino?.game().ready, null, { timeout: 120000 });
// nine dry nights up to today, all seen: the morning ends on "See you tomorrow"
await page.evaluate(() => window.__dino.seed(9, { today: true }));
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__dino?.game().ready, null, { timeout: 120000 });
await page.getByRole('button', { name: "Zef's adventure!" }).click();
await page.waitForFunction(() => window.__dino.game().phase === 'done' && !window.__dino.game().cutscene, null, { timeout: 300000 });
const waitAwait = (kind) => page.waitForFunction((k) => window.__dino.game().awaiting === k, kind, { timeout: 120000 });
const idle = () => page.waitForFunction(() => !window.__dino.game().preview, null, { timeout: 300000 });

// tickle time: tap Coach Rex until he topples over
await page.evaluate(() => window.__dino.preview('surprise'));
await waitAwait('tickle');
await page.waitForTimeout(600);
for (let i = 0; i < 8; i++) {
  if ((await page.evaluate(() => window.__dino.game().awaiting)) !== 'tickle') break;
  const p = await page.evaluate(() => window.__dino.coachScreen());
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(350);
  if (i === 4) await snap('0a-tickle');
}
await idle();

// snack time: every fruit into Coach Rex's mouth
await page.evaluate(() => window.__dino.preview('surprise'));
await waitAwait('snack');
await page.waitForTimeout(600);
await snap('0b-fruit');
for (let i = 0; i < 5; i++) {
  const p = await page.evaluate((i) => window.__dino.fruitScreen(i), i);
  if (p) await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(850);
}
await page.waitForFunction(() => window.__dino.fx.fruit.items.every((f) => f.chewed), null, { timeout: 60000 });
console.log('fruit eaten: 5');
await idle();

// the dino band: a little tune on the rocks
await page.evaluate(() => window.__dino.preview('surprise'));
await waitAwait('band');
await page.waitForTimeout(600);
for (const [k, i] of [0, 1, 2, 3, 4, 3, 2, 4, 0, 2].entries()) {
  const p = await page.evaluate((i) => window.__dino.rockScreen(i), i);
  if (p) await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(280);
  if (k === 3) await snap('0c-band');
}
await idle();

// dino moves: nothing to tap, just follow along
await page.evaluate(() => window.__dino.preview('surprise'));
await page.waitForFunction(() => (window.__dino.game().caption?.text ?? '').startsWith('Time to move'), null, { timeout: 120000 });
await page.waitForTimeout(6000);
await snap('0d-moves');
await idle();

// balloons
await page.evaluate(() => window.__dino.preview('surprise'));
await waitAwait('balloons');
await page.waitForTimeout(1200);
await snap('1-balloons');
for (let i = 0; i < 5; i++) {
  const p = await page.evaluate((i) => window.__dino.balloonScreen(i), i);
  if (p) await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(250);
}
console.log('balloons popped:', await page.evaluate(() => window.__dino.fx.balloons.items.filter((b) => b.popped).length));
await idle();

// fireworks
await page.evaluate(() => window.__dino.preview('surprise'));
await waitAwait('fireworks');
await page.waitForTimeout(1500);
for (const [x, y] of [[100, 200], [280, 160], [190, 260]]) {
  await page.mouse.click(x, y);
  await page.waitForTimeout(450);
}
await page.waitForTimeout(500);
await snap('2-fireworks');
await idle();

// hide and seek: tap the bushes in turn until Coach Rex pops out
await page.evaluate(() => window.__dino.preview('surprise'));
await waitAwait('peekaboo');
await page.waitForTimeout(800);
await snap('3-bushes');
for (let i = 0; i < 3; i++) {
  if ((await page.evaluate(() => window.__dino.game().awaiting)) !== 'peekaboo') break;
  const p = await page.evaluate((i) => window.__dino.bushScreen(i), i);
  if (p) await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(900);
}
await page.waitForFunction(() => window.__dino.coach.visible, null, { timeout: 60000 });
await page.waitForTimeout(700);
await snap('4-found');
await idle();

// the wardrobe
await page.getByRole('button', { name: 'Dress up your dino' }).click();
await page.waitForTimeout(2500);
await snap('5-wardrobe');
const worn = () => page.evaluate(() => [...document.querySelectorAll('.wardrobe-item.worn')].map((e) => e.getAttribute('aria-label')));
console.log('worn at first:', JSON.stringify(await worn()));
await page.getByRole('button', { name: 'baseball cap' }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'party hat' }).click();
await page.waitForTimeout(1500);
console.log('worn after:', JSON.stringify(await worn()));
await snap('6-changed');
await page.getByRole('button', { name: 'Done dressing up' }).click();
await page.waitForTimeout(1500);
console.log('outfit saved:', JSON.stringify(await page.evaluate(() => window.__dino.save().outfit)));
console.log(logs.slice(0, 20).join('\n') || 'no errors');
await browser.close();
