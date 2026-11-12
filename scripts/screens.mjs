// Screenshots of the demo for docs/redesign. Needs `npm run demo` running on
// localhost:3100 and Microsoft Edge (or set BROWSER to a Chromium binary).
// Usage: node scripts/screens.mjs docs/redesign/2026-11-08
// Drives the browser over the DevTools protocol, so it can hover the side rail
// and press buttons. Also reports any page wider than the phone viewport.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'docs/redesign/latest';
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

async function shot(name) {
  if (process.env.AUDIT_ONLY) return;
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`saved ${name}.png`);
}

const overflow = [];
const smallTargets = [];
async function checkWidth(path, width) {
  const scroll = await evaluate('document.documentElement.scrollWidth');
  if (scroll > width) overflow.push(`${path}: scrollWidth ${scroll} at ${width}`);
  // Tap targets under 44 px tall (links inside running text excepted).
  const small = await evaluate(`[...document.querySelectorAll('a, button, select, input, textarea, [role=switch]')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })
    .filter((el) => !(el.tagName === 'A' && el.closest('p')))
    .filter((el) => el.getBoundingClientRect().height < 44)
    .map((el) => el.tagName.toLowerCase() + ' "' + (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 30) + '" ' + Math.round(el.getBoundingClientRect().height) + 'px')`);
  if (small.length) smallTargets.push(`${path}: ${small.join('; ')}`);
}

async function pressStartTrade() {
  await evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Start trade' && !b.disabled)?.click()`);
  await sleep(600);
  await evaluate(`document.querySelector('[role=alert]')?.scrollIntoView({ block: 'center' })`);
  await sleep(300);
}

await send('Page.enable');
await send('Runtime.enable');

// Desktop, 1280 px: rail collapsed, then hovered open.
await viewport(1280, 800, false);
await open('/');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 900, y: 400 });
await shot('rail-collapsed-desktop');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 36, y: 330 });
await sleep(500);
await shot('rail-expanded-desktop');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 900, y: 400 });
await sleep(400);
await pressStartTrade();
await shot('limit-reached-desktop');
for (const [path, name] of [
  ['/inbox', 'messages-desktop'],
  ['/profile', 'profile-settings-desktop'],
]) {
  await open(path);
  await shot(name);
}

// Tablet, 900 px: icon rail, no hover expand.
await viewport(900, 1000, false);
await open('/binder');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 36, y: 330 });
await sleep(500);
await shot('rail-tablet-hover');

// Phone, 375 px: bottom tab bar.
await viewport(375, 812, true);
for (const [path, name] of [
  ['/', 'home-phone'],
  ['/binder', 'binder-phone'],
  ['/inbox', 'messages-phone'],
  ['/profile', 'profile-settings-phone'],
]) {
  await open(path);
  await checkWidth(path, 375);
  if (path === '/profile') {
    await evaluate(`document.getElementById('settings')?.scrollIntoView({ block: 'center' })`);
    await sleep(300);
  }
  await shot(name);
}
await open('/');
await pressStartTrade();
await shot('limit-reached-phone');

for (const path of ['/matches', '/trade', '/shops', '/shops/example-cards-leeds', '/wishlist', '/collection']) {
  await open(path);
  await checkWidth(path, 375);
}

console.log(smallTargets.length ? `Tap targets under 44 px:\n${smallTargets.join('\n')}` : 'Every tap target is at least 44 px tall.');
console.log(overflow.length ? `Wider than the phone:\n${overflow.join('\n')}` : 'No page scrolls sideways at 375 px.');
ws.close();
browser.kill();
process.exit(0);
