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

// GET — turno abierto de hoy para este operador
export async function GET(request: NextRequest) {
  const ctx = await verificarRelleno(request)
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { supabase, user } = ctx

  const { data: operador } = await supabase
    .from('relleno_operadores')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!operador) return NextResponse.json({ error: 'Operador no encontrado' }, { status: 404 })

  const hoy = new Date().toISOString().split('T')[0]

  const { data: turno } = await supabase
    .from('turnos_relleno')
    .select('*')
    .eq('operador_id', operador.id)
    .eq('fecha', hoy)
    .maybeSingle()

  // Obtener repartidores activos para mostrar en la página
  const purificadoraId = user.user_metadata?.purificadora_id
  const { data: repartidores } = await supabase
    .from('repartidores')
    .select('id, nombre')
    .eq('purificadora_id', purificadoraId)
    .eq('activo', true)
    .order('nombre')

  return NextResponse.json({ turno: turno ?? null, operadorId: operador.id, repartidores: repartidores ?? [] })
}

// POST — abrir turno con stock inicial
export async function POST(request: NextRequest) {
  const ctx = await verificarRelleno(request)
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { supabase, user } = ctx

  const { operadorId, stockInicial } = await request.json()
  const purificadoraId = user.user_metadata?.purificadora_id
  const hoy = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('turnos_relleno')
    .insert({
      operador_id:     operadorId,
      purificadora_id: purificadoraId,
      fecha:           hoy,
      estado:          'abierto',
      stock_inicial:   stockInicial ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ turno: data })
}

// PATCH — cerrar turno
export async function PATCH(request: NextRequest) {
  const ctx = await verificarRelleno(request)
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { supabase } = ctx

  const { turnoId } = await request.json()

  const { error } = await supabase
    .from('turnos_relleno')
    .update({ estado: 'cerrado', cerrado_at: new Date().toISOString() })
    .eq('id', turnoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
