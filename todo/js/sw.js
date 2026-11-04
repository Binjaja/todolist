// sw.js : mode hors ligne. Réseau d'abord pour tes fichiers (toujours la dernière version en ligne),
// copie en cache sinon. Pour la bibliothèque externe : cache d'abord.
const CACHE = 'taches-v1';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'apple-touch-icon.png', 'js/parser.js', 'js/store.js', 'js/notify.js', 'js/app.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                         // les envois à ntfy ne passent jamais par le cache
  const url = new URL(req.url);
  const local = url.origin === self.location.origin;
  if (!local && !url.hostname.endsWith('cdnjs.cloudflare.com')) return;
  const fromNetwork = () => fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; });
  e.respondWith(local
    ? fromNetwork().catch(() => caches.match(req, { ignoreSearch: true }))
    : caches.match(req).then(hit => hit || fromNetwork()));
});
