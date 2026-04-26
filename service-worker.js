const CACHE_NAME = "wikiband-shell-v8";
const RUNTIME_CACHE = "wikiband-runtime-v8";

const APP_SHELL = [
  "/",
  "/index.html",
  "/favoritos.html",
  "/banda.html",
  "/sobre.html",
  "/login.html",
  "/cadastro.html",
  "/offline.html",
  "/site.webmanifest",
  "/assets/css/style.css",
  "/assets/js/core/pwa.js",
  "/assets/js/core/preview-player.js",
  "/assets/js/modules/storage.js",
  "/assets/js/modules/auth-ui.js",
  "/assets/js/modules/results.js",
  "/assets/js/modules/links.js",
  "/assets/js/modules/share.js",
  "/assets/js/modules/result-cards.js",
  "/assets/js/modules/sidebar.js",
  "/assets/js/data/artist-profiles.js",
  "/assets/js/pages/home.js",
  "/assets/js/pages/favoritos.js",
  "/assets/js/pages/banda.js",
  "/assets/js/pages/login.js",
  "/assets/js/pages/cadastro.js",
  "/assets/icons/favicon-16x16.png",
  "/assets/icons/favicon-32x32.png",
  "/assets/icons/apple-touch-icon.png"
];

function getOfflineFallbackForPath(pathname) {
  const normalizedPath = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;

  if (normalizedPath === "/favoritos" || normalizedPath === "/favoritos.html") return "/favoritos.html";
  if (normalizedPath === "/banda" || normalizedPath === "/banda.html") return "/banda.html";
  if (normalizedPath === "/sobre" || normalizedPath === "/sobre.html") return "/sobre.html";
  if (normalizedPath === "/login" || normalizedPath === "/login.html") return "/login.html";
  if (normalizedPath === "/cadastro" || normalizedPath === "/cadastro.html") return "/cadastro.html";
  return "/index.html";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![CACHE_NAME, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(async () => {
          const cachedPage = await caches.match(event.request);
          if (cachedPage) return cachedPage;

          const fallbackPath = getOfflineFallbackForPath(requestUrl.pathname);
          return (
            (await caches.match(fallbackPath)) ||
            (await caches.match("/offline.html")) ||
            caches.match("/index.html")
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => caches.match("/offline.html"));
    })
  );
});
