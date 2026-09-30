import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';

const DIST_DIR = path.resolve('dist');
const OUTPUT_DIR = path.resolve('docs/screenshots');
const PORT = 4173;

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. Static file server for dist/
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || !path.extname(reqPath)) {
    reqPath = '/index.html';
  }
  const filePath = path.join(DIST_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // SPA fallback
    const indexPath = path.join(DIST_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexPath).pipe(res);
  }
});

server.listen(PORT, async () => {
  console.log(`[Preview Server] Running on http://127.0.0.1:${PORT}`);
  try {
    await runCapture();
  } catch (err) {
    console.error('Capture failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});

async function runCapture() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-profile-'));
  const debuggingPort = 9222;

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${tempProfile}`,
    '--window-size=412,915',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    'about:blank',
  ]);

  // Wait for Chrome CDP page target to be available
  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    try {
      const resp = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
      const targets = await resp.json();
      const pageTarget = targets.find((t) => t.type === 'page');
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        wsUrl = pageTarget.webSocketDebuggerUrl;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }

  if (!wsUrl) {
    chromeProc.kill();
    throw new Error('Failed to find Chrome page target');
  }

  console.log(`[CDP] Connected to Chrome at ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  let idCounter = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise((r) => (ws.onopen = r));

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Set up mobile emulation (Pixel 7 / 412x915, DPR 2)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 915,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send('Page.enable');
  await send('Runtime.enable');

  // Navigate to app
  console.log(`[Navigation] Navigating to http://127.0.0.1:${PORT}...`);
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}` });

  // Wait for initial load
  await new Promise((r) => setTimeout(r, 1500));

  // Initialize sample cards, storage, and seed mock activity logs in IndexedDB
  await send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `
      new Promise((resolve) => {
        sessionStorage.setItem('pocketqr_install_dismissed', 'true');
        const sample = [
          {
            id: 'sample-gcash-01',
            bank: 'gcash',
            accountName: 'Nick Vincent G.',
            accountNumber: '09175551234',
            category: 'personal',
            rawPayload: '00020101021126310012ph.com.gcash0111091755512345204601653036085802PH5914NICK VINCENT G6006TAGUIG62150211091755512346304ABCD',
            isFavorite: true,
            orderIndex: 0,
            createdAt: Date.now() - 3600000 * 24
          },
          {
            id: 'sample-maya-02',
            bank: 'maya',
            accountName: 'N. Gultiano Services',
            accountNumber: '09985554567',
            category: 'business',
            rawPayload: '00020101021126260007ph.maya0111099855545675204601653036085802PH5919N GULTIANO SERVICES6006MANILA621502110998555456763041234',
            isFavorite: true,
            orderIndex: 1,
            createdAt: Date.now() - 3600000 * 12
          },
          {
            id: 'sample-rcbc-03',
            bank: 'rcbc',
            accountName: 'Nick Vincent Gultiano',
            accountNumber: '100988887890',
            category: 'savings',
            rawPayload: '00020101021126310011ph.com.rcbc01121009888878905204601653036085802PH5915NICK V GULTIANO6006MAKATI6216011210098888789063045678',
            isFavorite: false,
            orderIndex: 2,
            createdAt: Date.now() - 3600000 * 6
          }
        ];
        localStorage.setItem('pocketqr_cards', JSON.stringify(sample));
        localStorage.setItem('pocketqr_privacy_mask', 'true');
        localStorage.setItem('pocketqr_theme_tone', 'MINT');

        const req = indexedDB.open('pocketqr_db');
        req.onsuccess = (e) => {
          const db = e.target.result;
          if (db.objectStoreNames.contains('activity_logs')) {
            const tx = db.transaction('activity_logs', 'readwrite');
            const store = tx.objectStore('activity_logs');
            store.put({
              id: 'log-1',
              type: 'routed_payment',
              title: 'Nick Vincent G.',
              bank: 'GCASH',
              accountNumber: '0917 •••• 1234',
              amount: 'PHP 450.00',
              detail: 'Dispatched to GCash via QR Ph switch',
              timestamp: Date.now() - 1000 * 60 * 15,
            });
            store.put({
              id: 'log-2',
              type: 'copied_details',
              title: 'N. Gultiano Services',
              bank: 'MAYA',
              accountNumber: '0998 •••• 4567',
              detail: 'Copied account credentials to clipboard',
              timestamp: Date.now() - 1000 * 60 * 120,
            });
            store.put({
              id: 'log-3',
              type: 'saved_qr_photo',
              title: 'RCBC Pulz Savings',
              bank: 'RCBC',
              detail: 'Saved QR Ph barcode to system gallery',
              timestamp: Date.now() - 1000 * 60 * 300,
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          } else {
            resolve(true);
          }
        };
        req.onerror = () => resolve(false);
      })
    `,
  });

  // Reload with storage active
  await send('Page.reload');
  await new Promise((r) => setTimeout(r, 1200));

  async function captureToFile(filename) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`[Screenshot Saved] -> ${filePath}`);
  }

  // 1. Capture Vault View
  console.log('Capturing 01: vault-view.png...');
  await captureToFile('vault-view.png');

  // 2. Click the first card to open PresentationModal
  console.log('Opening presentation modal...');
  await send('Runtime.evaluate', {
    expression: `
      const cardEl = document.querySelector('.group\\\\/card');
      if (cardEl) cardEl.click();
    `,
  });
  await new Promise((r) => setTimeout(r, 600));
  console.log('Capturing 02: presentation-view.png...');
  await captureToFile('presentation-view.png');

  // Close presentation modal
  await send('Runtime.evaluate', {
    expression: `
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('close'));
      if (closeBtn) closeBtn.click();
    `,
  });
  await new Promise((r) => setTimeout(r, 400));

  // 3. Open Scanner Modal (click elevated scan button)
  console.log('Opening scanner modal with fake camera stream...');
  await send('Runtime.evaluate', {
    expression: `
      const scanBtn = document.querySelector('button[aria-label="Scan to Pay"]');
      if (scanBtn) scanBtn.click();
    `,
  });
  // Give camera stream time to start up and render video
  await new Promise((r) => setTimeout(r, 1500));
  console.log('Capturing 03: scanner-view.png...');
  await captureToFile('scanner-view.png');

  // Close scanner modal
  await send('Runtime.evaluate', {
    expression: `
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('CANCEL SCAN'));
      if (cancelBtn) cancelBtn.click();
    `,
  });
  await new Promise((r) => setTimeout(r, 500));

  // 4. Click Config Tab
  console.log('Opening config tab...');
  await send('Runtime.evaluate', {
    expression: `
      const configBtn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('CONFIG'));
      if (configBtn) configBtn.click();
    `,
  });
  await new Promise((r) => setTimeout(r, 800));
  console.log('Capturing 04: settings-view.png...');
  await captureToFile('settings-view.png');

  // 5. Click Logs Tab
  console.log('Opening logs tab...');
  await send('Runtime.evaluate', {
    expression: `
      const logsBtn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('LOGS'));
      if (logsBtn) logsBtn.click();
    `,
  });
  await new Promise((r) => setTimeout(r, 800));
  console.log('Capturing 05: logs-view.png...');
  await captureToFile('logs-view.png');

  ws.close();
  chromeProc.kill();
  try {
    fs.rmSync(tempProfile, { recursive: true, force: true });
  } catch {}
  console.log('All 5 high-resolution mobile screenshots updated successfully!');
}
