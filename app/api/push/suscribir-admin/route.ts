import { type NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { userId, purificadoraId, suscripcion } = await request.json()

  if (!userId || !purificadoraId || !suscripcion?.endpoint) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  await supabase
    .from('admin_push_subscriptions')
    .upsert(
      {
        user_id:         userId,
        purificadora_id: purificadoraId,
        endpoint:        suscripcion.endpoint,
        p256dh:          suscripcion.keys.p256dh,
        auth:            suscripcion.keys.auth,
      },
      { onConflict: 'endpoint' },
    )

  return NextResponse.json({ ok: true })
}
