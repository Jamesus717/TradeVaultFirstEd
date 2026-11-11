// Screenshots of the fair-trade meter for docs/ideas. Needs `npm run demo` on
// localhost:3100 and Microsoft Edge (or set BROWSER to a Chromium binary).
// Usage: node scripts/fair-trade-screens.mjs [outDir]
// Same DevTools-protocol driver as scripts/screens.mjs, full-page shots at
// 1280 and 375 px, and a check that nothing scrolls sideways on the phone.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'docs/ideas/fair-trade-meter';
const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const BROWSER = process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;

mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'tb-screens-'));
const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--hide-scrollbars',
  '--force-prefers-reduced-motion',
  'about:blank',
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((entry) => entry.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    await sleep(200);
  }
  throw new Error('browser did not start');
}

const ws = new WebSocket(await target());
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});
function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) =>
    pending.set(id, (message) => (message.error ? reject(new Error(message.error.message)) : resolve(message.result)))
  );
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return result.result.value;
}

async function viewport(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
}

async function open(path, attempt = 1) {
  await send('Page.navigate', { url: `${BASE}${path}` });
  // Dev server pages hydrate and load remote card images after load.
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    if ((await evaluate('document.readyState')) === 'complete') break;
  }
  // Wait for client data (skeletons gone), up to 15 s.
  let settled = false;
  for (let i = 0; i < 40 && !settled; i++) {
    await sleep(250);
    settled = await evaluate(`!document.querySelector('.animate-pulse')`);
  }
  // The dev server sometimes rebuilds mid-load; one more try.
  if (!settled && attempt < 3) return open(path, attempt + 1);
  await sleep(1500);
}

// Full page, so the whole sidebar and every meter state is in one image.
async function shot(name, fullPage = true) {
  if (!fullPage) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
    console.log(`saved ${name}.png`);
    return;
  }
  // Scroll through once so lazy card images load, then back to the top.
  await evaluate(`(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); } scrollTo(0, 0); })()`);
  await sleep(1500);
  const { contentSize } = await send('Page.getLayoutMetrics');
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: contentSize.width, height: Math.min(contentSize.height, 6000), scale: 1 },
  });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`saved ${name}.png`);
}

const overflow = [];
async function checkWidth(path, width) {
  const scroll = await evaluate('document.documentElement.scrollWidth');
  if (scroll > width) overflow.push(`${path}: scrollWidth ${scroll} at ${width}`);
}

await send('Page.enable');
await send('Runtime.enable');

// Desktop: full pages.
await viewport(1280, 800, false);
for (const [path, name] of [
  ['/', 'matches-desktop'],
  ['/preview/fair-trade', 'chat-desktop'],
]) {
  await open(path);
  await shot(name);
}

// Phone: one screen per part, since the fixed tab bar would sit mid-page in a
// full-page capture.
async function scrollToText(text) {
  await evaluate(`[...document.querySelectorAll('h2, h3, p')].find((el) => el.textContent.trim().startsWith(${JSON.stringify(text)}))?.scrollIntoView({ block: 'start' })`);
  await evaluate('scrollBy(0, -12)');
  await sleep(1200);
}

await viewport(375, 812, true);
await open('/');
await checkWidth('/', 375);
await scrollToText('Fair-trade meter');
await evaluate('scrollBy(0, -260)');
await sleep(800);
await shot('matches-phone', false);

await open('/preview/fair-trade');
await checkWidth('/preview/fair-trade', 375);
await scrollToText('Offer cards');
await shot('chat-picker-phone', false);
await scrollToText('A card with no price yet');
await evaluate(`[...document.querySelectorAll('h3')].find((el) => el.textContent.startsWith('A card with no price yet'))?.parentElement.querySelector('section')?.scrollIntoView({ block: 'center' })`);
await sleep(1000);
await shot('no-price-phone', false);

console.log(overflow.length ? `Wider than the phone: ${overflow.join('; ')}` : 'No page scrolls sideways at 375 px.');
ws.close();
browser.kill();
process.exit(0);
