// Service worker: guarda os arquivos do app para funcionar sem internet.
// Estratégia: com internet, busca sempre a versão mais nova (e atualiza a cópia guardada);
// sem internet, usa a cópia guardada. Ao alterar arquivos do app, aumente a versão abaixo.
const VERSAO = 'ct-v8';
const ARQUIVOS = [
  './',
  'index.html',
  'styles.css',
  'db.js',
  'app.js',
  'firebase-config.js',
  'vendor/firebase/firebase-app.js',
  'vendor/firebase/firebase-auth.js',
  'vendor/firebase/firebase-firestore.js',
  'manifest.webmanifest',
  'icon.svg'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' ignora o cache HTTP do navegador, para não guardar arquivo velho.
  e.waitUntil(
    caches.open(VERSAO).then((c) =>
      Promise.all(ARQUIVOS.map((a) => fetch(new Request(a, { cache: 'reload' })).then((r) => r.ok && c.put(a, r))))
    )
  );
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
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((r) => {
        if (r.ok) {
          const copia = r.clone();
          caches.open(VERSAO).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))
      )
  );
});
