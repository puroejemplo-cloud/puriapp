'use client'

export type ResultadoPush = 'ok' | 'no_soportado' | 'permiso_denegado' | 'error'

// Activa notificaciones push para el admin actual
export async function activarPushAdmin(
  userId: string,
  purificadoraId: string,
): Promise<ResultadoPush> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'no_soportado'
  }
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return 'permiso_denegado'

  try {
    const sw = await navigator.serviceWorker.ready
    const suscripcion = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    })
    await fetch('/api/push/suscribir-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, purificadoraId, suscripcion }),
    })
    return 'ok'
  } catch {
    return 'error'
  }
}

export function pushAdminActivo(): boolean {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false
  return Notification.permission === 'granted'
}

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}
