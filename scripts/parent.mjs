// Drive the parent corner through the real UI on a phone-sized screen.
import { chromium } from 'playwright';
const [w = '390', h = '844', name = 'parent'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|DevTools|THREE.Clock/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://127.0.0.1:5173/?debug&speed=1.5', { waitUntil: 'load' });
await page.waitForTimeout(7000);
await page.screenshot({ path: `scripts/out/${name}-01-start.png`, timeout: 120000 });
await page.getByRole('button', { name: 'Got it' }).click();
// press and hold the parent button
const btn = page.getByRole('button', { name: /Parent corner/ });
const box = await btn.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(1500);
await page.mouse.up();
await page.waitForTimeout(500);
await page.screenshot({ path: `scripts/out/${name}-02-gate.png`, timeout: 120000 });
// answer the multiplication question
const q = await page.locator('.gate strong').innerText();
const [a, b] = q.split('×').map((x) => parseInt(x.trim(), 10));
await page.getByRole('button', { name: String(a * b), exact: true }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `scripts/out/${name}-03-panel.png`, timeout: 120000 });
await page.getByRole('button', { name: /Dry night/ }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `scripts/out/${name}-04-confirm.png`, timeout: 120000 });
await page.getByRole('button', { name: /Yes, record it/ }).click();
// double tap protection: try clicking again quickly (should not exist / be disabled)
const again = await page.getByRole('button', { name: /Yes, record it/ }).count();
console.log('confirm still present after click:', again);
await page.waitForTimeout(5000);
await page.screenshot({ path: `scripts/out/${name}-05-event.png`, timeout: 120000 });
const st = await page.evaluate(() => ({ g: { cut: window.__zef.game().cutscene, lit: window.__zef.game().litStop }, rec: window.__zef.save().records }));
console.log(JSON.stringify(st));
await page.waitForTimeout(9000);
await page.screenshot({ path: `scripts/out/${name}-06-arrived.png`, timeout: 120000 });
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
