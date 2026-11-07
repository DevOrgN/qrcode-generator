import test from 'node:test';
import assert from 'node:assert/strict';
import { validateText, validateLogo, generateQR, downloadQR, copyQR, shareQR, extractLogoColors } from '../src/lib/qr.js';

test('export helpers reject malformed QR payloads before using browser APIs', async () => {
  for (const dataUrl of [null, '', 'not-a-data-url', 'data:image/svg+xml,<script>alert(1)</script>', 'data:image/png;base64,!!!', 'data:text/html;base64,AA==']) {
    assert.throws(() => downloadQR({ dataUrl, svg: '<svg></svg>' }, 'png'), /invalid/i, String(dataUrl));
    await assert.rejects(copyQR({ dataUrl }), /not supported|denied|Could not copy/i);
  }
  assert.throws(() => downloadQR({ dataUrl: 'data:image/png;base64,AA==', svg: 'javascript:alert(1)' }, 'svg'), /invalid/i);
  assert.throws(() => downloadQR({ dataUrl: 'data:image/png;base64,AA==' }, 'svg'), /invalid/i);
});

test('shareQR rejects malformed images without opening the share sheet', async () => {
  await assert.rejects(shareQR({ dataUrl: 'data:image/svg+xml,<svg onload=alert(1)>' }), /not supported|invalid/i);
  await assert.rejects(shareQR({ dataUrl: 'data:text/html;base64,AA==' }), /not supported|invalid/i);
});

test('generateQR rejects script-bearing and unsupported logo payloads', async () => {
  for (const logo of [
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'javascript:alert(1)',
    'data:image/gif;base64,AA==',
    'data:image/png;base64,!!!',
  ]) {
    await assert.rejects(generateQR('https://example.com', { logo }), /Logo|PNG or JPEG|invalid/i);
  }
  await assert.rejects(generateQR('https://example.com', { background: 'red' }), /hex color/);
  await assert.rejects(generateQR('https://example.com', { foreground: 'url(javascript:alert(1))' }), /hex color/);
});

test('validateText rejects non-string input and over-capacity text per level', () => {
  for (const value of [null, undefined, 42, {}, [], '']) {
    assert.equal(validateText(value).valid, false, String(value));
  }
  assert.equal(validateText('x'.repeat(2350), 'Q').valid, false);
  assert.equal(validateText('x'.repeat(2350), 'L').valid, true);
});

test('validateLogo rejects unsupported types and missing metadata', () => {
  assert.match(validateLogo(null), /Choose/);
  assert.ok(validateLogo({}));
  assert.match(validateLogo({ name: 'evil.svg', type: 'image/svg+xml', size: 10 }), /PNG or JPG/);
  assert.match(validateLogo({ name: 'x.png', type: 'image/png', size: Number.NaN }), /empty/);
  assert.match(validateLogo({ name: 'anim.gif', type: 'image/gif', size: 10 }), /PNG or JPG/);
});

test('logo palette never returns white or near-white', () => {
  const pixels = [];
  for (let i = 0; i < 100; i++) pixels.push(255, 255, 255, 255, 250, 248, 243, 255, 240, 240, 240, 255);
  for (let i = 0; i < 500; i++) pixels.push(10, 20, 30, 255);
  const colors = extractLogoColors(pixels);
  assert.ok(colors.length >= 1);
  for (const color of colors) {
    const [r, g, b] = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
    assert.ok(!(r > 230 && g > 230 && b > 230), color);
  }
});
