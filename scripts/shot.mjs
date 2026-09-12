// 使い方は skills/html-to-png-parts/SKILL.md を参照
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const [html, out, w, h, scale = '1'] = process.argv.slice(2);
if (!html || !out || !w || !h) {
  console.error('usage: node shot.mjs <html> <out.png> <width> <height> [scale]');
  process.exit(1);
}

function findChrome() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const caches = [join(homedir(), 'Library/Caches/ms-playwright'), join(homedir(), '.cache/ms-playwright')];
  for (const cache of caches) {
    if (!existsSync(cache)) continue;
    const dirs = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse();
    for (const d of dirs) {
      for (const sub of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell-linux']) {
        const bin = join(cache, d, sub, 'chrome-headless-shell');
        if (existsSync(bin)) return bin;
      }
    }
  }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(chrome)) return chrome;
  throw new Error('Chromium が見つかりません。CHROME_BIN で指定してください');
}

const bin = findChrome();
const port = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn(bin, ['--headless', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await wait(100); }
  }
  if (!targets) throw new Error('DevTools に接続できません');
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

  await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: +scale, mobile: false });
  // --default-background-color フラグは headless shell で効かないため CDP で透明化する
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await send('Page.enable');
  await send('Page.navigate', { url: 'file://' + resolve(html) });
  await wait(2500); // Web フォントの読み込み待ち
  const { result } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: +w, height: +h, scale: 1 } });
  writeFileSync(out, Buffer.from(result.data, 'base64'));
  ws.close();
  console.log('wrote', out);
} finally {
  chrome.kill();
}
