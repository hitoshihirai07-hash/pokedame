import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
export async function buildServiceWorker(root) {
  async function walk(path) {
    const entries = await readdir(`${root}/${path}`, { withFileTypes: true });
    return (
      await Promise.all(
        entries.map((entry) =>
          entry.isDirectory()
            ? walk(`${path}${entry.name}/`)
            : `${path}${entry.name}`,
        ),
      )
    ).flat();
  }
  const files = (await walk(""))
    .filter((f) => !["_headers", "sw.js"].includes(f))
    .sort();
  const hash = createHash("sha256");
  hash.update(await readFile(new URL(import.meta.url)));
  for (const file of files)
    hash.update(file).update(await readFile(`${root}/${file}`));
  const cache = `champions-lab-${hash.digest("hex").slice(0, 16)}`;
  await writeFile(
    `${root}/sw.js`,
    `
const CACHE = ${JSON.stringify(cache)};
const FILES = ${JSON.stringify(files.map((f) => "/" + f))};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('champions-lab-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Serve a consistent release, including its worker and CSV-derived data.
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match('/index.html')).then(hit => hit || fetch(event.request)));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(hit => hit || fetch(event.request)));
  }
});
`,
  );
}
