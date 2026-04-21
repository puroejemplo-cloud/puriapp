'use client'

import { useEffect, useState, useRef } from 'react'
import { use } from 'react'

type Estado = 'pendiente' | 'en_ruta' | 'entregado' | 'cancelado'

type SeguimientoData = {
  estado:              Estado
  cantidad:            number
  total:               number
  created_at:          string
  entregado_at:        string | null
  cliente_nombre:      string | null
  repartidor_nombre:   string | null
  purificadora_nombre: string | null
  purificadora_id:     string | null
  logo_url:            string | null
}

const PASOS: { estado: Estado; label: string; icon: string }[] = [
  { estado: 'pendiente', label: 'Recibido',  icon: '📋' },
  { estado: 'en_ruta',   label: 'En camino', icon: '🚚' },
  { estado: 'entregado', label: 'Entregado', icon: '✅' },
]

function pasoActual(estado: Estado): number {
  return PASOS.findIndex(p => p.estado === estado)
}

export default function SeguimientoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData]               = useState<SeguimientoData | null>(null)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [cargando, setCargando]       = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function cargar() {
    try {
      const res = await fetch(`/api/pedido/seguimiento/${id}`)
      if (!res.ok) { setNoEncontrado(true); return }
      const d: SeguimientoData = await res.json()
      setData(d)
      // Dejar de actualizar cuando el pedido terminó
      if (d.estado === 'entregado' || d.estado === 'cancelado') {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    } catch { /* reintentará en el siguiente ciclo */ }
    finally { setCargando(false) }
  }

  useEffect(() => {
    cargar()
    intervalRef.current = setInterval(cargar, 30_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (cargando) return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center">
      <p className="text-sky-400 text-sm animate-pulse">Buscando tu pedido…</p>
    </div>
  )

  if (noEncontrado || !data) return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">😕</div>
        <h1 className="text-lg font-bold text-gray-800 mb-2">Pedido no encontrado</h1>
        <p className="text-gray-500 text-sm">El enlace no es válido o el pedido expiró.</p>
      </div>
    </div>
  )

  const paso      = pasoActual(data.estado)
  const cancelado = data.estado === 'cancelado'
  const terminado = data.estado === 'entregado' || cancelado

  return (
    <div className="min-h-screen bg-sky-50 py-8 px-4">
      <div className="max-w-sm mx-auto space-y-5">

        {/* Header */}
        <div className="text-center">
          {data.logo_url
            ? <img src={data.logo_url} alt={data.purificadora_nombre ?? ''} className="h-14 w-14 rounded-2xl object-cover mx-auto mb-3 shadow-sm" />
            : <div className="text-4xl mb-2">💧</div>
          }
          {data.purificadora_nombre && (
            <p className="text-sm font-medium text-sky-600">{data.purificadora_nombre}</p>
          )}
          <h1 className="text-xl font-bold text-gray-800 mt-1">Estado de tu pedido</h1>
          {data.cliente_nombre && (
            <p className="text-sm text-gray-500 mt-0.5">Hola, <strong>{data.cliente_nombre}</strong></p>
          )}
        </div>

        {/* Estado cancelado */}
        {cancelado ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <div className="text-3xl mb-2">❌</div>
            <p className="font-semibold text-red-700">Pedido cancelado</p>
          </div>
        ) : (
          /* Barra de progreso */
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-start justify-between relative">
              {/* Línea gris de fondo */}
              <div className="absolute left-[2.5rem] right-[2.5rem] top-5 h-0.5 bg-gray-100 z-0" />
              {/* Línea de avance */}
              <div
                className="absolute left-[2.5rem] top-5 h-0.5 bg-sky-400 z-0 transition-all duration-700"
                style={{ width: paso >= 2 ? 'calc(100% - 5rem)' : paso === 1 ? '50%' : '0%' }}
              />
              {PASOS.map((p, i) => (
                <div key={p.estado} className="flex flex-col items-center z-10 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl border-2 transition-all ${
                    i < paso  ? 'bg-sky-500 border-sky-500 text-white shadow-sm' :
                    i === paso ? 'bg-white border-sky-400 text-sky-500 scale-110 shadow-md' :
                    'bg-white border-gray-200 text-gray-300'
                  }`}>
                    {p.icon}
                  </div>
                  <p className={`text-xs mt-2 font-medium text-center leading-tight ${
                    i <= paso ? 'text-sky-600' : 'text-gray-300'
                  }`}>{p.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 text-center text-sm text-gray-600 min-h-[2.5rem]">
              {data.estado === 'pendiente' && 'Tu pedido está siendo preparado. En breve un repartidor saldrá a entregarlo.'}
              {data.estado === 'en_ruta'   && <>¡Ya va en camino!{data.repartidor_nombre && <> <strong>{data.repartidor_nombre}</strong> se dirige hacia ti.</>}</>}
              {data.estado === 'entregado' && <span className="text-green-700 font-medium">¡Pedido entregado! Gracias por tu preferencia. 🎉</span>}
            </div>
          </div>
        )}

        {/* Detalle del pedido */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Detalle</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Garrafones</span>
              <span className="font-medium text-gray-800">{data.cantidad} × 20 L</span>
            </div>
            <div className="flex justify-between border-t border-gray-50 pt-2">
              <span className="text-gray-700 font-semibold">Total</span>
              <span className="font-bold text-gray-900">${data.total}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 pt-1">
              <span>Pedido</span>
              <span>{new Date(data.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            {data.entregado_at && (
              <div className="flex justify-between text-xs text-gray-400">
                <span>Entregado</span>
                <span>{new Date(data.entregado_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Botón pedir de nuevo (solo cuando el pedido terminó) */}
        {terminado && data.purificadora_id && (
          <a
            href={`/pedido/${data.purificadora_id}`}
            className="block w-full py-3.5 rounded-xl bg-sky-500 text-white text-sm font-semibold text-center hover:bg-sky-600 transition"
          >
            Hacer un nuevo pedido
          </a>
        )}

        {!terminado && (
          <p className="text-center text-xs text-gray-400">
            Esta página se actualiza automáticamente cada 30 segundos.
          </p>
        )}
      </div>
    </div>
  )
}
