import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const supabase = getSupabaseAdmin()

  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const { data: { user: caller } } = await supabase.auth.getUser(token)
  if (caller?.user_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { nombre, telefonoWhatsapp } = await request.json()
  if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('purificadoras')
    .insert({ nombre, telefono_whatsapp: telefonoWhatsapp || null })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Crear configuración base para la nueva purificadora
  await supabase.from('configuracion').insert([
    { clave: 'precios',         valor: { pedido: 35, ruta: 35 },                         purificadora_id: data.id },
    { clave: 'geocoding_zona',  valor: { lat: null, lng: null, radio_km: 10 },            purificadora_id: data.id },
  ])

  return NextResponse.json({ ok: true, purificadoraId: data.id })
}
