// Settings, sound, reduced motion, backup export/import and new adventure through the UI.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 650 }, deviceScaleFactor: 1, acceptDownloads: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|DevTools|THREE.Clock/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(() => localStorage.setItem('zefs-dry-night-quest:welcomed', '1'));
await page.goto('http://127.0.0.1:5173/?debug&noevents', { waitUntil: 'load' });
await page.waitForTimeout(5000);
const save = () => page.evaluate(() => window.__zef.save());
console.log('default sound', (await save()).settings.sound);
// sound toggle (corner)
await page.getByRole('button', { name: 'Turn sound on' }).click();
await page.waitForTimeout(500);
console.log('after toggle', (await save()).settings.sound);
await page.evaluate(() => window.__zef.recordRun(3, 0));
await page.waitForTimeout(500);
await page.evaluate(() => window.__zef.setParentOpen(true));
await page.waitForTimeout(500);
// reduced motion
await page.getByLabel(/Reduced motion/).check();
console.log('reduced', (await save()).settings.reducedMotion);
// export
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.getByRole('button', { name: 'Export backup' }).click()]);
let text = null;
if (dl) {
  const p = await dl.path();
  const fs = await import('fs');
  text = fs.readFileSync(p, 'utf8');
  console.log('downloaded', dl.suggestedFilename(), text.length, 'bytes');
}
const box = await page.locator('textarea[aria-label="Backup text"]').inputValue();
console.log('export textarea has', box.length, 'chars; app id ok:', box.includes('zefs-dry-night-quest'));
// new adventure (danger)
await page.getByRole('button', { name: 'Start new adventure' }).click();
await page.getByRole('button', { name: 'Start new adventure' }).last().click();
await page.waitForTimeout(500);
console.log('after reset records', JSON.stringify((await save()).records), 'settings kept', JSON.stringify((await save()).settings));
// import pasted text
await page.locator('summary', { hasText: 'Paste backup text instead' }).click();
await page.locator('textarea[aria-label="Paste backup text"]').fill(box);
await page.getByRole('button', { name: 'Import pasted text' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'scripts/out/settings-import-confirm.png', timeout: 120000 });
await page.getByRole('button', { name: 'Replace' }).click();
await page.waitForTimeout(500);
const after = await save();
console.log('after import records', Object.keys(after.records).length, 'seen', JSON.stringify(after.seen));
// bad import
await page.locator('textarea[aria-label="Paste backup text"]').fill('{"hello":1}');
await page.getByRole('button', { name: 'Import pasted text' }).click();
await page.waitForTimeout(300);
console.log('bad import message:', await page.locator('.toast').innerText());
await page.screenshot({ path: 'scripts/out/settings-panel.png', timeout: 120000, fullPage: false });
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
