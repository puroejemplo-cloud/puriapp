import { type NextRequest } from 'next/server'
import twilio from 'twilio'
import { supabaseAdmin } from '@/lib/supabase'
import { parsearComando, MENSAJE_AYUDA } from '@/lib/comandos'
import { geocodificar } from '@/lib/geocoding'

// Twilio envía application/x-www-form-urlencoded, no JSON
export async function POST(request: NextRequest) {
  const formData = await request.formData()

  // El número viene como "whatsapp:+521551234567" — quitamos el prefijo
  const telefono = (formData.get('From') as string ?? '').replace('whatsapp:', '')
  const cuerpo   = (formData.get('Body') as string ?? '').trim()

  // --- Log de mensaje entrante ---
  await supabaseAdmin.from('whatsapp_log').insert({
    telefono,
    mensaje: cuerpo,
    direccion: 'in',
  })

  // --- Buscar cliente registrado ---
  const { data: cliente } = await supabaseAdmin
    .from('clientes')
    .select('id, nombre, garrafones_prestados')
    .eq('telefono', telefono)
    .eq('activo', true)
    .maybeSingle()

  const comando = parsearComando(cuerpo)
  let respuesta = ''
  let pedidoId: string | undefined

  // Si no está registrado y no está intentando registrarse, pedir registro
  if (!cliente && comando.tipo !== 'REGISTRO') {
    respuesta =
      `No encontramos tu número registrado 😕\n\n` +
      `Para registrarte escribe:\n` +
      `*REGISTRO|Tu Nombre|Tu Dirección*\n\n` +
      `Ejemplo:\nREGISTRO|Juan Pérez|Calle Agua 123, Col. Centro, CDMX`
  } else {
    switch (comando.tipo) {

      // ── AYUDA / HOLA ───────────────────────────────────────────
      case 'AYUDA':
        respuesta = MENSAJE_AYUDA
        break

      // ── REGISTRO ───────────────────────────────────────────────
      case 'REGISTRO': {
        if (cliente) {
          respuesta = `¡Hola ${cliente.nombre}! Ya estás registrado. Si quieres actualizar tu dirección escríbenos directamente.`
          break
        }

        const coords = await geocodificar(comando.direccion!)

        const { data: nuevo, error } = await supabaseAdmin
          .from('clientes')
          .insert({
            telefono,
            nombre:    comando.nombre,
            direccion: comando.direccion,
            lat:       coords?.lat    ?? null,
            lng:       coords?.lng    ?? null,
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
            MENSAJE_AYUDA
        }
        break
      }

      // ── PEDIDO ─────────────────────────────────────────────────
      case 'PEDIDO': {
        // Verificar que no tenga un pedido pendiente activo
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

        // Obtener precio del garrafón desde la tabla productos
        const { data: producto } = await supabaseAdmin
          .from('productos')
          .select('id, precio')
          .eq('nombre', 'Garrafón 20L')
          .eq('activo', true)
          .maybeSingle()

        const precio   = producto?.precio ?? 35
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
          respuesta =
            `✅ Pedido recibido:\n` +
            `🫙 ${cantidad} garrafón${cantidad > 1 ? 'es' : ''} × $${precio} = *$${total}*\n\n` +
            `Te avisaremos cuando el repartidor esté en camino 🚚`
        }
        break
      }

      // ── ESTADO ─────────────────────────────────────────────────
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
            pendiente:  '⏳ Pendiente — esperando repartidor',
            en_ruta:    '🚚 En ruta — ya va para allá',
            entregado:  '✅ Entregado',
            cancelado:  '❌ Cancelado',
          }
          respuesta =
            `*Tu último pedido:*\n` +
            `🫙 ${ultimo.cantidad} garrafón${ultimo.cantidad > 1 ? 'es' : ''} — $${ultimo.total}\n` +
            `Estado: ${etiquetas[ultimo.estado] ?? ultimo.estado}`
        }
        break
      }

      // ── CANCELAR ───────────────────────────────────────────────
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

      // ── DESCONOCIDO ────────────────────────────────────────────
      default:
        respuesta = `No entendí ese mensaje 😅\n\n${MENSAJE_AYUDA}`
    }
  }

  // --- Log de mensaje saliente ---
  await supabaseAdmin.from('whatsapp_log').insert({
    telefono,
    mensaje:   respuesta,
    direccion: 'out',
    pedido_id: pedidoId ?? null,
  })

  // --- Respuesta TwiML (XML que entiende Twilio) ---
  const twiml = new twilio.twiml.MessagingResponse()
  twiml.message(respuesta)

  return new Response(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  })
}
