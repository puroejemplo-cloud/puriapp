'use client'

// Activa las notificaciones push para el repartidor actual
export async function activarPush(repartidorId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return false

  const registro = await navigator.serviceWorker.ready

  // Suscribir al repartidor a push usando la clave pública VAPID
  const suscripcion = await registro.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
    ),
  })

  // Guardar la suscripción en la base de datos
  await fetch('/api/push/suscribir', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ repartidorId, suscripcion }),
  })

  return true
}

export function yaEstaActivado(): boolean {
  if (typeof window === 'undefined') return false
  return Notification.permission === 'granted'
}

// Convierte la clave pública VAPID de base64 a Uint8Array (requerido por PushManager)
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding  = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64      = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData  = atob(b64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer
}
