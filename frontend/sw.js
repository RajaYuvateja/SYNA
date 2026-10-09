/**
 * Service Worker for Clinical Voice Triage (PWA & Offline Rural Flow)
 */

const CACHE_NAME = "clinical-triage-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/patient.html",
  "/css/dashboard.css",
  "/css/patient.css",
  "/js/dashboard.js",
  "/js/patient.js",
  "/js/offline-triage.js",
  "/js/offline-queue.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Let API and WebSocket requests pass to network
  if (e.request.url.includes("/api/") || e.request.url.includes("/ws/")) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      return (
        cached ||
        fetch(e.request).catch(() => {
          if (e.request.mode === "navigate") {
            return caches.match("/patient.html");
          }
        })
      );
    })
  );
});
