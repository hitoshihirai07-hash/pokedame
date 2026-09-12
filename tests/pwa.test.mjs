import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { buildServiceWorker } from '../scripts/service-worker.mjs';

test('Install manifest has real PNG icons and root-scoped standalone launch', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  for (const icon of manifest.icons) {
    const png = await readFile(`public${icon.src}`);
    const size = Number(icon.sizes.split('x')[0]);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /manifest.webmanifest/);
  assert.match(html, /apple-touch-icon/);
});

test('Offline release includes worker assets, waits for update consent, and versions changed data', async () => {
  const root = await mkdtemp(join(tmpdir(), 'champions-pwa-'));
  await mkdir(`${root}/assets`);
  await writeFile(`${root}/index.html`, 'app');
  await writeFile(`${root}/assets/inference.worker.mjs`, 'worker');
  await buildServiceWorker(root);
  const first = await readFile(`${root}/sw.js`, 'utf8');
  const handlers = {};
  let precached, skipped = false;
  const cache = { addAll: async files => { precached = files; }, match: async path => path === '/index.html' ? 'offline app' : 'offline worker' };
  vm.runInNewContext(first, {
    URL,
    self: { location: { origin: 'https://example.test' }, addEventListener: (name, callback) => handlers[name] = callback, skipWaiting: () => { skipped = true; } },
    caches: { open: async () => cache },
    fetch: () => { throw new Error('Offline network must not be used for cached resources'); },
  });
  let work;
  handlers.install({ waitUntil: value => work = value });
  await work;
  assert.ok(precached.includes('/assets/inference.worker.mjs'));
  assert.equal(skipped, false);
  let response;
  handlers.fetch({ request: { url:'https://example.test/', method:'GET', mode:'navigate' }, respondWith: value => response = value });
  assert.equal(await response, 'offline app');
  handlers.fetch({ request: { url:'https://example.test/assets/inference.worker.mjs', method:'GET' }, respondWith: value => response = value });
  assert.equal(await response, 'offline worker');
  handlers.message({ data: {type: 'SKIP_WAITING'} });
  assert.equal(skipped, true);
  await writeFile(`${root}/index.html`, 'new rankings');
  await buildServiceWorker(root);
  assert.notEqual((await readFile(`${root}/sw.js`, 'utf8')).split('\n')[1], first.split('\n')[1]);
});
