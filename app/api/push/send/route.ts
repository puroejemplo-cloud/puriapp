import { type NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Sub = { endpoint: string; p256dh: string; auth: string }

export async function POST(request: NextRequest) {
  try {
    const webpush = (await import('web-push')).default
    const supabase = getSupabaseAdmin()

    const { titulo, cuerpo, url, repartidorId, purificadoraId, soloAdmins } = await request.json()

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    )

    let suscripciones: Sub[] = []

    if (repartidorId) {
      // Enviar solo a ese repartidor (cuando el admin lo asigna)
      const { data } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('repartidor_id', repartidorId)
      suscripciones = data ?? []

    } else if (purificadoraId && soloAdmins) {
      // Solo admins de esta purificadora (pedido web recién creado)
      const { data } = await supabase
        .from('admin_push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('purificadora_id', purificadoraId)
      suscripciones = data ?? []

    } else if (purificadoraId) {
      // Enviar a todos los repartidores activos de la purificadora + sus admins
      const { data: reps } = await supabase
        .from('repartidores')
        .select('id')
        .eq('purificadora_id', purificadoraId)
        .eq('activo', true)

      const repIds = (reps ?? []).map(r => r.id)

      const [repSubs, adminSubs] = await Promise.all([
        repIds.length
          ? supabase.from('push_subscriptions').select('endpoint, p256dh, auth').in('repartidor_id', repIds)
          : Promise.resolve({ data: [] }),
        supabase.from('admin_push_subscriptions').select('endpoint, p256dh, auth').eq('purificadora_id', purificadoraId),
      ])

      suscripciones = [...(repSubs.data ?? []), ...(adminSubs.data ?? [])]

    } else {
      // Sin filtro: todos los repartidores + todos los admins (fallback para WhatsApp)
      const [repSubs, adminSubs] = await Promise.all([
        supabase.from('push_subscriptions').select('endpoint, p256dh, auth'),
        supabase.from('admin_push_subscriptions').select('endpoint, p256dh, auth'),
      ])
      suscripciones = [...(repSubs.data ?? []), ...(adminSubs.data ?? [])]
    }

    if (!suscripciones.length) {
      return NextResponse.json({ ok: true, enviados: 0 })
    }

    const payload = JSON.stringify({ titulo, cuerpo, url })
    const muertosRep:   string[] = []
    const muertosAdmin: string[] = []

    // Identificar cuáles endpoints son de admin para limpiar en la tabla correcta
    const adminEndpoints = new Set(
      (await supabase.from('admin_push_subscriptions').select('endpoint')).data?.map(r => r.endpoint) ?? []
    )

    await Promise.allSettled(
      suscripciones.map(async s => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          )
        } catch (err: unknown) {
          if ((err as { statusCode?: number }).statusCode === 410) {
            adminEndpoints.has(s.endpoint)
              ? muertosAdmin.push(s.endpoint)
              : muertosRep.push(s.endpoint)
          }
        }
      }),
    )

    // Limpiar suscripciones expiradas
    if (muertosRep.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', muertosRep)
    }
    if (muertosAdmin.length) {
      await supabase.from('admin_push_subscriptions').delete().in('endpoint', muertosAdmin)
    }

    return NextResponse.json({ ok: true, enviados: suscripciones.length - muertosRep.length - muertosAdmin.length })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
