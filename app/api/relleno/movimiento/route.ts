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

// GET — movimientos de un turno
export async function GET(request: NextRequest) {
  const ctx = await verificarRelleno(request)
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { supabase } = ctx

  const turnoId = request.nextUrl.searchParams.get('turno_id')
  if (!turnoId) return NextResponse.json({ error: 'Falta turno_id' }, { status: 400 })

  const { data, error } = await supabase
    .from('movimientos_relleno')
    .select('*, repartidores(nombre)')
    .eq('turno_id', turnoId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — registrar movimiento
export async function POST(request: NextRequest) {
  const ctx = await verificarRelleno(request)
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { supabase } = ctx

  const { turnoId, tipo, cantidad, repartidorId, nota } = await request.json()

  if (!turnoId || !tipo || !cantidad || cantidad <= 0) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const tiposValidos = ['entrega_inicial', 'entrega_repartidor', 'recepcion_vacio', 'relleno', 'merma']
  if (!tiposValidos.includes(tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  // Verificar que el turno esté abierto
  const { data: turno } = await supabase
    .from('turnos_relleno')
    .select('estado')
    .eq('id', turnoId)
    .single()

  if (!turno || turno.estado !== 'abierto') {
    return NextResponse.json({ error: 'El turno está cerrado' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('movimientos_relleno')
    .insert({
      turno_id:      turnoId,
      tipo,
      cantidad,
      repartidor_id: repartidorId ?? null,
      nota:          nota ?? null,
    })
    .select('*, repartidores(nombre)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
