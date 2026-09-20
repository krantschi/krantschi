/* Heute — App-Hülle / Offline-Speicher. Kein Backup für persönliche Daten.
   Die lokale Datenhaltung und Kalender-/GitHub-Verbindungen bleiben unberührt. */
const PREFIX = "heute-atelier-" + encodeURIComponent(self.registration.scope) + "-";
const CACHE = PREFIX + "v8";
const LEGACY_CACHE = "heute-20260915-36";
const CORE = ["./", "./index.html"];
const OPTIONAL = ["./habit-tracker.html", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    await Promise.all(OPTIONAL.map(asset => cache.add(asset).catch(() => {})));
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE && (key.startsWith(PREFIX) || key === LEGACY_CACHE)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;
  const page = request.mode === "navigate" || /\/(?:index|habit-tracker)\.html$/.test(url.pathname) || url.pathname.endsWith("/");
  if (page) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put("./index.html", response.clone());
          return response;
        }
        return (await cache.match("./index.html")) || response;
      } catch (_) {
        return (await cache.match("./index.html")) || (await cache.match("./")) || new Response("Heute ist noch nicht offline gespeichert. Bitte einmal online öffnen.", {status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
      }
    })());
    return;
  }
  // Cache only known app assets, never calendar responses or user data.
  const assetPaths = OPTIONAL.map(asset => new URL(asset, scope).pathname);
  if (!assetPaths.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  })());
});
