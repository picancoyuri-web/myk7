// service worker do MyK7 — deixa o app abrir offline e ser instalado.
// O HTML vem da rede primeiro (senão um deploy novo demoraria a chegar em
// quem já instalou) e cai no cache só quando não há conexão. Imagens e
// fontes, que quase nunca mudam, saem direto do cache.
// A API e as prévias de áudio nunca passam pelo cache.
const CACHE_NAME = 'myk7-v2';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'favicon.svg',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'img/cassette.jpg', 'js/qrcode.min.js',
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

function isStatic(url){
  return /\.(png|jpe?g|webp|svg|ico|woff2?)$/.test(url.pathname) || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if(sameOrigin && url.pathname.startsWith('/api/')) return;
  if(!sameOrigin && url.hostname !== 'fonts.gstatic.com' && url.hostname !== 'fonts.googleapis.com') return;

  if(isStatic(url)){
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if(res && (res.status === 200 || res.type === 'opaque')){
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if(res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')){
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req.mode === 'navigate' ? './' : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === 'navigate' ? './' : req, { ignoreSearch: req.mode === 'navigate' })
        .then((cached) => cached || Response.error()))
  );
});
