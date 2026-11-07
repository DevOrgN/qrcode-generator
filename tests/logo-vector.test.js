import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQR } from '../src/lib/qr.js';

function pngUrl(width, height) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
}

test('logo SVG uses a transform from pixel coordinates into module coordinates', async () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const canvases = [];
  class MockImage {
    naturalWidth = 64;
    naturalHeight = 64;
    set src(_value) { queueMicrotask(() => this.onload()); }
  }
  const context = { drawImage() {}, fillRect() {}, beginPath() {}, roundRect() {}, fill() {},
    getImageData: (x, y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4).map((_, i) => i % 4 === 3 ? 255 : 0) }),
    createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: MockImage });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => context, toDataURL: () => pngUrl(canvas.width || 64, canvas.height || 64) };
      canvases.push(canvas);
      return canvas;
    },
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
      assert.deepEqual([canvases.at(-1).width, canvases.at(-1).height], [size, size]);
    }
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
    if (previousImage) Object.defineProperty(globalThis, 'Image', previousImage);
    else delete globalThis.Image;
  }
});

test('transparent logo padding is cropped to visible alpha bounds', async () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const canvases = [];
  class MockImage {
    naturalWidth = 8;
    naturalHeight = 6;
    set src(_value) { queueMicrotask(() => this.onload()); }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: MockImage });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => ({
        drawImage: (...args) => { canvas.drawArgs = args; },
        getImageData: () => {
          const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
          // Visible pixels span x=2..5 and y=1..4; fully transparent padding surrounds them.
          for (let y = 1; y <= 4; y += 1) for (let x = 2; x <= 5; x += 1) data[(y * canvas.width + x) * 4 + 3] = 255;
          return { data };
        },
      }), toDataURL: () => 'data:image/png;base64,AA==' };
      canvases.push(canvas);
      return canvas;
    },
  } });
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(bytes.buffer).setUint32(16, 8);
  new DataView(bytes.buffer).setUint32(20, 6);
  const file = { type: 'image/png', size: bytes.length, arrayBuffer: async () => bytes.buffer };
  try {
    const logo = await (await import('../src/lib/qr.js')).loadLogo(file);
    assert.deepEqual([logo.width, logo.height], [4, 4]);
    assert.deepEqual([canvases[2].width, canvases[2].height], [4, 4]);
    assert.deepEqual(canvases[2].drawArgs.slice(1), [2, 1, 4, 4, 0, 0, 4, 4]);
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
    if (previousImage) Object.defineProperty(globalThis, 'Image', previousImage);
    else delete globalThis.Image;
  }
});

test('aspect-shaped logo gets a compact rounded white backing shared by SVG and PNG', async () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const preparedSize = [];
  const backingCalls = [];
  class MockImage {
    naturalWidth = 160;
    naturalHeight = 80;
    set src(_value) { queueMicrotask(() => this.onload()); }
  }
  const context = {
    drawImage(...args) { backingCalls.push(['drawImage', ...args.slice(1)]); }, fillRect() {}, beginPath() {},
    roundRect(...args) { backingCalls.push(['roundRect', ...args]); }, fill() { backingCalls.push(['fill', this.fillStyle]); },
    getImageData: (x, y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4).map((_, i) => i % 4 === 3 ? 255 : 0) }),
    createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {},
  };
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: MockImage });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => { const canvas = { width: 0, height: 0, getContext: () => context, toDataURL: () => pngUrl(canvas.width || 160, canvas.height || 80) }; preparedSize.push(canvas); return canvas; },
  } });
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(bytes.buffer).setUint32(16, 160);
  new DataView(bytes.buffer).setUint32(20, 80);
  const logo = `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
  try {
    const result = await generateQR('https://example.com/wide-logo', { size: 512, logo });
    const match = /<image x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(result.svg);
    assert.ok(match, 'SVG should embed the prepared composited logo');
    const [ix, iy, iw, ih] = match.slice(1).map(Number);
    assert.ok(iw <= 512 * 0.22 && ih <= 512 * 0.22, 'logo extent should use the modestly increased maximum');
    assert.ok(iw > 512 * 0.18, 'logo should be slightly larger than the former maximum');
    assert.ok(Math.abs(iw / ih - (166 / 86)) < 1e-9, 'SVG should use the same aspect-shaped backing asset');
    assert.ok(Math.abs((ix + iw / 2) - 256) < 1e-9);
    assert.ok(Math.abs((iy + ih / 2) - 256) < 1e-9);
    const prepared = preparedSize.find(canvas => canvas.width === 166 && canvas.height === 86);
    assert.deepEqual([prepared.width, prepared.height], [166, 86], 'backing should add only compact proportional padding');
    assert.ok(backingCalls.some(call => call[0] === 'roundRect' && call[1] === 0 && call[2] === 0 && call[3] === 166 && call[4] === 86), 'white backing should use rounded artwork bounds');
    assert.ok(backingCalls.some(call => call[0] === 'fill' && call[1] === '#fff'), 'backing should be solid white');
    assert.ok(backingCalls.some(call => call[0] === 'drawImage' && call.at(-2) === 3 && call.at(-1) === 3), 'artwork should sit inside the padded backing');
    assert.match(result.svg, /href="data:image\/png;base64,/);
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
    if (previousImage) Object.defineProperty(globalThis, 'Image', previousImage);
    else delete globalThis.Image;
  }
});
