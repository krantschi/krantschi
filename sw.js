/* Heute — Offline-Speicher
   Legt die App im Gerät ab: sofortiger Start, läuft ohne Netz.
   Beim Aktualisieren die Zahl in CACHE erhöhen, dann holt sich jedes Gerät die neue Fassung. */

const CACHE = "heute-20260830-12";
const ASSETS = ["./", "./index.html", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./manifest.webmanifest"];

// Beim Einrichten die App ablegen
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .catch(() => {})   // scheitert eine Datei, bleibt die App trotzdem nutzbar
  );
});

// Alte Bestände aufräumen und sofort übernehmen
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Auf Wunsch der App sofort wechseln, statt auf den nächsten Start zu warten
self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const req = e.request;

  // Nur einfache Abrufe der eigenen Adresse bedienen.
  // Alles andere — GitHub-Abgleich, Videos aus der Cloud, eingebettete Spieler — geht unberührt ins Netz.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Die Seite selbst: erst das Netz versuchen, damit neue Fassungen ankommen;
  // ohne Verbindung greift die abgelegte Kopie.
  if (req.mode === "navigate" || url.pathname.endsWith("index.html") || url.pathname.endsWith("/")) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Übriges Eigenes: erst die Kopie, das ist schneller
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => hit))
  );
});
