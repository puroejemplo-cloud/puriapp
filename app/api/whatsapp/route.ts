import { type NextRequest } from 'next/server'
import { parsearComando, MENSAJE_AYUDA } from '@/lib/comandos'
import { geocodificar, reverseGeocode } from '@/lib/geocoding'
import { estaAbierto, horarioDeHoy, HORARIO_DEFAULT, type HorarioSemana } from '@/lib/horario'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Twilio envía application/x-www-form-urlencoded, no JSON
export async function POST(request: NextRequest) {
  // Imports lazy: twilio y supabase se cargan solo en runtime, nunca en build
  const [twilioMod, { getSupabaseAdmin }] = await Promise.all([
    import('twilio'),
    import('@/lib/supabase'),
  ])
  const twilio = twilioMod.default
  const supabaseAdmin = getSupabaseAdmin()
  const formData = await request.formData()

  const telefono = (formData.get('From') as string ?? '').replace('whatsapp:', '')
  const cuerpo   = (formData.get('Body') as string ?? '').trim()

  // Twilio envía Latitude y Longitude cuando el cliente comparte su ubicación
  const latStr = formData.get('Latitude')  as string | null
  const lngStr = formData.get('Longitude') as string | null
  const esUbicacion = !!latStr && !!lngStr

  await supabaseAdmin.from('whatsapp_log').insert({ telefono, mensaje: cuerpo || '[ubicación]', direccion: 'in' })

  const { data: cliente } = await supabaseAdmin
    .from('clientes')
    .select('id, nombre, lat, lng, lat_pendiente, lng_pendiente, garrafones_prestados, purificadora_id')
    .eq('telefono', telefono)
    .eq('activo', true)
    .maybeSingle()

  const comando = parsearComando(cuerpo)
  let respuesta = ''
  let pedidoId: string | undefined

  // ── Flujo: cliente comparte ubicación ────────────────────────────────────
  if (esUbicacion) {
    const lat = parseFloat(latStr!)
    const lng = parseFloat(lngStr!)

    if (!cliente) {
      // Sin registro: guardamos igual para no perder la ubicación
      respuesta =
        `📍 Recibimos tu ubicación, pero aún no estás registrado.\n\n` +
        `Para registrarte escribe:\n*REGISTRO|Tu Nombre|Tu Dirección*`
    } else if (!cliente.lat && !cliente.lng) {
      // Primera vez que comparte ubicación → guardar directo + geocodificación inversa
      const { municipio, colonia } = await reverseGeocode(lat, lng)
      await supabaseAdmin.from('clientes')
        .update({ lat, lng, ...(municipio && { municipio }), ...(colonia && { colonia }) })
        .eq('id', cliente.id)
      respuesta = `📍 ¡Ubicación guardada, ${cliente.nombre}! Ahora tus pedidos llegarán más rápido. 🚀`
    } else {
      // Ya tiene coords → guardar como pendiente y pedir confirmación
      await supabaseAdmin.from('clientes')
        .update({ lat_pendiente: lat, lng_pendiente: lng })
        .eq('id', cliente.id)
      respuesta =
        `📍 Recibimos tu nueva ubicación, ${cliente.nombre}.\n\n` +
        `¿Quieres actualizar la dirección guardada?\n` +
        `Responde *SÍ* para actualizarla o *NO* para mantener la anterior.`
    }

  // ── Flujo: respuesta SÍ/NO a confirmación de ubicación ──────────────────
  } else if (cliente && (cliente.lat_pendiente || cliente.lng_pendiente) &&
             (comando.tipo === 'CONFIRMAR' || comando.tipo === 'RECHAZAR')) {

    if (comando.tipo === 'CONFIRMAR') {
      // Aplicar la ubicación pendiente + geocodificación inversa
      const { municipio, colonia } = await reverseGeocode(cliente.lat_pendiente!, cliente.lng_pendiente!)
      await supabaseAdmin.from('clientes')
        .update({
          lat: cliente.lat_pendiente, lng: cliente.lng_pendiente,
          lat_pendiente: null, lng_pendiente: null,
          ...(municipio && { municipio }), ...(colonia && { colonia }),
        })
        .eq('id', cliente.id)
      respuesta = `✅ Ubicación actualizada correctamente. ¡Gracias, ${cliente.nombre}!`
    } else {
      // Descartar la ubicación pendiente
      await supabaseAdmin.from('clientes')
        .update({ lat_pendiente: null, lng_pendiente: null })
        .eq('id', cliente.id)
      respuesta = `👍 Conservamos tu dirección anterior. ¡Todo listo!`
    }

  // ── Flujo normal: comandos de texto ──────────────────────────────────────
  } else if (!cliente && comando.tipo !== 'REGISTRO') {
    respuesta =
      `No encontramos tu número registrado 😕\n\n` +
      `Para registrarte escribe:\n` +
      `*REGISTRO|Tu Nombre|Tu Dirección*\n\n` +
      `Ejemplo:\nREGISTRO|Juan Pérez|Calle Agua 123, Col. Centro, CDMX`
  } else {
    switch (comando.tipo) {

      case 'AYUDA':
        respuesta = MENSAJE_AYUDA
        break

      case 'REGISTRO': {
        if (cliente) {
          respuesta = `¡Hola ${cliente.nombre}! Ya estás registrado. Si quieres actualizar tu dirección escríbenos directamente.`
          break
        }
        const { data: cfgRow } = await supabaseAdmin
          .from('configuracion').select('valor').eq('clave', 'geocoding_zona').maybeSingle()
        const coords = await geocodificar(comando.direccion!, cfgRow?.valor ?? null)
        const { data: nuevo, error } = await supabaseAdmin
          .from('clientes')
          .insert({
            telefono,
            nombre:    comando.nombre,
            direccion: comando.direccion,
            lat:       coords?.lat ?? null,
            lng:       coords?.lng ?? null,
          })
          .select('nombre')
          .single()

        if (error) {
          respuesta = `Hubo un problema al registrarte. Intenta de nuevo o escríbenos directo.`
        } else {
          respuesta =
            `✅ ¡Listo, ${nuevo.nombre}! Ya estás registrado.\n\n` +
            (coords
              ? `📍 Ubicación encontrada correctamente.\n\n`
              : `⚠️ No pude ubicar tu dirección en el mapa, pero puedes hacer pedidos igual.\n\n`) +
            `💡 También puedes compartir tu ubicación directo desde WhatsApp para mayor precisión.\n\n` +
            MENSAJE_AYUDA
        }
        break
      }

      case 'PEDIDO': {
        // Verificar horario de atención usando purificadora_id del cliente
        const puriId = (cliente as unknown as { purificadora_id?: string })?.purificadora_id
        if (puriId) {
          const { data: cfgHorarioWa } = await supabaseAdmin
            .from('configuracion').select('valor').eq('clave', 'horario').eq('purificadora_id', puriId).maybeSingle()
          const horarioWa = (cfgHorarioWa?.valor as HorarioSemana | null) ?? HORARIO_DEFAULT
          if (!estaAbierto(horarioWa)) {
            const hoy = horarioDeHoy(horarioWa)
            respuesta = hoy
              ? `⏰ Estamos cerrados en este momento.\n\nHorario de hoy: *${hoy.inicio}–${hoy.fin}*\nIntenta de nuevo en ese horario.`
              : `⏰ No tenemos servicio hoy. Por favor intenta mañana.`
            break
          }
        }

        const { data: pedidoActivo } = await supabaseAdmin
          .from('pedidos')
          .select('id')
          .eq('cliente_id', cliente!.id)
          .in('estado', ['pendiente', 'en_ruta'])
          .maybeSingle()

        if (pedidoActivo) {
          respuesta =
            `Ya tienes un pedido en camino 🚚\n` +
            `Escribe *ESTADO* para ver cómo va o *CANCELAR* si quieres cancelarlo.`
          break
        }

        const [{ data: cfgPrecios }, { data: producto }] = await Promise.all([
          supabaseAdmin.from('configuracion').select('valor').eq('clave', 'precios').maybeSingle(),
          supabaseAdmin.from('productos').select('id, precio').eq('nombre', 'Garrafón 20L').eq('activo', true).maybeSingle(),
        ])
        const precio   = cfgPrecios?.valor?.pedido ?? producto?.precio ?? 35
        const cantidad = comando.cantidad!
        const total    = precio * cantidad

        const { data: pedido, error } = await supabaseAdmin
          .from('pedidos')
          .insert({
            cliente_id:  cliente!.id,
            producto_id: producto?.id ?? null,
            cantidad,
            total,
            origen: 'whatsapp',
          })
          .select('id')
          .single()

        if (error) {
          respuesta = `No se pudo crear tu pedido. Intenta de nuevo en un momento.`
        } else {
          pedidoId  = pedido.id
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
          const urlSeguimiento = appUrl ? `\n\n📍 Sigue tu pedido en tiempo real:\n${appUrl}/seguimiento/${pedido.id}` : ''
          respuesta =
            `✅ Pedido recibido:\n` +
            `🫙 ${cantidad} garrafón${cantidad > 1 ? 'es' : ''} × $${precio} = *$${total}*\n\n` +
            `Te avisaremos cuando el repartidor esté en camino 🚚` +
            urlSeguimiento

          // Notificar a todos los repartidores activos
          fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              titulo: '🫙 Nuevo pedido',
              cuerpo: `${cliente!.nombre} — ${cantidad} garrafón${cantidad > 1 ? 'es' : ''}`,
              url: '/repartidor',
            }),
          }).catch(() => {})
        }
        break
      }

      case 'ESTADO': {
        const { data: ultimo } = await supabaseAdmin
          .from('pedidos')
          .select('estado, cantidad, total, created_at, entregado_at')
          .eq('cliente_id', cliente!.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!ultimo) {
          respuesta = `No tienes pedidos registrados aún. Escribe *PEDIDO [cantidad]* para pedir.`
        } else {
          const etiquetas: Record<string, string> = {
            pendiente: '⏳ Pendiente — esperando repartidor',
            en_ruta:   '🚚 En ruta — ya va para allá',
            entregado: '✅ Entregado',
            cancelado: '❌ Cancelado',
          }
          respuesta =
            `*Tu último pedido:*\n` +
            `🫙 ${ultimo.cantidad} garrafón${ultimo.cantidad > 1 ? 'es' : ''} — $${ultimo.total}\n` +
            `Estado: ${etiquetas[ultimo.estado] ?? ultimo.estado}`
        }
        break
      }

      case 'CANCELAR': {
        const { data: pendiente } = await supabaseAdmin
          .from('pedidos')
          .select('id, cantidad')
          .eq('cliente_id', cliente!.id)
          .eq('estado', 'pendiente')
          .maybeSingle()

        if (!pendiente) {
          respuesta = `No tienes ningún pedido pendiente que cancelar.`
        } else {
          await supabaseAdmin
            .from('pedidos')
            .update({ estado: 'cancelado' })
            .eq('id', pendiente.id)
          respuesta = `✅ Pedido de ${pendiente.cantidad} garrafón${pendiente.cantidad > 1 ? 'es' : ''} cancelado.`
        }
        break
      }

      default:
        respuesta = `No entendí ese mensaje 😅\n\n${MENSAJE_AYUDA}`
    }
  }

  await supabaseAdmin.from('whatsapp_log').insert({
    telefono, mensaje: respuesta, direccion: 'out', pedido_id: pedidoId ?? null,
  })

  const twiml = new twilio.twiml.MessagingResponse()
  twiml.message(respuesta)

  return new Response(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  })
}
