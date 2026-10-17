// service worker do Cassete — deixa o app abrir offline e ser instalado.
// Tudo do próprio site vem da rede primeiro (senão um deploy novo demoraria
// a chegar em quem já instalou) e cai no cache só quando não há conexão.
// A API e outros domínios nunca passam pelo cache.
const CACHE_NAME = 'cassete-v4';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icon-512.png',
  'js/main.js', 'js/config.js', 'js/dom.js', 'js/api.js', 'js/icons.js', 'js/theme.js',
  'js/install.js', 'js/data.js', 'js/items.js', 'js/cassette.js', 'js/state.js',
  'js/player.js', 'js/components.js', 'js/sheets.js',
  'js/views/auth.js', 'js/views/feed.js', 'js/views/reviews.js', 'js/views/search.js',
  'js/views/people.js', 'js/views/person.js', 'js/views/inbox.js', 'js/views/diary.js',
  'js/views/profile.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {}) // offline na instalação não pode impedir o SW de subir
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if(res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req.mode === 'navigate' ? './' : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === 'navigate' ? './' : req, { ignoreSearch: req.mode === 'navigate' })
        .then((cached) => cached || Response.error()))
  );
});
