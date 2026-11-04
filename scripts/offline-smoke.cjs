const { app, BrowserWindow, session } = require('electron');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

app.disableHardwareAcceleration();
let server;
let stage = 'runtime startup';
const deadline = setTimeout(() => {
  console.error(`Offline smoke failed: exceeded 30 seconds during ${stage}.`);
  server?.close(); app.exit(1);
}, 30000);

app.whenReady().then(async () => {
  try {
    stage = 'local server startup';
    const root = path.resolve(__dirname, '../dist');
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
    server = http.createServer(async (request, response) => {
      const url = new URL(request.url, 'http://localhost');
      if (!url.pathname.startsWith('/qr/')) { response.writeHead(404).end(); return; }
      const relative = decodeURIComponent(url.pathname.slice(4)) || 'index.html';
      const file = path.resolve(root, relative);
      if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
      try {
        response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
        response.end(await fs.readFile(file));
      } catch { response.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browserSession = session.fromPartition(`offline-smoke-${Date.now()}`);
    browserSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !details.url.startsWith(`${origin}/`) && !/^(data|blob):/.test(details.url) });
    });
    const win = new BrowserWindow({ show: true, width: 1200, height: 900,
      webPreferences: { session: browserSession, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
    // Exercise the web registration path rather than Electron's local-file path.
    win.webContents.setUserAgent('Mozilla/5.0 Chrome/142.0.0.0 Safari/537.36');
    stage = 'initial page load';
    await win.loadURL(`${origin}/qr/`);
    console.log('Offline smoke: production page loaded.');
    stage = 'service worker installation';
    await win.webContents.executeJavaScript(`(async () => {
      await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Worker installation timed out')), 8000))]);
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    })()`);
    console.log('Offline smoke: service worker installed and controlling page.');
    stage = 'server shutdown';
    await new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    });
    stage = 'offline reload';
    await win.loadURL(`${origin}/qr/`);
    stage = 'offline QR generation';
    const available = await win.webContents.executeJavaScript(`(async () => {
      const input = document.querySelector('textarea');
      if (!input) return false;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'offline verification');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 1000));
      const image = document.querySelector('.qr-image');
      return image && image.naturalWidth === 1024;
    })()`);
    if (!available) throw new Error('QR generation did not work after server shutdown');
    console.log('Offline smoke passed: first-visit precache and QR generation after server shutdown under /qr/.');
    clearTimeout(deadline); app.exit(0);
  } catch {
    console.error(`Offline smoke failed during ${stage}.`);
    server?.close(); clearTimeout(deadline); app.exit(1);
  }
});
