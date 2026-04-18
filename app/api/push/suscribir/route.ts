import { type NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { repartidorId, suscripcion } = await request.json()

  const { endpoint, keys } = suscripcion

  await supabase
    .from('push_subscriptions')
    .upsert(
      {
        repartidor_id: repartidorId,
        endpoint,
        p256dh: keys.p256dh,
        auth:   keys.auth,
      },
      { onConflict: 'endpoint' }
    )

  return NextResponse.json({ ok: true })
}
