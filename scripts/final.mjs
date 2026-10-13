// End-to-end checks through the real UI where it matters.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 650 }, deviceScaleFactor: 1, hasTouch: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|DevTools|THREE.Clock/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(() => localStorage.setItem('zefs-dry-night-quest:welcomed', '1'));
await page.goto('http://127.0.0.1:5173/?debug&speed=1.5', { waitUntil: 'load' });
await page.waitForTimeout(5000);
const st = () => page.evaluate(() => ({ scene: window.__zef.game().scene, lit: window.__zef.game().litStop, cut: window.__zef.game().cutscene, preview: window.__zef.game().preview, records: window.__zef.save().records, seen: window.__zef.save().seen, keep: window.__zef.save().keepsakes, castle: window.__zef.save().castleUnlocked }));
async function openParent() {
  await page.evaluate(() => window.__zef.setParentOpen(true));
  await page.waitForTimeout(500);
}
async function shot(n) { await page.screenshot({ path: `scripts/out/final-${n}.png`, timeout: 120000 }); console.log('shot', n); }

// 1. a record 3 days ago plus today: the unknown-nights card appears and today's run starts fresh
await page.evaluate(() => { window.__zef.record(-3, 'dry'); });
await page.waitForTimeout(6000);
await openParent();
await page.getByRole('button', { name: /Dry night/ }).click();
await page.waitForTimeout(400);
await shot('01-gap-confirm');
await page.getByRole('button', { name: /Yes, record it/ }).click();
await page.waitForTimeout(12000);
console.log('after gap dry', JSON.stringify(await st()));
await openParent();
await shot('02-panel-gap');
// fill the two unknown nights as dry from the history list
for (const label of [/Sun, Oct 11/, /Mon, Oct 12/]) {
  const row = page.locator('li.hist-row', { hasText: label });
  await row.getByRole('button', { name: 'Dry', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Yes, record it|Change it/ }).click();
  await page.waitForTimeout(400);
}
await shot('03-filled');
console.log('after fill', JSON.stringify(await st()));
await page.getByRole('button', { name: 'Back to the game' }).last().click();
await page.waitForTimeout(16000);
console.log('after close (travel 1->4)', JSON.stringify(await st()));
await shot('04-travelled');

// 2. refresh: no replay, same place
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(9000);
console.log('after reload', JSON.stringify(await st()));
await shot('05-reloaded');

// 3. preview stop 12 does not change real progress
const before = JSON.stringify((await st()).records);
await openParent();
await page.getByRole('button', { name: /Preview stop 12/ }).click();
await page.waitForTimeout(14000);
await shot('06-preview12');
console.log('during preview', JSON.stringify(await st()));
await page.getByRole('button', { name: 'End preview' }).click();
await page.waitForTimeout(5000);
const after = await st();
console.log('after preview', JSON.stringify(after), 'records unchanged:', before === JSON.stringify(after.records));
await shot('07-preview-ended');
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
