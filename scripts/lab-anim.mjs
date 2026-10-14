// Frames of one action in the dev lab: node scripts/lab-anim.mjs trex 0 roar 34 4 tag [coach] [talk]
import { chromium } from 'playwright';
const [, , species = 'trex', color = '0', action = 'roar', view = '34', framesArg = '4', tag = 'anim', coach = '0', talk = '0'] = process.argv;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 520, height: 520 }, deviceScaleFactor: 1 })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
await page.goto(`http://127.0.0.1:5173/lab.html?species=${species}&color=${color}&coach=${coach}&view=${view}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__lab, null, { timeout: 120000 });
await page.waitForTimeout(2500);
await page.evaluate(([a, talk]) => {
  const act = window.__lab.actor;
  act.talk = Number(talk);
  if (a === 'walk') act.walk = 1;
  else if (a !== 'none') act.action = { name: a, t: 0, dur: 2.4, loop: true };
}, [action, talk]);
for (let i = 0; i < Number(framesArg); i++) {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `scripts/out/${tag}-${species}-${action}-${i}.png`, timeout: 120000 });
}
console.log(logs.join('\n'));
await browser.close();
