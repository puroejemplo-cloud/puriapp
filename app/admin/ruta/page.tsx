'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'
import { distanciaKm } from '@/lib/distancia'

type PedidoRuta = {
  id:         string
  cantidad:   number
  total:      number
  estado:     string
  created_at: string
  clientes: {
    nombre:    string
    direccion: string
    lat:       number | null
    lng:       number | null
  } | null
}

type Punto = { lat: number; lng: number }

function calcularRutaOptima(inicio: Punto, pedidos: PedidoRuta[]): PedidoRuta[] {
  const conCoords = pedidos.filter(p => p.clientes?.lat && p.clientes?.lng)
  const sinCoords = pedidos.filter(p => !p.clientes?.lat || !p.clientes?.lng)

  const pendientes = [...conCoords]
  const ruta: PedidoRuta[] = []
  let actual = inicio

  while (pendientes.length > 0) {
    let minDist = Infinity
    let idx = 0
    pendientes.forEach((p, i) => {
      const d = distanciaKm(actual.lat, actual.lng, p.clientes!.lat!, p.clientes!.lng!)
      if (d < minDist) { minDist = d; idx = i }
    })
    const sig = pendientes.splice(idx, 1)[0]
    ruta.push(sig)
    actual = { lat: sig.clientes!.lat!, lng: sig.clientes!.lng! }
  }

  return [...ruta, ...sinCoords]
}

const FILTROS = ['hoy', 'semana', 'mes'] as const
type Filtro = typeof FILTROS[number]

export default function AdminRuta() {
  const supabase = useMemo(() => crearClienteBrowser(), [])

  const [pedidos, setPedidos]   = useState<PedidoRuta[]>([])
  const [ruta, setRuta]         = useState<PedidoRuta[]>([])
  const [inicio, setInicio]     = useState<Punto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro]     = useState<Filtro>('hoy')

  useEffect(() => {
    async function cargar() {
      setCargando(true)

      // Punto de inicio desde zona configurada
      const { data: cfg } = await supabase
        .from('configuracion').select('valor').eq('clave', 'geocoding_zona').maybeSingle()
      if (cfg?.valor?.lat && cfg?.valor?.lng) {
        setInicio({ lat: cfg.valor.lat, lng: cfg.valor.lng })
      }

      const desde = new Date()
      if (filtro === 'hoy')    desde.setHours(0, 0, 0, 0)
      if (filtro === 'semana') desde.setDate(desde.getDate() - 7)
      if (filtro === 'mes')    desde.setDate(desde.getDate() - 30)

      const { data } = await supabase
        .from('pedidos')
        .select('id, cantidad, total, estado, created_at, clientes(nombre, direccion, lat, lng)')
        .neq('estado', 'cancelado')
        .gte('created_at', desde.toISOString())
        .order('created_at', { ascending: true })

      setPedidos((data as unknown as PedidoRuta[]) ?? [])
      setCargando(false)
    }
    cargar()
  }, [supabase, filtro])

  function generarRuta() {
    const puntoInicio = inicio ?? { lat: 0, lng: 0 }
    setRuta(calcularRutaOptima(puntoInicio, pedidos))
  }

  // Resumen por zona (agrupado por dirección aproximada)
  const totalGarrafones = pedidos.reduce((s, p) => s + p.cantidad, 0)
  const totalIngresos   = pedidos.reduce((s, p) => s + Number(p.total), 0)
  const sinUbicacion    = pedidos.filter(p => !p.clientes?.lat).length

  const listaMostrada = ruta.length > 0 ? ruta : pedidos

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Análisis de ruta</h1>
      <p className="text-sm text-gray-500 mb-4">Visualización interna de zonas de compra</p>

      {/* Filtro de período */}
      <div className="flex gap-2 mb-4">
        {FILTROS.map(f => (
          <button
            key={f}
            onClick={() => { setFiltro(f); setRuta([]) }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filtro === f ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'hoy' ? 'Hoy' : f === 'semana' ? 'Última semana' : 'Último mes'}
          </button>
        ))}
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-sky-600">{pedidos.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pedidos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{totalGarrafones}</p>
          <p className="text-xs text-gray-500 mt-0.5">Garrafones</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">${totalIngresos}</p>
          <p className="text-xs text-gray-500 mt-0.5">Ingreso</p>
        </div>
      </div>

      {/* Botón generar ruta */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={generarRuta}
          disabled={pedidos.length === 0 || cargando}
          className="bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          🗺 Ver ruta óptima
        </button>
        {ruta.length > 0 && (
          <button
            onClick={() => setRuta([])}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Mostrar por fecha
          </button>
        )}
        {!inicio && (
          <p className="text-xs text-amber-600">⚠️ Configura la zona en ⚙️ Config para mejor precisión</p>
        )}
      </div>

      {cargando && <p className="text-gray-400 text-sm">Cargando...</p>}

      {!cargando && pedidos.length === 0 && (
        <div className="text-center text-gray-400 py-16">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">Sin pedidos en este período</p>
        </div>
      )}

      {sinUbicacion > 0 && pedidos.length > 0 && (
        <p className="text-xs text-amber-600 mb-2 px-1">
          ⚠️ {sinUbicacion} pedido{sinUbicacion > 1 ? 's' : ''} sin coordenadas — aparece{sinUbicacion > 1 ? 'n' : ''} al final
        </p>
      )}

      <div className="space-y-2">
        {listaMostrada.map((p, i) => {
          const numero     = ruta.length > 0 ? i + 1 : null
          const sinCoords  = !p.clientes?.lat || !p.clientes?.lng
          const hora       = new Date(p.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

          return (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-start">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                numero ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {numero ?? (i + 1)}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{p.clientes?.nombre ?? '—'}</p>
                <p className="text-xs text-gray-400 truncate">{p.clientes?.direccion}</p>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>🫙 {p.cantidad}</span>
                  <span>${p.total}</span>
                  <span>{hora}</span>
                  {sinCoords && <span className="text-amber-500">sin ubicación</span>}
                </div>
              </div>

              {p.clientes?.lat && p.clientes?.lng && (
                <a
                  href={`https://www.google.com/maps/@${p.clientes.lat},${p.clientes.lng},17z`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-1 rounded-lg shrink-0 hover:bg-gray-100"
                >
                  📍
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
