// Two family devices and a viewer share one fake artifact database.
import { chromium } from 'playwright';
const OUT = process.argv[2] ?? 'scripts/out';
const URL = process.argv[3] ?? 'http://127.0.0.1:5173/?debug';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const server = new Map(); // path -> body
let writes = 0;
const logs = [];

async function device(tag, { canWrite = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx.exposeBinding('__fakeSet', (_src, path, body) => {
    if (!canWrite) throw Object.assign(new Error('nope'), { code: 'invalid_argument' });
    writes++;
    server.set(path, JSON.parse(body));
  });
  await ctx.exposeBinding('__fakeList', (_src, coll) => {
    // the rules: only family (writers) may read the journeys
    if (!canWrite) return '[]';
    const out = [];
    for (const [p, body] of server) {
      const rest = p.slice(coll.length + 1);
      if (p.startsWith(coll + '/') && !rest.includes('/')) out.push({ id: rest, body });
    }
    return JSON.stringify(out);
  });
  await ctx.addInitScript((canWrite) => {
    const db = {
      doc(path) {
        return {
          set: async (body) => {
            try {
              await window.__fakeSet(path, JSON.stringify(body));
            } catch (e) {
              throw { code: 'invalid_argument', message: String(e) };
            }
          },
        };
      },
      collection(path) {
        return {
          onSnapshot(next) {
            let last = '';
            const tick = async () => {
              const text = await window.__fakeList(path);
              if (text === last) return;
              last = text;
              const docs = JSON.parse(text);
              next({ docs: docs.map((d) => ({ id: d.id, exists: true, data: () => d.body })), metadata: { fromCache: false, hasPendingWrites: false } });
            };
            const h = setInterval(tick, 400);
            void tick();
            return () => clearInterval(h);
          },
        };
      },
    };
    const user = { can: async () => canWrite, id: async () => 'u-test', isOwner: async () => canWrite };
    window.claude = { use: async (name) => (name === 'db' ? db : name === 'user' ? user : null) };
  }, canWrite);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => logs.push(`[${tag} pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[${tag} error] ${m.text()}`); });
  return { ctx, page };
}
const ready = (page) => page.waitForFunction(() => window.__dino?.game().ready, null, { timeout: 120000 });
const kids = (page) => page.evaluate(() => [...document.querySelectorAll('.kid-name')].map((e) => e.textContent));
const status = (page) => page.evaluate(() => window.__dino.cloud());

// device A: has the old one-child save with three dry nights
const A = await device('A');
await A.page.goto(URL, { waitUntil: 'load' });
await A.page.evaluate(() => {
  localStorage.clear();
  const d = new Date();
  const key = (o) => { const x = new Date(d); x.setDate(x.getDate() - o); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  localStorage.setItem('zefs-dino-underpants-quest:v1', JSON.stringify({ app: 'zefs-dino-underpants-quest', version: 1, questId: 'q1', createdAt: d.toISOString(), updatedAt: d.toISOString(), records: { [key(1)]: 'dry', [key(2)]: 'dry', [key(3)]: 'dry' }, profile: { name: 'Zef', species: 'stego', color: 1, setupDone: true }, seen: { stars: 3, prizes: 0, hugDate: null, underpants: false, meter: 3 } }));
});
await A.page.reload({ waitUntil: 'load' });
await ready(A.page);
await A.page.waitForFunction(() => window.__dino.cloud() === 'on', null, { timeout: 30000 });
await A.page.waitForTimeout(1500);
console.log('A status', await status(A.page), 'kids', JSON.stringify(await kids(A.page)), 'server docs', server.size);

// device B: brand new, finds Zef online and plays a dry morning
const B = await device('B');
await B.page.goto(URL, { waitUntil: 'load' });
await ready(B.page);
await B.page.waitForFunction(() => document.querySelectorAll('.kid-name').length > 0, null, { timeout: 30000 });
console.log('B status', await status(B.page), 'kids', JSON.stringify(await kids(B.page)));
await B.page.getByRole('button', { name: "Zef's adventure!" }).click();
await B.page.waitForFunction(() => window.__dino.game().phase === 'ask', null, { timeout: 90000 });
await B.page.evaluate(() => window.__dino.dry());
await B.page.waitForFunction(() => window.__dino.game().phase === 'done', null, { timeout: 240000 }).catch(() => {});
await B.page.screenshot({ path: `${OUT}/s-B-after-dry.png`, timeout: 120000 });

// device A sees the new night
await A.page.waitForTimeout(2000);
const aNights = await A.page.evaluate(() => { const lib = window.__dino.lib(); const c = Object.values(lib.children)[0]; return Object.keys(c.data.records).length; });
console.log('A nights after B played:', aNights);

// B adds Mia; A's title shows her
await B.page.evaluate(() => window.__dino.title());
await B.page.waitForTimeout(800);
await B.page.getByRole('button', { name: '+ Add new child' }).click();
await B.page.getByPlaceholder('Name').fill('Mia');
await B.page.getByRole('button', { name: /Next/ }).click();
await B.page.waitForFunction(() => window.__dino.game().setupStep === 'dino', null, { timeout: 60000 });
await B.page.getByRole('button', { name: 'Triceratops' }).click();
await B.page.waitForFunction(() => window.__dino.game().setupStep === 'color', null, { timeout: 60000 });
await B.page.getByRole('button', { name: /Let's go/ }).click();
await B.page.waitForFunction(() => window.__dino.game().scene === 'board', null, { timeout: 60000 });
await B.page.getByRole('button', { name: /Skip intro/ }).click();
await A.page.waitForTimeout(2500);
console.log('A kids after B added Mia:', JSON.stringify(await kids(A.page)));
await A.page.screenshot({ path: `${OUT}/s-A-title.png`, timeout: 120000 });

// A removes Mia; she disappears on B
await A.page.evaluate(() => {
  const lib = window.__dino.lib();
  const mia = Object.entries(lib.children).find(([, c]) => c.data.profile.name === 'Mia')[0];
  window.__dino.removeChild(mia);
});
await B.page.evaluate(() => window.__dino.title());
await B.page.waitForTimeout(2500);
console.log('B kids after A removed Mia:', JSON.stringify(await kids(B.page)));

// a viewer (another family): can't see Zef, keeps their own on their device
const C = await device('C', { canWrite: false });
await C.page.goto(URL, { waitUntil: 'load' });
await ready(C.page);
await C.page.waitForTimeout(2500);
console.log('C status', await status(C.page), 'kids', JSON.stringify(await kids(C.page)), 'start button', await C.page.getByRole('button', { name: 'Start!' }).count());
console.log('server', JSON.stringify([...server.entries()].map(([p, b]) => [p.slice(0, 30), b.deleted ? 'deleted' : b.journey?.profile?.name, Object.keys(b.journey?.records ?? {}).length])), 'writes', writes);
console.log(logs.slice(0, 20).join('\n') || 'no errors');
await browser.close();
