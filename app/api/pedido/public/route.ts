import { type NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { geocodificar, reverseGeocode } from '@/lib/geocoding'
import { distanciaKm } from '@/lib/distancia'
import { estaAbierto, horarioDeHoy, HORARIO_DEFAULT, type HorarioSemana } from '@/lib/horario'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET — devuelve nombre de la purificadora y zona de entrega (público)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const purificadoraId = searchParams.get('purificadoraId')

  if (!purificadoraId) {
    return NextResponse.json({ error: 'purificadoraId requerido' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  const [{ data: puri }, { data: cfgZona }, { data: cfgMunis }, { data: cfgLogo }, { data: cfgHorario }] = await Promise.all([
    supabase.from('purificadoras').select('nombre, activo').eq('id', purificadoraId).single(),
    supabase.from('configuracion').select('valor').eq('clave', 'geocoding_zona').eq('purificadora_id', purificadoraId).maybeSingle(),
    supabase.from('configuracion').select('valor').eq('clave', 'municipios').eq('purificadora_id', purificadoraId).maybeSingle(),
    supabase.from('configuracion').select('valor').eq('clave', 'logo_url').eq('purificadora_id', purificadoraId).maybeSingle(),
    supabase.from('configuracion').select('valor').eq('clave', 'horario').eq('purificadora_id', purificadoraId).maybeSingle(),
  ])

  if (!puri || !puri.activo) {
    return NextResponse.json({ error: 'Purificadora no disponible' }, { status: 404 })
  }

  const horario = (cfgHorario?.valor as HorarioSemana | null) ?? HORARIO_DEFAULT
  const z = cfgZona?.valor
  return NextResponse.json({
    nombre:      puri.nombre,
    zona:        (z?.lat && z?.lng) ? { lat: z.lat, lng: z.lng, radio_km: z.radio_km ?? 10 } : null,
    municipios:  (cfgMunis?.valor as string[] | null) ?? [],
    logoUrl:     (cfgLogo?.valor as string | null) ?? null,
    abierto:     estaAbierto(horario),
    horarioHoy:  horarioDeHoy(horario),
  })
}

// POST — crea pedido desde la página pública (sin autenticación)
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })

  const { purificadoraId, telefono, nombre, direccion, municipio, referencias, cantidad, lat: latCliente, lng: lngCliente } = body

  if (!purificadoraId || !telefono || !nombre || !direccion || !cantidad) {
    return NextResponse.json({ error: 'Faltan datos requeridos.' }, { status: 400 })
  }
  if (typeof cantidad !== 'number' || cantidad < 1 || cantidad > 10) {
    return NextResponse.json({ error: 'Cantidad inválida (1–10).' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Verificar que la purificadora exista y esté activa
  const { data: puri } = await supabase
    .from('purificadoras').select('activo').eq('id', purificadoraId).single()
  if (!puri?.activo) {
    return NextResponse.json({ error: 'Purificadora no disponible.' }, { status: 404 })
  }

  // Verificar horario de atención
  const { data: cfgHorarioPost } = await supabase
    .from('configuracion').select('valor').eq('clave', 'horario').eq('purificadora_id', purificadoraId).maybeSingle()
  const horarioPost = (cfgHorarioPost?.valor as HorarioSemana | null) ?? HORARIO_DEFAULT
  if (!estaAbierto(horarioPost)) {
    const hoy = horarioDeHoy(horarioPost)
    const msg = hoy
      ? `Estamos cerrados en este momento. Nuestro horario de hoy es ${hoy.inicio}–${hoy.fin}.`
      : 'No tenemos servicio hoy. Consulta nuestro horario de atención.'
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  // Zona de entrega de esta purificadora
  const { data: cfgZona } = await supabase
    .from('configuracion').select('valor').eq('clave', 'geocoding_zona').eq('purificadora_id', purificadoraId).maybeSingle()
  const zona = cfgZona?.valor ?? null

  // Resolver coordenadas: GPS del cliente → geocodificación de dirección
  let lat: number | null = latCliente ?? null
  let lng: number | null = lngCliente ?? null

  if (!lat || !lng) {
    // Si el cliente eligió municipio, se añade a la dirección para mayor precisión
    const busqueda = municipio ? `${direccion.trim()}, ${municipio}` : direccion.trim()
    const coords = await geocodificar(busqueda, zona)
    if (coords) { lat = coords.lat; lng = coords.lng }
  }

  // Validar que la dirección esté dentro de la zona de entrega
  if (zona?.lat && zona?.lng && lat && lng) {
    const dist = distanciaKm(lat, lng, zona.lat, zona.lng)
    const radio = zona.radio_km ?? 10
    if (dist > radio) {
      return NextResponse.json({
        error: `Tu dirección está fuera de nuestra zona de entrega (radio ${radio} km). ` +
               `Verifica la dirección o llámanos directamente.`,
      }, { status: 422 })
    }
  }

  // Reverse geocoding para obtener colonia desde coordenadas GPS
  let coloniaGeo: string | null = null
  if (lat && lng) {
    const geo = await reverseGeocode(lat, lng)
    coloniaGeo = geo.colonia
  }

  const tel = telefono.trim()

  // Buscar cliente existente de esta purificadora
  const { data: clienteExistente } = await supabase
    .from('clientes').select('id')
    .eq('telefono', tel).eq('purificadora_id', purificadoraId).eq('activo', true).maybeSingle()

  let clienteId: string

  if (clienteExistente) {
    await supabase.from('clientes').update({
      nombre:    nombre.trim(),
      direccion: direccion.trim(),
      ...(municipio          ? { municipio }                    : {}),
      ...(coloniaGeo         ? { colonia: coloniaGeo }          : {}),
      ...(lat && lng         ? { lat, lng }                     : {}),
      ...(referencias?.trim() ? { referencias: referencias.trim() } : {}),
    }).eq('id', clienteExistente.id)
    clienteId = clienteExistente.id
  } else {
    const { data: nuevo, error } = await supabase
      .from('clientes')
      .insert({
        telefono: tel, nombre: nombre.trim(), direccion: direccion.trim(),
        municipio: municipio ?? null, colonia: coloniaGeo,
        lat, lng, purificadora_id: purificadoraId,
        referencias: referencias?.trim() || null,
      })
      .select('id').single()
    if (error || !nuevo) {
      return NextResponse.json({ error: 'Error al registrar. Intenta de nuevo.' }, { status: 500 })
    }
    clienteId = nuevo.id
  }

  // Verificar que no tenga pedido activo
  const { data: pedidoActivo } = await supabase
    .from('pedidos').select('id')
    .eq('cliente_id', clienteId).in('estado', ['pendiente', 'en_ruta']).maybeSingle()

  if (pedidoActivo) {
    return NextResponse.json({
      error: 'Ya tienes un pedido en proceso. Espera a que sea entregado antes de hacer otro.',
    }, { status: 409 })
  }

  // Precio desde configuración → productos → fallback 35
  const [{ data: cfgPrecios }, { data: producto }] = await Promise.all([
    supabase.from('configuracion').select('valor').eq('clave', 'precios').eq('purificadora_id', purificadoraId).maybeSingle(),
    supabase.from('productos').select('id, precio').eq('nombre', 'Garrafón 20L').eq('activo', true).maybeSingle(),
  ])
  const precio = cfgPrecios?.valor?.pedido ?? producto?.precio ?? 35
  const total = precio * cantidad

  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos').insert({
      cliente_id:      clienteId,
      producto_id:     producto?.id ?? null,
      cantidad,
      total,
      origen:          'web',
      purificadora_id: purificadoraId,
    }).select('id').single()

  if (pedidoError || !pedido) {
    return NextResponse.json({ error: 'Error al crear el pedido. Intenta de nuevo.' }, { status: 500 })
  }

  // Notificar a repartidores y admin de esta purificadora
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  if (appUrl) {
    fetch(`${appUrl}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo:          '🌐 Nuevo pedido web',
        cuerpo:          `${nombre.trim()} — ${cantidad} garrafón${cantidad > 1 ? 'es' : ''}`,
        url:             '/admin/pedidos',
        purificadoraId,
        soloAdmins:      true,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ pedidoId: pedido.id, total, precio })
}
