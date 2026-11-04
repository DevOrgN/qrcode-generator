import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQR } from '../src/lib/qr.js';

test('logo SVG uses a transform from pixel coordinates into module coordinates', async () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  class MockImage {
    naturalWidth = 64;
    naturalHeight = 64;
    set src(_value) { queueMicrotask(() => this.onload()); }
  }
  const context = { drawImage() {}, beginPath() {}, roundRect() {}, fill() {} };
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: MockImage });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ getContext: () => context, toDataURL: () => 'data:image/png;base64,AA==' }),
  } });
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(bytes.buffer).setUint32(16, 64);
  new DataView(bytes.buffer).setUint32(20, 64);
  try {
    for (const size of [512, 1024, 2048]) {
      const result = await generateQR('https://example.com/logo', {
        size, errorCorrectionLevel: 'L', logo: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`,
      });
      const view = /viewBox="0 0 ([\d.]+) [\d.]+"/.exec(result.svg);
      const scale = /<g transform="scale\(([\d.]+)\)"/.exec(result.svg);
      assert.ok(scale, 'Logo must use module coordinates');
      assert.equal(Number(scale[1]) * size, Number(view[1]));
      assert.match(result.svg, /href="data:image\/png;base64,/);
    }
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
    if (previousImage) Object.defineProperty(globalThis, 'Image', previousImage);
    else delete globalThis.Image;
  }
});
