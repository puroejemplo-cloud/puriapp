// Service Worker — versión FASE 4 (mínimo para PWA instalable)
// El SW completo con notificaciones push se agrega en FASE 8

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))
