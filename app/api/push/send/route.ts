import { type NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
  const webpush = (await import('web-push')).default
  const supabase = getSupabaseAdmin()

  const { titulo, cuerpo, url, repartidorId } = await request.json()

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  // Si se especifica repartidor, solo enviar a ese; si no, a todos los activos
  let query = supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (repartidorId) {
    query = query.eq('repartidor_id', repartidorId)
  }

  const { data: suscripciones } = await query

  if (!suscripciones?.length) {
    return NextResponse.json({ ok: true, enviados: 0 })
  }

  const payload = JSON.stringify({ titulo, cuerpo, url })
  const muertos: string[] = []

  await Promise.allSettled(
    suscripciones.map(async s => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
      } catch (err: unknown) {
        // 410 Gone = suscripción expirada, eliminar
        if ((err as { statusCode?: number }).statusCode === 410) {
          muertos.push(s.endpoint)
        }
      }
    })
  )

  // Limpiar suscripciones muertas
  if (muertos.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', muertos)
  }

  return NextResponse.json({ ok: true, enviados: suscripciones.length - muertos.length })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
