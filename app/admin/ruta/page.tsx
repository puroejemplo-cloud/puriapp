'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'
import { distanciaKm } from '@/lib/distancia'

type Repartidor = { id: string; nombre: string }

type PedidoRuta = {
  id:         string
  cantidad:   number
  total:      number
  orden_ruta: number | null
  clientes: {
    nombre:    string
    direccion: string
    telefono:  string
    lat:       number | null
    lng:       number | null
  } | null
}

type Punto = { lat: number; lng: number }

// Algoritmo vecino más cercano (TSP greedy)
function calcularRutaOptima(inicio: Punto, pedidos: PedidoRuta[]): PedidoRuta[] {
  const conCoords  = pedidos.filter(p => p.clientes?.lat && p.clientes?.lng)
  const sinCoords  = pedidos.filter(p => !p.clientes?.lat || !p.clientes?.lng)

  const pendientes = [...conCoords]
  const ruta: PedidoRuta[] = []
  let actual = inicio

  while (pendientes.length > 0) {
    let minDist = Infinity
    let idxMasCercano = 0

    pendientes.forEach((p, i) => {
      const d = distanciaKm(actual.lat, actual.lng, p.clientes!.lat!, p.clientes!.lng!)
      if (d < minDist) { minDist = d; idxMasCercano = i }
    })

    const siguiente = pendientes.splice(idxMasCercano, 1)[0]
    ruta.push(siguiente)
    actual = { lat: siguiente.clientes!.lat!, lng: siguiente.clientes!.lng! }
  }

  // Los pedidos sin coordenadas van al final
  return [...ruta, ...sinCoords]
}

export default function AdminRuta() {
  const supabase = useMemo(() => crearClienteBrowser(), [])

  const [pedidos, setPedidos]           = useState<PedidoRuta[]>([])
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [repartidorId, setRepartidorId] = useState('')
  const [rutaGenerada, setRutaGenerada] = useState<PedidoRuta[]>([])
  const [inicio, setInicio]             = useState<Punto | null>(null)
  const [cargando, setCargando]         = useState(true)
  const [guardando, setGuardando]       = useState(false)
  const [mensaje, setMensaje]           = useState('')

  useEffect(() => {
    async function cargar() {
      const [{ data: peds }, { data: reps }, { data: cfg }] = await Promise.all([
        supabase
          .from('pedidos')
          .select('id, cantidad, total, orden_ruta, clientes(nombre, direccion, telefono, lat, lng)')
          .in('estado', ['pendiente', 'en_ruta'])
          .order('created_at', { ascending: true }),
        supabase.from('repartidores').select('id, nombre').eq('activo', true),
        supabase.from('configuracion').select('valor').eq('clave', 'geocoding_zona').maybeSingle(),
      ])

      setPedidos((peds as unknown as PedidoRuta[]) ?? [])

      const lista = reps ?? []
      setRepartidores(lista)
      if (lista.length > 0) setRepartidorId(lista[0].id)

      // Usar el centro de la zona configurada como punto de inicio
      if (cfg?.valor?.lat && cfg?.valor?.lng) {
        setInicio({ lat: cfg.valor.lat, lng: cfg.valor.lng })
      }

      setCargando(false)
    }
    cargar()
  }, [supabase])

  function generarRuta() {
    setMensaje('')
    const puntoInicio = inicio ?? { lat: 0, lng: 0 }
    const ruta = calcularRutaOptima(puntoInicio, pedidos)
    setRutaGenerada(ruta)
  }

  async function confirmarRuta() {
    if (!rutaGenerada.length || !repartidorId) return
    setGuardando(true)
    setMensaje('')

    // Actualizar cada pedido con su orden y asignar repartidor
    await Promise.all(
      rutaGenerada.map((p, i) =>
        supabase.from('pedidos').update({
          orden_ruta:    i + 1,
          repartidor_id: repartidorId,
          estado:        'en_ruta',
        }).eq('id', p.id)
      )
    )

    // Notificar al repartidor
    const rep = repartidores.find(r => r.id === repartidorId)
    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo:       '🗺 Ruta asignada',
        cuerpo:       `${rutaGenerada.length} paradas — ¡a entregar!`,
        url:          '/repartidor',
        repartidorId,
      }),
    }).catch(() => {})

    setGuardando(false)
    setMensaje(`✅ Ruta de ${rutaGenerada.length} paradas asignada a ${rep?.nombre}`)
    setRutaGenerada([])

    // Recargar pedidos
    const { data } = await supabase
      .from('pedidos')
      .select('id, cantidad, total, orden_ruta, clientes(nombre, direccion, telefono, lat, lng)')
      .in('estado', ['pendiente', 'en_ruta'])
      .order('created_at', { ascending: true })
    setPedidos((data as unknown as PedidoRuta[]) ?? [])
  }

  async function limpiarRuta() {
    await supabase.from('pedidos')
      .update({ orden_ruta: null })
      .in('estado', ['pendiente', 'en_ruta'])
    setRutaGenerada([])
    setMensaje('Ruta limpiada')
  }

  const pedidosMostrados = rutaGenerada.length > 0 ? rutaGenerada : pedidos

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Ruta del día</h1>
          <p className="text-sm text-gray-500">
            {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} activo{pedidos.length !== 1 ? 's' : ''}
            {inicio
              ? ' · inicio desde zona configurada'
              : ' · configura la zona en ⚙️ Config para mejor precisión'}
          </p>
        </div>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Repartidor</label>
            <select
              value={repartidorId}
              onChange={e => setRepartidorId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              <option value="">Seleccionar…</option>
              {repartidores.map(r => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          </div>

          <button
            onClick={generarRuta}
            disabled={pedidos.length === 0 || cargando}
            className="bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-xl text-sm"
          >
            🗺 Generar ruta óptima
          </button>

          {rutaGenerada.length > 0 && (
            <button
              onClick={confirmarRuta}
              disabled={guardando || !repartidorId}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-xl text-sm"
            >
              {guardando ? 'Asignando...' : '✅ Confirmar y asignar'}
            </button>
          )}

          {pedidos.some(p => p.orden_ruta) && rutaGenerada.length === 0 && (
            <button
              onClick={limpiarRuta}
              className="border border-gray-200 text-gray-500 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm"
            >
              Limpiar ruta
            </button>
          )}
        </div>

        {mensaje && (
          <p className={`mt-3 text-sm rounded-xl px-3 py-2 ${
            mensaje.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-sky-50 text-sky-700'
          }`}>
            {mensaje}
          </p>
        )}
      </div>

      {/* Lista de paradas */}
      {cargando && <p className="text-gray-400 text-sm">Cargando...</p>}

      {!cargando && pedidos.length === 0 && (
        <div className="text-center text-gray-400 py-16">
          <p className="text-5xl mb-3">✅</p>
          <p className="font-medium">Sin pedidos activos</p>
        </div>
      )}

      {rutaGenerada.length > 0 && (
        <p className="text-xs text-sky-600 font-medium mb-2 px-1">
          Vista previa — confirma para asignar al repartidor
        </p>
      )}

      <div className="space-y-2">
        {pedidosMostrados.map((p, i) => {
          const numero    = rutaGenerada.length > 0 ? i + 1 : (p.orden_ruta ?? null)
          const sinCoords = !p.clientes?.lat || !p.clientes?.lng

          return (
            <div
              key={p.id}
              className={`bg-white rounded-2xl border shadow-sm p-4 flex gap-4 items-start ${
                rutaGenerada.length > 0 ? 'border-sky-200' : 'border-gray-100'
              }`}
            >
              {/* Número de parada */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                numero
                  ? 'bg-sky-500 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {numero ?? '—'}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{p.clientes?.nombre ?? '—'}</p>
                <p className="text-xs text-gray-500 truncate">{p.clientes?.direccion}</p>
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  <span>🫙 {p.cantidad} garrafón{p.cantidad !== 1 ? 'es' : ''}</span>
                  <span className="font-medium text-gray-600">${p.total}</span>
                  {sinCoords && <span className="text-amber-500">⚠️ Sin ubicación</span>}
                </div>
              </div>

              {p.clientes?.lat && p.clientes?.lng && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.clientes.lat},${p.clientes.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg shrink-0"
                >
                  🗺 Maps
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
