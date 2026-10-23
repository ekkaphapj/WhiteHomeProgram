// Minimal service worker: enables PWA install. Network-first passthrough
// (no offline caching on purpose — data must always be fresh).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()))
self.addEventListener('fetch', () => {
  // default network behavior
})
