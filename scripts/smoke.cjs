// Uses an already-installed Electron runtime; no browser downloads.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

app.disableHardwareAcceleration();
const deadline = setTimeout(() => {
  console.error('UI smoke failed: runtime did not finish within 30 seconds.');
  app.exit(1);
}, 30000);
app.whenReady().then(async () => {
  console.log('UI smoke: runtime ready.');
  const win = new BrowserWindow({ show: true, width: 1360, height: 1000,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  const failures = [];
  win.webContents.on('console-message', (_event, ...args) => {
    // Do not collect page content or arbitrary console output.
    const level = typeof args[0] === 'object' ? args[0].level : args[0];
    if (level === 'error' || level === 3) failures.push('Renderer console error');
  });
  try {
    await win.loadFile(path.resolve(__dirname, '../dist/index.html'));
    win.setContentSize(1360, 1000);
    console.log('UI smoke: production page loaded.');
    const result = await win.webContents.executeJavaScript(`(async () => {
      const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      await pause(250);
      check(window.innerWidth >= 1100, 'Desktop test viewport was not applied');
      const input = document.querySelector('textarea');
      check(input, 'Content input missing');
      const update = text => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const rendered = () => [...document.images].some(image => image.src.startsWith('data:image/png') && image.naturalWidth === 1024);
      const download = () => [...document.querySelectorAll('button')].find(button => /download png/i.test(button.textContent));
      update('https://example.com/verification');
      await pause(900);
      check(rendered(), '1024-pixel QR preview did not render at its exact export size');
      check(download() && !download().disabled, 'PNG download unavailable after render');
      update('');
      await pause(100);
      check(download().disabled, 'Export retained stale content after clearing input');
      update('مرحبا بالعالم — Custom QR');
      await pause(900);
      check(rendered() && !download().disabled, 'Unicode QR did not render');
      const overflowDesktop = document.documentElement.scrollWidth > window.innerWidth;
      return { title: document.title, overflowDesktop, checks: 3 };
    })()`);
    assert.equal(result.overflowDesktop, false, 'Desktop horizontal overflow');
    await win.webContents.executeJavaScript(`(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ed3030'; ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#253b80'; ctx.fillRect(0, 0, 16, 16);
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], 'smoke-logo.png', {type: 'image/png'}));
      const input = document.querySelector('input[type=file]');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', {bubbles: true}));
      await new Promise(resolve => setTimeout(resolve, 1000));
      const ready = [...document.querySelectorAll('button')].find(button => /download png/i.test(button.textContent));
      if (!ready || ready.disabled) throw new Error('Logo QR did not render');
      const preview = document.querySelector('.qr-image');
      ctx.drawImage(preview, 0, 0, 64, 64);
      const center = ctx.getImageData(32, 32, 1, 1).data;
      if (center[0] < 220 || center[1] > 70) throw new Error('PNG center logo missing');
      const palette = [...document.querySelectorAll('.palette-swatch')].map(b => b.getAttribute('aria-label'));
      if (!palette.includes('Use logo color #ed3030') || !palette.includes('Use logo color #253b80')) throw new Error('Palette altered source logo colors');
      document.querySelector('.palette-swatch.chosen').click();
      await new Promise(resolve => setTimeout(resolve, 400));
      if (!document.querySelector('.qr-image')) throw new Error('Reselecting current color cleared the QR');
      if (document.querySelector('.color-popover')) throw new Error('Unexpected color dropdown');
      if (document.querySelector('input[type=file]').value !== '') throw new Error('Logo input was not reset for reselection');
    })()`);
    if (process.argv.includes('--screenshots')) {
      await fs.writeFile('/tmp/custom-qrcode-generator-desktop.png', (await win.webContents.capturePage()).toPNG());
    }
    win.setSize(390, 844);
    const mobile = await win.webContents.executeJavaScript(`new Promise(resolve => setTimeout(() => resolve(document.documentElement.scrollWidth <= window.innerWidth), 250))`);
    assert.equal(mobile, true, 'Mobile horizontal overflow');
    if (process.argv.includes('--screenshots')) {
      await fs.writeFile('/tmp/custom-qrcode-generator-mobile.png', (await win.webContents.capturePage()).toPNG());
    }
    assert.equal(failures.length, 0, 'Renderer emitted console errors');
    console.log(`UI smoke passed: 1024px PNG generation, clearing, Unicode, logo upload, desktop/mobile layout.`);
    clearTimeout(deadline);
    app.exit(0);
  } catch (error) {
    // Test errors contain only our fixed assertions, never the entered content.
    console.error('UI smoke failed:', error.message);
    app.exit(1);
  }
});
