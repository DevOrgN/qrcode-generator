import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OPTIONS,
  byteLength,
  validateText,
  validateLogo,
  loadLogo,
  contrastRatio,
  generateQR,
  downloadQR,
  copyQR,
  shareQR,
} from '../src/lib/qr.js';

function pngHeader(width, height) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function fakeFile({ type = 'image/png', data = pngHeader(64, 32), size } = {}) {
  return { type, size: size ?? data.byteLength, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
}

test('defaults define a conservative high correction QR configuration', () => {
  assert.deepEqual(DEFAULT_OPTIONS, {
    foreground: '#18181b', background: '#ffffff', size: 1024,
    errorCorrectionLevel: 'H', margin: 4,
  });
});

test('byteLength counts UTF-8 bytes and text validation preserves input semantics', () => {
  assert.equal(byteLength('hello'), 5);
  assert.equal(byteLength('مرحبا'), 10);
  assert.equal(byteLength('🙂'), 4);
  assert.equal(validateText('   ').valid, false);
  const text = '  https://example.test/a?x=1  ';
  const result = validateText(text, 'M');
  assert.equal(result.valid, true);
  assert.equal(result.bytes, Buffer.byteLength(text, 'utf8'));
  assert.equal(result.maxBytes, 2331);
  assert.equal(validateText('x'.repeat(1300), 'H').valid, false);
  assert.equal(validateText('hello', 'unsupported').valid, false);
});

test('logo metadata validation and image content checks enforce type, size, signature, and dimensions', async () => {
  assert.equal(validateLogo(fakeFile()), null);
  assert.match(validateLogo(fakeFile({ type: 'image/gif' })), /PNG or JPEG/);
  assert.match(validateLogo(fakeFile({ size: 2 * 1024 * 1024 + 1 })), /2 MiB/);
  const loaded = await loadLogo(fakeFile());
  assert.equal(loaded.width, 64);
  assert.equal(loaded.height, 32);
  assert.match(loaded.dataUrl, /^data:image\/png;base64,/);
  assert.deepEqual(loaded.colors, []);
  await assert.rejects(loadLogo(fakeFile({ data: new Uint8Array([1, 2, 3, 4]) })), /content/);
  await assert.rejects(loadLogo(fakeFile({ data: pngHeader(4097, 1) })), /dimensions/);
});

test('contrast ratio uses WCAG relative luminance and rejects malformed colors', () => {
  assert.equal(contrastRatio('#000', '#fff'), 21);
  assert.ok(contrastRatio('#173f35', '#ffffff') > 10);
  assert.throws(() => contrastRatio('red', '#fff'), /hex color/);
});

test('generateQR produces a crisp PNG and SVG with a four-module quiet zone', async () => {
  const result = await generateQR('QR test — مرحبا', { size: 512, foreground: '#123456', background: '#fafafa', margin: 0 });
  assert.equal(result.size, 512);
  assert.equal(result.bytes, Buffer.byteLength('QR test — مرحبا', 'utf8'));
  assert.ok(result.modules > 0);
  assert.match(result.dataUrl, /^data:image\/png;base64,/);
  assert.match(result.svg, /<svg/);
  assert.match(result.svg, /#123456/i);
  assert.match(result.svg, /viewBox="0 0/);
  assert.match(result.svg, /<path/);
  await assert.rejects(generateQR('valid', { size: 800 }), /512, 1024, or 2048/);
  await assert.rejects(generateQR('valid', { foreground: 'green' }), /hex color/);
});

test('export helpers report unavailable and unsupported operations clearly', async () => {
  await assert.rejects(copyQR({ dataUrl: 'data:image/png;base64,AA==' }), /not supported|denied|Could not copy/i);
  await assert.rejects(shareQR({ dataUrl: 'data:image/png;base64,AA==' }), /not supported/i);
  assert.throws(() => downloadQR(null), /Create a QR code/);
  assert.throws(() => downloadQR({ dataUrl: 'data:image/png;base64,AA==', svg: '<svg/>' }, 'webp'), /PNG or SVG/);
});

test('share cancellation is silent when file sharing is available', { skip: typeof File === 'undefined' }, async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      canShare: () => true,
      share: async () => { throw Object.assign(new Error('dismissed'), { name: 'AbortError' }); },
    },
  });
  try {
    await assert.doesNotReject(shareQR({ dataUrl: 'data:image/png;base64,AA==' }));
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else delete globalThis.navigator;
  }
});
