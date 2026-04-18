import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const { geocodificar }     = await import('@/lib/geocoding')

  const supabase = getSupabaseAdmin()
  const { nombre, telefono, direccion, cantidad, notas, lat, lng, repartidorId } = await request.json()

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
    await supabase.from('clientes').update({ nombre, direccion }).eq('id', clienteId)
    // Actualizar coords si se proporcionaron nuevas
    if (lat && lng) {
      await supabase.from('clientes').update({ lat, lng }).eq('id', clienteId)
    }
  } else {
    // Geocodificar si no se proporcionaron coords
    let coordsLat = lat ?? null
    let coordsLng = lng ?? null
    if (!coordsLat || !coordsLng) {
      // Leer zona configurada para limitar búsqueda
      const { data: cfgRow } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('clave', 'geocoding_zona')
        .maybeSingle()
      const zona = cfgRow?.valor ?? null
      const coords = await geocodificar(direccion, zona)
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

  // Precio del garrafón
  const { data: producto } = await supabase
    .from('productos')
    .select('id, precio')
    .eq('nombre', 'Garrafón 20L')
    .eq('activo', true)
    .maybeSingle()

  const precio = producto?.precio ?? 35
  const total  = precio * cantidad

  // Si se asigna repartidor, el pedido arranca en_ruta
  const estadoInicial = repartidorId ? 'en_ruta' : 'pendiente'

  const { data: pedido, error: errPedido } = await supabase
    .from('pedidos')
    .insert({
      cliente_id:   clienteId,
      producto_id:  producto?.id ?? null,
      cantidad,
      total,
      notas:        notas || null,
      origen:       'admin',
      repartidor_id: repartidorId || null,
      estado:       estadoInicial,
    })
    .select('id')
    .single()

  if (errPedido) return NextResponse.json({ error: 'No se pudo crear el pedido' }, { status: 500 })

  // Notificar al repartidor asignado (o a todos si no hay asignado)
  const pushBody = repartidorId
    ? { titulo: '🫙 Nuevo pedido asignado', cuerpo: `${nombre} — ${cantidad} garrafón${cantidad > 1 ? 'es' : ''}`, url: '/repartidor', repartidorId }
    : { titulo: '🫙 Nuevo pedido', cuerpo: `${nombre} — ${cantidad} garrafón${cantidad > 1 ? 'es' : ''}`, url: '/repartidor' }

  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pushBody),
  }).catch(() => {})

  return NextResponse.json({ ok: true, pedidoId: pedido.id })
}
