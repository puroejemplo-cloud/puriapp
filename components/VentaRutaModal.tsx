'use client'

import { useState, useEffect, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'
import { geocodificar } from '@/lib/geocoding'

type Props = {
  repartidorId: string
  gps: { lat: number; lng: number } | null
  onClose: () => void
  onGuardado: () => void
}

export default function VentaRutaModal({ repartidorId, gps, onClose, onGuardado }: Props) {
  const supabase = useMemo(() => crearClienteBrowser(), [])

  const [cantidad, setCantidad] = useState(1)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [convertirCliente, setConvertirCliente] = useState(false)
  const [precio, setPrecio] = useState(35)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [purificadoraId, setPurificadoraId] = useState<string | null>(null)

  // GPS propio del modal — usa el del padre o intenta obtener uno fresco
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(gps)
  const [gpsEstado, setGpsEstado] = useState<'obteniendo' | 'ok' | 'sin_gps'>(
    gps ? 'ok' : 'obteniendo'
  )

  // Si el padre no tiene GPS, solicitarlo directamente
  useEffect(() => {
    if (gps) { setUbicacion(gps); setGpsEstado('ok'); return }
    if (!navigator.geolocation) { setGpsEstado('sin_gps'); return }

    navigator.geolocation.getCurrentPosition(
      pos => {
        setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsEstado('ok')
      },
      () => setGpsEstado('sin_gps'),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [gps])

  // Obtener purificadora_id del usuario y precio en ruta
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setPurificadoraId(user?.user_metadata?.purificadora_id ?? null)
    })
    supabase
      .from('configuracion')
      .select('valor')
      .eq('clave', 'precios')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.valor?.ruta) setPrecio(Number(data.valor.ruta))
      })
  }, [supabase])

  const total = cantidad * precio

  async function guardar() {
    setGuardando(true)
    setError('')

    try {
      const { error: errorVenta } = await supabase
        .from('ventas_ruta')
        .insert({
          repartidor_id:   repartidorId,
          purificadora_id: purificadoraId,
          nombre_cliente:  nombre.trim() || null,
          telefono:       telefono.trim() || null,
          direccion:      direccion.trim() || null,
          lat:            ubicacion?.lat ?? null,
          lng:            ubicacion?.lng ?? null,
          cantidad,
          total,
          convertir_cliente: convertirCliente,
        })

      if (errorVenta) throw errorVenta

      // Convertir a cliente fijo si se marcó la opción y hay teléfono
      if (convertirCliente && telefono.trim()) {
        let coords = ubicacion ? { lat: ubicacion.lat, lng: ubicacion.lng } : null

        // Si tiene dirección, intentar geocodificar para mayor precisión
        if (direccion.trim()) {
          const geocoded = await geocodificar(direccion.trim())
          if (geocoded) coords = { lat: geocoded.lat, lng: geocoded.lng }
        }

        await supabase
          .from('clientes')
          .upsert(
            {
              telefono:        telefono.trim(),
              purificadora_id: purificadoraId,
              nombre:          nombre.trim() || 'Cliente sin nombre',
              direccion:       direccion.trim() || 'Sin dirección',
              lat:       coords?.lat ?? null,
              lng:       coords?.lng ?? null,
            },
            { onConflict: 'telefono' }
          )
      }

      onGuardado()
      onClose()
    } catch {
      setError('No se pudo guardar la venta. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-30">
      <div className="bg-white w-full rounded-t-3xl p-6 pb-8 shadow-xl max-h-[92vh] overflow-y-auto">

        {/* Encabezado */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800">Venta en ruta</h2>
          <button onClick={onClose} className="text-gray-400 text-3xl leading-none w-8 h-8 flex items-center justify-center">
            ×
          </button>
        </div>

        {/* Indicador de ubicación */}
        <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 mb-4 ${
          gpsEstado === 'ok'         ? 'bg-green-50 text-green-700' :
          gpsEstado === 'obteniendo' ? 'bg-yellow-50 text-yellow-700' :
                                       'bg-red-50 text-red-600'
        }`}>
          <span className="text-base">
            {gpsEstado === 'ok' ? '📍' : gpsEstado === 'obteniendo' ? '⏳' : '⚠️'}
          </span>
          <span>
            {gpsEstado === 'ok'
              ? `Ubicación capturada (${ubicacion!.lat.toFixed(5)}, ${ubicacion!.lng.toFixed(5)})`
              : gpsEstado === 'obteniendo'
              ? 'Obteniendo ubicación...'
              : 'Sin GPS — la venta se guardará sin coordenadas'}
          </span>
        </div>

        {/* Selector de cantidad */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-600 mb-2 text-center">
            Garrafones
          </label>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setCantidad(c => Math.max(1, c - 1))}
              className="w-14 h-14 rounded-full bg-gray-100 active:bg-gray-200 text-3xl font-bold text-gray-600"
            >
              −
            </button>
            <span className="text-4xl font-bold text-sky-600 w-14 text-center">{cantidad}</span>
            <button
              onClick={() => setCantidad(c => c + 1)}
              className="w-14 h-14 rounded-full bg-sky-100 active:bg-sky-200 text-3xl font-bold text-sky-600"
            >
              +
            </button>
          </div>
          <p className="text-center text-gray-500 text-sm mt-3">
            ${precio} c/u —{' '}
            <span className="font-bold text-gray-800 text-base">${total} total</span>
          </p>
        </div>

        {/* Datos del cliente (todos opcionales) */}
        <div className="space-y-3 mb-4">
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Nombre del cliente (opcional)"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <input
            type="tel"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            placeholder="Teléfono (opcional)"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <input
            type="text"
            value={direccion}
            onChange={e => setDireccion(e.target.value)}
            placeholder="Dirección (opcional)"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>

        {/* Opción de convertir a cliente fijo (solo si hay teléfono) */}
        {telefono.trim() && (
          <label className="flex items-center gap-3 mb-5 cursor-pointer bg-sky-50 rounded-xl p-3">
            <input
              type="checkbox"
              checked={convertirCliente}
              onChange={e => setConvertirCliente(e.target.checked)}
              className="w-5 h-5 rounded accent-sky-500 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">Agregar como cliente fijo</p>
              <p className="text-xs text-gray-500">Podrá pedir por WhatsApp la próxima vez</p>
            </div>
          </label>
        )}

        {error && (
          <p className="text-red-500 text-sm text-center mb-3">{error}</p>
        )}

        <button
          onClick={guardar}
          disabled={guardando}
          className="w-full bg-green-500 active:bg-green-600 disabled:opacity-50 text-white py-4 rounded-2xl font-bold text-base"
        >
          {guardando ? 'Guardando...' : `Registrar — $${total}`}
        </button>
      </div>
    </div>
  )
}
