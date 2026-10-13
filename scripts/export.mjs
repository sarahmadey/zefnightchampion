// Backup export in three hosts: a plain page (link download), the artifact
// viewer's save prompt (accepted), and the same prompt declined.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const url = process.argv[2] ?? 'http://127.0.0.1:5173/?debug&noevents';

async function run(label, viewer) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((viewer) => {
    localStorage.setItem('zefs-dry-night-quest:welcomed', '1');
    if (!viewer) return;
    window.__saves = [];
    const downloads = Object.freeze({
      save: async (req) => {
        window.__saves.push({ filename: req.filename, length: String(req.data).length, ok: String(req.data).includes('zefs-dry-night-quest') });
        if (viewer === 'decline') throw { code: 'declined', message: 'no' };
        return { status: 'saved' };
      },
    });
    window.claude = Object.freeze({ use: (name) => new Promise((r) => setTimeout(() => r(name === 'downloads' ? downloads : null), 50)) });
  }, viewer);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.__zef.recordRun(2, 0));
  await page.evaluate(() => window.__zef.setParentOpen(true));
  await page.waitForTimeout(400);
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 4000 }).catch(() => null),
    page.getByRole('button', { name: 'Export backup' }).click(),
  ]);
  await page.waitForTimeout(300);
  const saves = await page.evaluate(() => window.__saves ?? null);
  const toast = await page.locator('.toast').innerText().catch(() => '(none)');
  const box = await page.locator('textarea[aria-label="Backup text"]').inputValue().catch(() => '');
  console.log(`${label}: link download=${dl ? dl.suggestedFilename() : 'none'} viewer saves=${JSON.stringify(saves)} text=${box.length} chars message="${toast}" errors=${errors.length}`);
  await ctx.close();
}

await run('plain page', null);
await run('viewer accepts', 'accept');
await run('viewer declines', 'decline');
await browser.close();
