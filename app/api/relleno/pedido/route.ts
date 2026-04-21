import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function verificarRelleno(request: NextRequest) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const supabase = getSupabaseAdmin()
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user || user.user_metadata?.role !== 'relleno') return null
  return { supabase, user }
}

// GET — pedidos pendientes y en_ruta de la purificadora
export async function GET(request: NextRequest) {
  const ctx = await verificarRelleno(request)
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { supabase, user } = ctx

  const purificadoraId = user.user_metadata?.purificadora_id
  if (!purificadoraId) return NextResponse.json({ error: 'Sin purificadora' }, { status: 400 })

  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id, estado, cantidad, total, notas, origen, created_at,
      clientes(nombre, telefono, direccion),
      repartidores(nombre)
    `)
    .eq('purificadora_id', purificadoraId)
    .in('estado', ['pendiente', 'en_ruta'])
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// PATCH — asignar repartidor y pasar a en_ruta (o solo cancelar)
export async function PATCH(request: NextRequest) {
  const ctx = await verificarRelleno(request)
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { supabase, user } = ctx

  const purificadoraId = user.user_metadata?.purificadora_id
  const { pedidoId, repartidorId, accion } = await request.json()

  if (!pedidoId) return NextResponse.json({ error: 'Falta pedidoId' }, { status: 400 })

  if (accion === 'cancelar') {
    const { error } = await supabase
      .from('pedidos')
      .update({ estado: 'cancelado' })
      .eq('id', pedidoId)
      .eq('purificadora_id', purificadoraId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Asignar repartidor → en_ruta
  if (!repartidorId) return NextResponse.json({ error: 'Falta repartidorId' }, { status: 400 })

  const { error } = await supabase
    .from('pedidos')
    .update({ repartidor_id: repartidorId, estado: 'en_ruta' })
    .eq('id', pedidoId)
    .eq('purificadora_id', purificadoraId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notificar al repartidor asignado
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repartidorId, url: '/repartidor' }),
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
