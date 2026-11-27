// Service worker: guarda os arquivos do app para funcionar sem internet.
// Ao alterar qualquer arquivo do app, aumente a versão abaixo.
const VERSAO = 'ct-v2';
const ARQUIVOS = [
  './',
  'index.html',
  'styles.css',
  'db.js',
  'app.js',
  'manifest.webmanifest',
  'icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).catch(() => caches.match('index.html')))
  );
});
