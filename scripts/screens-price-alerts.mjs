// Screenshots for docs/ideas/price-alerts. Needs `npm run demo` on
// localhost:3100 and Microsoft Edge (or set BROWSER to a Chromium binary).
// Usage: node scripts/screens-price-alerts.mjs
// Uses DevTools device emulation, because a headless window can't go as
// narrow as 375 px on its own.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'docs/ideas/price-alerts';
const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const BROWSER = process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9334;

mkdirSync(OUT, { recursive: true });
const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'tb-alerts-'))}`,
  '--hide-scrollbars',
  '--force-prefers-reduced-motion',
  'about:blank',
]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    wsUrl = list.find((entry) => entry.type === 'page')?.webSocketDebuggerUrl;
  } catch {
    // not up yet
  }
  if (!wsUrl) await sleep(200);
}
if (!wsUrl) throw new Error('browser did not start');

const ws = new WebSocket(wsUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  pending.get(message.id)?.(message);
  pending.delete(message.id);
});
const send = (method, params = {}) => {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) =>
    pending.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)))
  );
};
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

await send('Page.enable');
await send('Runtime.enable');

const problems = [];
for (const [width, height, mobile, suffix] of [
  [375, 812, true, 'phone'],
  [1280, 800, false, 'desktop'],
]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  for (const [path, name] of [
    ['/', 'home'],
    ['/wishlist', 'wishlist'],
  ]) {
    await send('Page.navigate', { url: `${BASE}${path}` });
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      if (await evaluate(`document.readyState === 'complete' && !!document.getElementById('under-target')`)) break;
    }
    // On a phone the section sits below the fold, so start the shot there.
    if (mobile) await evaluate(`document.getElementById('under-target')?.closest('section')?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -72)`);
    await sleep(2000);
    const scroll = await evaluate('document.documentElement.scrollWidth');
    if (scroll > width) problems.push(`${path}: scrollWidth ${scroll} at ${width}`);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, `${name}-${suffix}.png`), Buffer.from(data, 'base64'));
    console.log(`saved ${name}-${suffix}.png`);
  }
}
console.log(problems.length ? `Too wide:\n${problems.join('\n')}` : 'No page scrolls sideways.');
ws.close();
browser.kill();
process.exit(0);
