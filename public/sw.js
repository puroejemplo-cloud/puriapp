// Service Worker — FASE 8: notificaciones push

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))

// Recibe notificación push y la muestra al usuario
self.addEventListener('push', e => {
  if (!e.data) return

  const { titulo, cuerpo, url } = e.data.json()

  e.waitUntil(
    self.registration.showNotification(titulo || '💧 Purificadora', {
      body:    cuerpo  || 'Nuevo pedido recibido',
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      vibrate: [300, 150, 300],
      data:    { url: url || '/repartidor' },
    })
  )
})

// Al tocar la notificación, abre la app en la URL indicada
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/repartidor'

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
      const ventana = lista.find(c => c.url.includes(url))
      if (ventana) return ventana.focus()
      return clients.openWindow(url)
    })
  )
})
