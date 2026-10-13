// Production build check: loads with no external requests, then starts setup.
import { chromium } from 'playwright';
const [url = 'http://127.0.0.1:4173/', w = '390', h = '844', name = 'prod'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true, isMobile: +w < 700 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()}`));
const external = [];
page.on('request', (r) => { const u = r.url(); if (!u.startsWith('http://127.0.0.1') && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(9000);
await page.screenshot({ path: `scripts/out/${name}-first-run.png`, timeout: 120000 });
// first-time setup: name, then Coach Rex starts talking (voice clips are bundled)
await page.getByRole('button', { name: /Next/ }).click();
await page.waitForTimeout(6000);
await page.screenshot({ path: `scripts/out/${name}-pick-dino.png`, timeout: 120000 });
console.log('external requests:', external.length ? external : 'none');
console.log(logs.filter((l) => !/THREE.Clock/.test(l)).slice(0, 20).join('\n') || 'no console output');
await browser.close();
