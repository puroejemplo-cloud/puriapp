'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type ZonaConfig = { lat: number | null; lng: number | null; radio_km: number }

export default function AdminConfiguracion() {
  const supabase = useMemo(() => crearClienteBrowser(), [])

  const [zona, setZona]           = useState<ZonaConfig>({ lat: null, lng: null, radio_km: 10 })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje]     = useState('')
  const [obteniendo, setObteniendo] = useState(false)

  useEffect(() => {
    supabase.from('configuracion').select('valor').eq('clave', 'geocoding_zona').maybeSingle()
      .then(({ data }) => {
        if (data?.valor) setZona(data.valor as ZonaConfig)
      })
  }, [supabase])

  function usarUbicacionActual() {
    if (!navigator.geolocation) {
      setMensaje('⚠️ Tu navegador no soporta geolocalización')
      return
    }
    setObteniendo(true)
    setMensaje('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setZona(z => ({ ...z, lat: pos.coords.latitude, lng: pos.coords.longitude }))
        setObteniendo(false)
        setMensaje('📍 Ubicación capturada. Guarda los cambios para aplicarla.')
      },
      () => {
        setObteniendo(false)
        setMensaje('⚠️ No se pudo obtener la ubicación. Verifica los permisos del navegador.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function guardar() {
    setGuardando(true)
    setMensaje('')
    await supabase.from('configuracion')
      .upsert({ clave: 'geocoding_zona', valor: zona }, { onConflict: 'clave' })
    setGuardando(false)
    setMensaje('✅ Configuración guardada correctamente')
  }

  function limpiar() {
    setZona(z => ({ ...z, lat: null, lng: null }))
    setMensaje('Zona limpiada. El geocoding buscará en todo México.')
  }

  const tieneZona = zona.lat !== null && zona.lng !== null

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Configuración</h1>
      <p className="text-sm text-gray-500 mb-6">Ajustes generales del sistema</p>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-1">📍 Zona de búsqueda de direcciones</h2>
        <p className="text-sm text-gray-500 mb-4">
          Limita el geocoding a un radio alrededor de tu zona de operación.
          Las direcciones ingresadas (por WhatsApp o admin) solo se buscarán dentro de este radio.
        </p>

        {/* Estado actual */}
        <div className={`rounded-xl p-3 mb-4 text-sm ${tieneZona ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
          {tieneZona
            ? `✓ Zona activa: ${zona.lat!.toFixed(5)}, ${zona.lng!.toFixed(5)} — radio ${zona.radio_km} km`
            : '⚠️ Sin zona configurada — busca en todo México'}
        </div>

        {/* Botón capturar GPS */}
        <button
          onClick={usarUbicacionActual}
          disabled={obteniendo}
          className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl mb-3 text-sm"
        >
          {obteniendo ? '📡 Obteniendo ubicación...' : '📍 Usar mi ubicación actual como centro'}
        </button>

        {/* Coordenadas manuales */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Latitud</label>
            <input
              type="number"
              step="0.00001"
              placeholder="19.43260"
              value={zona.lat ?? ''}
              onChange={e => setZona(z => ({ ...z, lat: e.target.value ? parseFloat(e.target.value) : null }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Longitud</label>
            <input
              type="number"
              step="0.00001"
              placeholder="-99.13320"
              value={zona.lng ?? ''}
              onChange={e => setZona(z => ({ ...z, lng: e.target.value ? parseFloat(e.target.value) : null }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
        </div>

        {/* Radio */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Radio de búsqueda: <strong>{zona.radio_km} km</strong>
          </label>
          <input
            type="range"
            min={1}
            max={50}
            value={zona.radio_km}
            onChange={e => setZona(z => ({ ...z, radio_km: parseInt(e.target.value) }))}
            className="w-full accent-sky-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>1 km (colonia)</span>
            <span>25 km</span>
            <span>50 km (ciudad)</span>
          </div>
        </div>

        {/* Mapa de referencia */}
        {tieneZona && (
          <a
            href={`https://www.google.com/maps/@${zona.lat},${zona.lng},13z`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs text-sky-600 underline mb-4"
          >
            Ver centro en Google Maps →
          </a>
        )}

        {mensaje && (
          <p className={`text-sm rounded-xl px-3 py-2 mb-3 ${
            mensaje.startsWith('✅') ? 'bg-green-50 text-green-700' :
            mensaje.startsWith('📍') ? 'bg-sky-50 text-sky-700' :
            'bg-yellow-50 text-yellow-700'
          }`}>
            {mensaje}
          </p>
        )}

        <div className="flex gap-2">
          {tieneZona && (
            <button
              onClick={limpiar}
              className="flex-1 border-2 border-gray-200 hover:bg-gray-50 py-2.5 rounded-xl text-gray-500 font-medium text-sm"
            >
              Quitar zona
            </button>
          )}
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
