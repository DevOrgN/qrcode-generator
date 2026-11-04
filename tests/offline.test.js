import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

function worker(fetchImpl) {
  const events = {};
  const entries = new Map();
  let skipped = false;
  const scope = 'https://studio.test/tools/qr/';
  const context = {
    URL, Response, Set, Promise,
    fetch: fetchImpl,
    self: {
      registration: { scope }, location: { origin: 'https://studio.test' },
      __PRECACHE_URLS__: ['./index.html', './assets/app.js'],
      addEventListener: (name, handler) => { events[name] = handler; },
      skipWaiting: async () => { skipped = true; }, clients: { claim: async () => {} },
    },
    caches: {
      open: async () => ({ put: async (key, value) => entries.set(key, value), match: async (key) => entries.get(key) }),
      keys: async () => [], delete: async () => true,
    },
  };
  vm.runInNewContext(source, context);
  return { events, entries, skipped: () => skipped, scope };
}

test('offline install precaches all resources under a subdirectory scope', async () => {
  const w = worker(async (url) => ({ ok: true, url }));
  let work;
  w.events.install({ waitUntil: (promise) => { work = promise; } });
  await work;
  assert.equal(w.entries.size, 3);
  assert.ok(w.entries.has(`${w.scope}assets/app.js`));
  assert.equal(w.skipped(), true);
});

test('failed precache does not activate an incomplete replacement', async () => {
  const w = worker(async (url) => ({ ok: !url.endsWith('app.js'), url }));
  let work;
  w.events.install({ waitUntil: (promise) => { work = promise; } });
  await assert.rejects(work, /completely/);
  assert.equal(w.skipped(), false);
});

test('worker leaves cross-origin, other applications, and writes untouched', () => {
  const w = worker(async () => { throw new Error('Unexpected network'); });
  for (const [url, method] of [
    ['https://outside.test/file', 'GET'],
    ['https://studio.test/another-tool/', 'GET'],
    [`${w.scope}submit`, 'POST'],
  ]) {
    let intercepted = false;
    w.events.fetch({ request: { url, method }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false);
  }
});

test('offline navigation returns the installed local entry page', async () => {
  const w = worker(async () => { throw new Error('Offline'); });
  const page = new Response('local studio');
  w.entries.set(w.scope, page);
  let response;
  w.events.fetch({ request: { url: `${w.scope}nested`, method: 'GET', mode: 'navigate' }, respondWith: (p) => { response = p; } });
  assert.equal(await (await response).text(), 'local studio');
});
