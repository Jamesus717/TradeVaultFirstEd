// `npm run audit:mobile`: Playwright at 375x812 on every route.
// Checks sideways scroll, tap targets under 44 px, text under 14 px and anything
// overlapping the fixed bottom tab bar. Starts `npm run demo` if port 3100 is free.
// Output: reports/mobile-audit/report.md, report.json and one screenshot per route.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.AUDIT_BASE || 'http://localhost:3100';
const OUT = 'reports/mobile-audit';
const ROUTES = [
  '/', '/binder', '/collection', '/inbox', '/inbox/demo-chat-1', '/matches', '/preview',
  '/profile', '/profile/demo-sam', '/reset-password', '/shops', '/shops/example-cards-leeds',
  '/trade', '/u/sam', '/wishlist',
];

async function up() {
  try { return (await fetch(BASE)).status < 500; } catch { return false; }
}

function inPage() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const desc = (el) => {
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/)[0] : ''} "${t}"`;
  };
  const res = { scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, small: [], text: [], overlap: [], wide: [] };
  const tabbar = [...document.querySelectorAll('nav,div')].find((n) => {
    const s = getComputedStyle(n); const r = n.getBoundingClientRect();
    return s.position === 'fixed' && r.bottom >= innerHeight - 1 && r.top > innerHeight / 2 && r.width >= innerWidth - 2 && n.querySelector('a');
  });
  const tb = tabbar ? tabbar.getBoundingClientRect() : null;
  res.tabbar = !!tabbar;
  for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],summary')) {
    if (!vis(el) || (tabbar && tabbar.contains(el))) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) res.small.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (tb && getComputedStyle(el).position !== 'fixed' && r.bottom > tb.top && r.top < tb.bottom) res.overlap.push(desc(el));
  }
  const seen = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const n = w.currentNode; const el = n.parentElement;
    if (!el || !n.textContent.trim() || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || !vis(el) || (tabbar && tabbar.contains(el))) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 14) { const k = `${fs}px ${desc(el)}`; if (!seen.has(k)) { seen.add(k); res.text.push(k); } }
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed' && res.wide.length < 8) res.wide.push(`${desc(el)} right=${Math.round(r.right)}`);
  }
  return res;
}

let server;
if (!(await up())) {
  server = spawn('npm run demo', { stdio: 'ignore', shell: true });
  for (let i = 0; i < 90 && !(await up()); i++) await new Promise((r) => setTimeout(r, 1000));
  if (!(await up())) { console.error('demo server did not start'); process.exit(2); }
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
const results = [];
for (const route of ROUTES) {
  const page = await ctx.newPage(); console.error(new Date().toISOString().slice(11,19), route);
  try {
    const resp = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
    // wait for client-rendered content to settle (dev server never goes network-idle)
    for (let i = 0, last = -1; i < 20; i++) {
      const n = await page.evaluate(() => document.body.innerText.length);
      if (n === last && n > 0 && i > 2) break;
      last = n;
      await page.waitForTimeout(500);
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); // overlap is judged at the end of the page
    await page.waitForTimeout(200);
    const r = await page.evaluate(inPage);
    r.route = route;
    r.status = resp?.status();
    r.hscroll = r.scrollW > r.clientW;
    r.shot = `${route === '/' ? 'home' : route.slice(1).replace(/\//g, '_')}.png`;
    await page.screenshot({ path: `${OUT}/${r.shot}`, fullPage: true });
    results.push(r);
  } catch (e) {
    results.push({ route, error: String(e).slice(0, 200), small: [], text: [], overlap: [], wide: [] });
  }
  await page.close();
}
await browser.close();
if (server?.pid) spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });

const L = ['# Mobile audit (375x812)', '', '| Route | Sideways scroll | Small taps | Small text | Tab bar overlap |', '|---|---|---|---|---|'];
for (const r of results) L.push(r.error ? `| ${r.route} | ERROR | | | |` : `| ${r.route} | ${r.hscroll ? `YES (${r.scrollW}px)` : 'no'} | ${r.small.length} | ${r.text.length} | ${r.overlap.length} |`);
for (const r of results) {
  L.push('', `## ${r.route}`);
  if (r.error) { L.push(`Error: ${r.error}`); continue; }
  L.push(`Screenshot: ${r.shot}; HTTP ${r.status}; tab bar found: ${r.tabbar}`);
  for (const [k, v] of [['Sideways overflow', r.hscroll ? r.wide : []], ['Taps under 44px', r.small], ['Text under 14px', r.text], ['Overlaps tab bar', r.overlap]]) if (v.length) L.push(`- ${k}:`, ...v.slice(0, 15).map((x) => `  - ${x}`));
}
writeFileSync(`${OUT}/report.md`, L.join('\n') + '\n');
writeFileSync(`${OUT}/report.json`, JSON.stringify(results, null, 1));
console.log(L.slice(0, 4 + results.length).join('\n'));
