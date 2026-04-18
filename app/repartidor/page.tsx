'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { crearClienteBrowser } from '@/lib/supabase-browser'
import { distanciaKm } from '@/lib/distancia'
import VentaRutaModal from '@/components/VentaRutaModal'
import { activarPush, yaEstaActivado, type ResultadoPush } from '@/lib/push'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ── Tipos ──────────────────────────────────────────────────────────────────
type EstadoPedido = 'pendiente' | 'en_ruta' | 'entregado' | 'cancelado'

type Pedido = {
  id: string
  estado: EstadoPedido
  cantidad: number
  total: number | null
  notas: string | null
  repartidor_id: string | null
  created_at: string
  clientes: {
    nombre: string
    direccion: string
    lat: number | null
    lng: number | null
    telefono: string
    referencias: string | null
  } | null
}

type Repartidor = { id: string; nombre: string }
type GPS = { lat: number; lng: number }
type VentasHoy = { garrafones: number; total: number }

// ── Componente principal ───────────────────────────────────────────────────
export default function RepartidorPage() {
  const router = useRouter()
  const supabase = useMemo(() => crearClienteBrowser(), [])

  const [repartidor, setRepartidor] = useState<Repartidor | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [gps, setGps] = useState<GPS | null>(null)
  const [cargando, setCargando] = useState(true)
  const [nuevoPedidoId, setNuevoPedidoId] = useState<string | null>(null)

  // Modal "Entregado"
  const [entregandoPedido, setEntregandoPedido] = useState<{ id: string; cantidad: number } | null>(null)
  const [garrafonesEntregados, setGarrafonesEntregados] = useState(0)

  // FASE 5: ventas en ruta
  const [modalVentaAbierto, setModalVentaAbierto] = useState(false)
  const [ventasHoy, setVentasHoy] = useState<VentasHoy>({ garrafones: 0, total: 0 })

  // FASE 8: notificaciones push
  const [pushActivado, setPushActivado] = useState(false)
  const [activandoPush, setActivandoPush] = useState(false)

  const canalRef        = useRef<RealtimeChannel | null>(null)
  const reconectandoRef = useRef(false)
  const montatoRef      = useRef(true)

  // ── Cargar pedidos activos ─────────────────────────────────────────────
  const cargarPedidos = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select(`
        id, estado, cantidad, total, notas, repartidor_id, created_at,
        clientes (nombre, direccion, lat, lng, telefono, referencias)
      `)
      .in('estado', ['pendiente', 'en_ruta'])
      .order('created_at', { ascending: true })

    if (data) setPedidos(data as unknown as Pedido[])
  }, [supabase])

  // ── Cargar resumen de ventas del día (ventas en ruta + pedidos entregados) ──
  const cargarVentasHoy = useCallback(async (repId: string) => {
    const inicio = new Date()
    inicio.setHours(0, 0, 0, 0)

    const [{ data: ventas }, { data: entregados }] = await Promise.all([
      supabase
        .from('ventas_ruta')
        .select('cantidad, total')
        .eq('repartidor_id', repId)
        .gte('created_at', inicio.toISOString()),
      supabase
        .from('pedidos')
        .select('garrafones_entregados, cantidad, total')
        .eq('repartidor_id', repId)
        .eq('estado', 'entregado')
        .gte('entregado_at', inicio.toISOString()),
    ])

    const garVentas     = (ventas     ?? []).reduce((s, v) => s + v.cantidad, 0)
    const totalVentas   = (ventas     ?? []).reduce((s, v) => s + Number(v.total), 0)
    const garPedidos    = (entregados ?? []).reduce((s, p) => s + (p.garrafones_entregados ?? p.cantidad), 0)
    const totalPedidos  = (entregados ?? []).reduce((s, p) => s + Number(p.total), 0)

    setVentasHoy({
      garrafones: garVentas + garPedidos,
      total:      totalVentas + totalPedidos,
    })
  }, [supabase])

  // ── Auth + carga inicial ───────────────────────────────────────────────
  useEffect(() => {
    let activo = true

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!activo) return
        if (!session) { router.replace('/login'); return }

        const { data: rep } = await supabase
          .from('repartidores')
          .select('id, nombre')
          .eq('user_id', session.user.id)
          .eq('activo', true)
          .maybeSingle()

        if (!activo) return
        if (!rep) { router.replace('/login'); return }

        setRepartidor(rep)
        await Promise.all([cargarPedidos(), cargarVentasHoy(rep.id)])
        setPushActivado(yaEstaActivado())
        setCargando(false)
      } catch {
        if (activo) router.replace('/login')
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/login')
    })

    return () => { activo = false; subscription.unsubscribe() }
  }, [supabase, router, cargarPedidos, cargarVentasHoy])

  // ── GPS continuo de alta precisión ────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // ── Realtime con reconexión automática ───────────────────────────────
  useEffect(() => {
    if (!repartidor) return
    montatoRef.current = true
    const repId = repartidor.id

    function suscribir() {
      if (!montatoRef.current || reconectandoRef.current) return
      canalRef.current?.unsubscribe()

      canalRef.current = supabase
        .channel(`cambios-ruta-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pedidos' },
          async payload => {
            await cargarPedidos()
            if (payload.eventType === 'INSERT') {
              navigator.vibrate?.([300, 150, 300])
              setNuevoPedidoId((payload.new as Pedido).id)
              setTimeout(() => setNuevoPedidoId(null), 4000)
              try { await new Audio('/gota.mp3').play() } catch { /* opcional */ }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'ventas_ruta' },
          async () => { await cargarVentasHoy(repId) }
        )
        .subscribe(status => {
          if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && montatoRef.current) {
            reconectandoRef.current = true
            setTimeout(() => {
              reconectandoRef.current = false
              suscribir()
            }, 4000)
          }
        })
    }

    suscribir()

    // Refrescar JWT cada 50 min para mantener sesión y metadata actualizados
    const jwtTimer = setInterval(() => {
      supabase.auth.refreshSession().catch(() => {})
    }, 50 * 60 * 1000)

    return () => {
      montatoRef.current = false
      canalRef.current?.unsubscribe()
      clearInterval(jwtTimer)
    }
  }, [repartidor, supabase, cargarPedidos, cargarVentasHoy])

  // ── Ordenar pedidos: en_ruta primero, luego por distancia ─────────────
  const pedidosOrdenados = useMemo(() => {
    return [...pedidos].sort((a, b) => {
      if (a.estado === 'en_ruta' && b.estado !== 'en_ruta') return -1
      if (b.estado === 'en_ruta' && a.estado !== 'en_ruta') return 1
      if (gps && a.clientes?.lat && b.clientes?.lat) {
        const da = distanciaKm(gps.lat, gps.lng, a.clientes.lat, a.clientes.lng!)
        const db = distanciaKm(gps.lat, gps.lng, b.clientes.lat, b.clientes.lng!)
        return da - db
      }
      return 0
    })
  }, [pedidos, gps])

  // ── Acciones ──────────────────────────────────────────────────────────
  async function tomarPedido(pedidoId: string) {
    await supabase
      .from('pedidos')
      .update({ estado: 'en_ruta', repartidor_id: repartidor!.id })
      .eq('id', pedidoId)
    await cargarPedidos()
  }

  async function confirmarEntregado() {
    if (!entregandoPedido) return
    await supabase
      .from('pedidos')
      .update({
        estado:                'entregado',
        garrafones_entregados: garrafonesEntregados,
        entregado_at:          new Date().toISOString(),
      })
      .eq('id', entregandoPedido.id)
    setEntregandoPedido(null)
    setGarrafonesEntregados(0)
    await Promise.all([cargarPedidos(), cargarVentasHoy(repartidor!.id)])
  }

  function abrirMapa(lat: number, lng: number) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  async function handleActivarPush() {
    if (!repartidor) return
    setActivandoPush(true)
    const resultado: ResultadoPush = await activarPush(repartidor.id)

    if (resultado === 'ok') {
      setPushActivado(true)
    } else if (resultado === 'no_soportado') {
      alert(
        '⚠️ Tu navegador no soporta notificaciones push.\n\n' +
        'En iPhone: agrega la app a tu pantalla de inicio primero (Safari → Compartir → Agregar a pantalla de inicio), luego vuelve a intentarlo.'
      )
    } else if (resultado === 'permiso_denegado') {
      alert(
        '🔕 Bloqueaste las notificaciones.\n\n' +
        'Para activarlas: ve a Configuración de tu teléfono → Notificaciones → [tu navegador] → activa los permisos para este sitio.'
      )
    } else {
      alert('❌ No se pudo activar. Intenta recargar la página.')
    }

    setActivandoPush(false)
  }

  // ── Pantalla de carga ─────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-sky-50 gap-3">
        <p className="text-5xl animate-bounce">💧</p>
        <p className="text-sky-600 font-medium">Cargando ruta...</p>
      </div>
    )
  }

  // ── UI principal ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header fijo */}
      <header className="bg-sky-500 text-white px-4 py-3 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg leading-tight">💧 Purificadora</h1>
            <p className="text-sky-100 text-xs">{repartidor?.nombre}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              gps ? 'bg-green-400 text-white' : 'bg-yellow-400 text-gray-800'
            }`}>
              {gps ? '📍 GPS activo' : '📍 Sin GPS'}
            </span>
            {!pushActivado && (
              <button
                onClick={handleActivarPush}
                disabled={activandoPush}
                className="text-xs bg-yellow-400 text-gray-900 px-2 py-0.5 rounded-full font-medium disabled:opacity-50"
              >
                {activandoPush ? '...' : '🔔 Activar'}
              </button>
            )}
            <button onClick={cerrarSesion} className="text-sky-200 text-xs underline ml-1">
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Resumen de ventas del día */}
      <div className="bg-green-500 text-white px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-medium">
          💰 Ventas hoy: {ventasHoy.garrafones} garrafón{ventasHoy.garrafones !== 1 ? 'es' : ''}
        </span>
        <span className="text-sm font-bold">${ventasHoy.total}</span>
      </div>

      {/* Contador de pedidos activos */}
      <div className="bg-sky-600 text-white text-center py-1 text-xs">
        {pedidosOrdenados.length === 0
          ? 'Sin pedidos activos'
          : `${pedidosOrdenados.length} pedido${pedidosOrdenados.length > 1 ? 's' : ''} activo${pedidosOrdenados.length > 1 ? 's' : ''}`}
      </div>

      {/* Lista de pedidos */}
      <main className="p-3 space-y-3 pb-24">

        {pedidosOrdenados.length === 0 && (
          <div className="text-center text-gray-400 mt-20 space-y-2">
            <p className="text-6xl">✅</p>
            <p className="font-medium">¡Todo entregado!</p>
            <p className="text-sm">Los pedidos nuevos aparecen aquí al instante</p>
          </div>
        )}

        {pedidosOrdenados.map(pedido => {
          const lat = pedido.clientes?.lat
          const lng = pedido.clientes?.lng
          const distancia = gps && lat && lng
            ? distanciaKm(gps.lat, gps.lng, lat, lng)
            : null
          const esMiPedido = pedido.repartidor_id === repartidor?.id
          const esNuevo    = pedido.id === nuevoPedidoId

          return (
            <div
              key={pedido.id}
              className={`bg-white rounded-2xl shadow-sm p-4 border-l-4 transition-all duration-300 ${
                esNuevo    ? 'border-green-400 ring-2 ring-green-300' :
                esMiPedido ? 'border-sky-500' :
                             'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  pedido.estado === 'en_ruta'
                    ? 'bg-sky-100 text-sky-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {pedido.estado === 'en_ruta' ? '🚚 En ruta' : '⏳ Pendiente'}
                </span>
                {distancia !== null && (
                  <span className="text-xs text-gray-400 font-medium">
                    {distancia < 1
                      ? `${Math.round(distancia * 1000)} m`
                      : `${distancia.toFixed(1)} km`}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-gray-800 text-base">{pedido.clientes?.nombre ?? '—'}</p>
                {pedido.clientes?.telefono && (
                  <a
                    href={`https://wa.me/${pedido.clientes.telefono.replace('+', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2.5 py-1 rounded-full border border-green-200 active:bg-green-100 shrink-0"
                  >
                    <span>💬</span>
                    <span>{pedido.clientes.telefono}</span>
                  </a>
                )}
              </div>
              <p className="text-sm text-gray-500 leading-snug">{pedido.clientes?.direccion}</p>
              {pedido.clientes?.referencias && (
                <p className="text-xs text-gray-400 italic mt-0.5">📌 {pedido.clientes.referencias}</p>
              )}

              <div className="flex gap-4 mt-2 text-sm text-gray-600">
                <span>🫙 {pedido.cantidad} garrafón{pedido.cantidad > 1 ? 'es' : ''}</span>
                {pedido.total !== null && <span className="font-medium">${pedido.total}</span>}
              </div>

              {pedido.notas && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1 mt-2">
                  💬 {pedido.notas}
                </p>
              )}

              <div className="flex gap-2 mt-3">
                {pedido.estado === 'pendiente' && (
                  <button
                    onClick={() => tomarPedido(pedido.id)}
                    className="flex-1 bg-sky-500 active:bg-sky-600 text-white py-2.5 rounded-xl font-semibold text-sm"
                  >
                    Tomar pedido
                  </button>
                )}

                {pedido.estado === 'en_ruta' && esMiPedido && (
                  <>
                    {lat && lng && (
                      <button
                        onClick={() => abrirMapa(lat, lng)}
                        className="flex-1 bg-green-500 active:bg-green-600 text-white py-2.5 rounded-xl font-semibold text-sm"
                      >
                        🗺 Navegar
                      </button>
                    )}
                    <button
                      onClick={() => { setEntregandoPedido({ id: pedido.id, cantidad: pedido.cantidad }); setGarrafonesEntregados(pedido.cantidad) }}
                      className="flex-1 bg-gray-800 active:bg-gray-900 text-white py-2.5 rounded-xl font-semibold text-sm"
                    >
                      ✅ Entregado
                    </button>
                  </>
                )}

                {pedido.estado === 'en_ruta' && !esMiPedido && (
                  <p className="text-xs text-gray-400 italic self-center">
                    Tomado por otro repartidor
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </main>

      {/* Botón flotante para venta en ruta */}
      <button
        onClick={() => setModalVentaAbierto(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-green-500 active:bg-green-600 text-white rounded-full shadow-xl text-3xl flex items-center justify-center z-10"
        title="Venta en ruta"
      >
        +
      </button>

      {/* Modal de confirmación de entrega */}
      {entregandoPedido && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-20">
          <div className="bg-white w-full rounded-t-3xl p-6 pb-8 shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Confirmar entrega</h2>
            <p className="text-sm text-gray-500 mb-5">¿Cuántos garrafones dejaste con el cliente?</p>

            <div className="flex items-center justify-center gap-6 mb-6">
              <button
                onClick={() => setGarrafonesEntregados(g => Math.max(0, g - 1))}
                className="w-14 h-14 rounded-full bg-gray-100 active:bg-gray-200 text-3xl font-bold text-gray-600 flex items-center justify-center"
              >
                −
              </button>
              <span className="text-4xl font-bold text-sky-600 w-14 text-center">
                {garrafonesEntregados}
              </span>
              <button
                onClick={() => setGarrafonesEntregados(g => g + 1)}
                className="w-14 h-14 rounded-full bg-sky-100 active:bg-sky-200 text-3xl font-bold text-sky-600 flex items-center justify-center"
              >
                +
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEntregandoPedido(null)}
                className="flex-1 border-2 border-gray-200 active:bg-gray-50 py-3 rounded-2xl text-gray-600 font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEntregado}
                className="flex-1 bg-sky-500 active:bg-sky-600 text-white py-3 rounded-2xl font-bold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de venta en ruta */}
      {modalVentaAbierto && repartidor && (
        <VentaRutaModal
          repartidorId={repartidor.id}
          gps={gps}
          onClose={() => setModalVentaAbierto(false)}
          onGuardado={() => cargarVentasHoy(repartidor.id)}
        />
      )}
    </div>
  )
}
