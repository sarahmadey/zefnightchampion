// Title screen: first time (Start), add two children, come back to the title, old save brought over.
import { chromium } from 'playwright';
const OUT = process.argv[2] ?? 'scripts/out';
const URL = process.argv[3] ?? 'http://127.0.0.1:5173/?debug';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const logs = [];
async function fresh(size = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${t}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  return { ctx, page };
}
const ready = (page) => page.waitForFunction(() => window.__dino?.game().ready, null, { timeout: 120000 });
const shot = (page, name) => page.screenshot({ path: `${OUT}/t-${name}.png`, timeout: 120000 });

async function setupChild(page, name, species, colorName) {
  await page.getByPlaceholder('Name').fill(name);
  await page.getByRole('button', { name: /Next/ }).click();
  await page.waitForFunction(() => window.__dino.game().setupStep === 'dino', null, { timeout: 60000 });
  await page.getByRole('button', { name: species }).click();
  await page.waitForFunction(() => window.__dino.game().setupStep === 'color', null, { timeout: 60000 });
  await page.getByRole('button', { name: colorName, exact: true }).click();
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.waitForFunction(() => (window.__dino.game().cutscene ?? '').startsWith('setup-done') && window.__dino.game().scene === 'board', null, { timeout: 60000 });
  await page.getByRole('button', { name: /Skip intro/ }).click();
  await page.waitForFunction(() => window.__dino.game().phase === 'ask', null, { timeout: 60000 });
}

// 1. first time
{
  const { ctx, page } = await fresh();
  await page.goto(URL, { waitUntil: 'load' });
  await ready(page);
  await page.waitForTimeout(2500);
  await shot(page, '1-first');
  await page.getByRole('button', { name: 'Start!' }).click({ force: true });
  await page.waitForTimeout(800);
  await shot(page, '2-name');
  // back to the title, then really start
  await page.getByRole('button', { name: 'Back' }).click();
  await page.waitForTimeout(800);
  console.log('after back:', JSON.stringify(await page.evaluate(() => ({ phase: window.__dino.game().phase, kids: Object.keys(window.__dino.lib().children).length }))));
  await page.getByRole('button', { name: 'Start!' }).click({ force: true });
  await setupChild(page, 'Zef', 'T. rex', 'Green');
  await page.evaluate(() => window.__dino.title());
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '+ Add new child' }).click();
  await setupChild(page, 'Mia', 'Long-neck', 'Purple');
  await page.reload({ waitUntil: 'load' });
  await ready(page);
  await page.waitForTimeout(3000);
  await shot(page, '3-two-kids');
  console.log('title kids:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.kid-name')].map((e) => e.textContent))));
  await page.getByRole('button', { name: "Mia's adventure!" }).click();
  await page.waitForFunction(() => window.__dino.game().phase === 'ask', null, { timeout: 90000 });
  await page.waitForTimeout(800);
  await shot(page, '4-mia-board');
  console.log('playing:', JSON.stringify(await page.evaluate(() => ({ name: window.__dino.save().profile.name, species: window.__dino.save().profile.species }))));
  await ctx.close();
}

// 2. an old one-child save is brought over
{
  const { ctx, page } = await fresh();
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.clear();
    const d = new Date();
    const key = (o) => { const x = new Date(d); x.setDate(x.getDate() - o); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    const records = { [key(1)]: 'dry', [key(2)]: 'dry', [key(3)]: 'dry' };
    localStorage.setItem('zefs-dino-underpants-quest:v1', JSON.stringify({ app: 'zefs-dino-underpants-quest', version: 1, questId: 'q1', createdAt: d.toISOString(), updatedAt: d.toISOString(), records, profile: { name: 'Zef', species: 'stego', color: 1, setupDone: true }, seen: { stars: 3, prizes: 0, hugDate: null, underpants: false, meter: 3 } }));
  });
  await page.reload({ waitUntil: 'load' });
  await ready(page);
  await page.waitForTimeout(3000);
  await shot(page, '5-legacy');
  console.log('legacy kids:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.kid-name')].map((e) => e.textContent))));
  await page.getByRole('button', { name: "Zef's adventure!" }).click();
  await page.waitForFunction(() => ['ask', 'done'].includes(window.__dino.game().phase), null, { timeout: 90000 });
  console.log('legacy stars:', await page.evaluate(() => window.__dino.game().shownStars));
  await ctx.close();
}
console.log(logs.filter((l) => !/GPU stall|WebGL|SwiftShader|THREE\.Clock|Download the React/.test(l)).slice(0, 20).join('\n') || 'no errors');
await browser.close();
