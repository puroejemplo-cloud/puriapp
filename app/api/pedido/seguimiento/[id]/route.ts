import { type NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('pedidos')
    .select('id, estado, cantidad, total, created_at, entregado_at, purificadora_id, clientes(nombre), repartidores(nombre)')
    .eq('id', id)
    .single()

  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const [{ data: puri }, { data: cfgLogo }] = await Promise.all([
    supabase.from('purificadoras').select('nombre').eq('id', data.purificadora_id).single(),
    supabase.from('configuracion').select('valor').eq('clave', 'logo_url').eq('purificadora_id', data.purificadora_id).maybeSingle(),
  ])

  return NextResponse.json({
    estado:              data.estado,
    cantidad:            data.cantidad,
    total:               data.total,
    created_at:          data.created_at,
    entregado_at:        data.entregado_at,
    cliente_nombre:      (data.clientes as unknown as { nombre: string } | null)?.nombre ?? null,
    repartidor_nombre:   (data.repartidores as unknown as { nombre: string } | null)?.nombre ?? null,
    purificadora_nombre: puri?.nombre ?? null,
    purificadora_id:     data.purificadora_id,
    logo_url:            (cfgLogo?.valor as string | null) ?? null,
  })
}
