/* Service worker: fa funzionare l'app anche senza connessione.
   Quando aggiorni i file, cambia il numero di VERSION. */
var VERSION = 'gt-1.1.1';
var SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      // 'reload' = scarica sempre la versione nuova, mai quella vecchia rimasta in memoria
      return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// File dell'app: prima prova la rete (versione più recente), se non risponde entro 3 secondi usa la copia salvata.
// Font: copia salvata, perché non cambiano.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;

  if (isFont) {
    e.respondWith(caches.open(VERSION).then(function (cache) {
      return cache.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { cache.put(req, res.clone()); return res; });
      });
    }));
    return;
  }

  e.respondWith(caches.open(VERSION).then(function (cache) {
    var net = fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    var timeout = new Promise(function (resolve) { setTimeout(resolve, 3000); });
    return Promise.race([net.catch(function () { return null; }), timeout]).then(function (res) {
      if (res) return res;
      return cache.match(req, { ignoreSearch: true }).then(function (hit) { return hit || net; });
    });
  }));
});
