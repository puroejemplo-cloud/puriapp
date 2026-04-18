import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const { geocodificar }     = await import('@/lib/geocoding')

  const supabase = getSupabaseAdmin()
  const { nombre, telefono, direccion, cantidad, notas, lat, lng } = await request.json()

  if (!nombre || !telefono || !direccion || !cantidad) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Buscar si el cliente ya existe por teléfono
  const { data: clienteExistente } = await supabase
    .from('clientes')
    .select('id')
    .eq('telefono', telefono)
    .maybeSingle()

  let clienteId: string

  if (clienteExistente) {
    clienteId = clienteExistente.id
    // Actualizar nombre/dirección por si cambiaron
    await supabase.from('clientes').update({ nombre, direccion }).eq('id', clienteId)
  } else {
    // Geocodificar si no se proporcionaron coords manuales
    let coordsLat = lat ?? null
    let coordsLng = lng ?? null
    if (!coordsLat || !coordsLng) {
      const coords = await geocodificar(direccion)
      coordsLat = coords?.lat ?? null
      coordsLng = coords?.lng ?? null
    }

    const { data: nuevo, error } = await supabase
      .from('clientes')
      .insert({ nombre, telefono, direccion, lat: coordsLat, lng: coordsLng })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: 'No se pudo crear el cliente' }, { status: 500 })
    clienteId = nuevo.id
  }

  // Obtener precio del garrafón
  const { data: producto } = await supabase
    .from('productos')
    .select('id, precio')
    .eq('nombre', 'Garrafón 20L')
    .eq('activo', true)
    .maybeSingle()

  const precio = producto?.precio ?? 35
  const total  = precio * cantidad

  const { data: pedido, error: errPedido } = await supabase
    .from('pedidos')
    .insert({
      cliente_id:  clienteId,
      producto_id: producto?.id ?? null,
      cantidad,
      total,
      notas:  notas || null,
      origen: 'admin',
    })
    .select('id')
    .single()

  if (errPedido) return NextResponse.json({ error: 'No se pudo crear el pedido' }, { status: 500 })

  return NextResponse.json({ ok: true, pedidoId: pedido.id })
}
