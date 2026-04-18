'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type ZonaConfig   = { lat: number | null; lng: number | null; radio_km: number }
type PreciosConfig = { pedido: number; ruta: number }

export default function AdminConfiguracion() {
  const supabase = useMemo(() => crearClienteBrowser(), [])

  // Zona de geocoding
  const [zona, setZona]             = useState<ZonaConfig>({ lat: null, lng: null, radio_km: 10 })
  const [guardandoZona, setGZ]      = useState(false)
  const [mensajeZona, setMZ]        = useState('')
  const [obteniendo, setObteniendo] = useState(false)

  // Precios
  const [precios, setPrecios]       = useState<PreciosConfig>({ pedido: 35, ruta: 35 })
  const [guardandoPrecios, setGP]   = useState(false)
  const [mensajePrecios, setMP]     = useState('')

  const [purificadoraId, setPurificadoraId] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      setPurificadoraId(session?.user?.user_metadata?.purificadora_id ?? null)

      const res = await fetch('/api/admin/configuracion', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) return
      const { data } = await res.json() as { data: { clave: string; valor: unknown }[] }

      for (const row of data) {
        if (row.clave === 'geocoding_zona') setZona(row.valor as ZonaConfig)
        if (row.clave === 'precios')        setPrecios(row.valor as PreciosConfig)
      }
    }
    cargar()
  }, [supabase])

  // ── Zona ──────────────────────────────────────────────────────────────────
  function usarUbicacionActual() {
    if (!navigator.geolocation) { setMZ('⚠️ Tu navegador no soporta geolocalización'); return }
    setObteniendo(true); setMZ('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setZona(z => ({ ...z, lat: pos.coords.latitude, lng: pos.coords.longitude }))
        setObteniendo(false)
        setMZ('📍 Ubicación capturada. Guarda los cambios para aplicarla.')
      },
      () => { setObteniendo(false); setMZ('⚠️ No se pudo obtener la ubicación.') },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function guardarConfig(clave: string, valor: unknown, setGuardando: (v: boolean) => void, setMensaje: (v: string) => void) {
    setGuardando(true); setMensaje('')

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''

    const res = await fetch('/api/admin/configuracion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ clave, valor }),
    })
    const json = await res.json()

    setGuardando(false)
    setMensaje(json.ok ? '✅ Guardado correctamente' : `⚠️ Error: ${json.error}`)
  }

  async function guardarZona() {
    await guardarConfig('geocoding_zona', zona, setGZ, setMZ)
  }

  // ── Precios ───────────────────────────────────────────────────────────────
  async function guardarPrecios() {
    if (precios.pedido <= 0 || precios.ruta <= 0) {
      setMP('⚠️ Los precios deben ser mayores a cero'); return
    }
    await guardarConfig('precios', precios, setGP, setMP)
    await supabase.from('productos')
      .update({ precio: precios.pedido })
      .eq('nombre', 'Garrafón 20L')
  }

  const tieneZona = zona.lat !== null && zona.lng !== null

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 mb-1">Configuración</h1>
        <p className="text-sm text-gray-500">Ajustes generales del sistema</p>
      </div>

      {/* ── PRECIOS ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-1">💰 Precios del garrafón</h2>
        <p className="text-sm text-gray-500 mb-4">
          Puedes manejar un precio diferente para pedidos a domicilio y ventas en ruta.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1 block">
              Precio pedido
              <span className="block text-xs font-normal text-gray-400">WhatsApp / Admin</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
              <input
                type="number"
                min={1}
                step={0.5}
                value={precios.pedido}
                onChange={e => setPrecios(p => ({ ...p, pedido: parseFloat(e.target.value) || 0 }))}
                className="w-full border-2 border-gray-200 focus:border-sky-400 rounded-xl pl-7 pr-3 py-3 text-lg font-bold text-gray-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1 block">
              Precio en ruta
              <span className="block text-xs font-normal text-gray-400">Venta al paso</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
              <input
                type="number"
                min={1}
                step={0.5}
                value={precios.ruta}
                onChange={e => setPrecios(p => ({ ...p, ruta: parseFloat(e.target.value) || 0 }))}
                className="w-full border-2 border-gray-200 focus:border-sky-400 rounded-xl pl-7 pr-3 py-3 text-lg font-bold text-gray-900 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {mensajePrecios && (
          <p className={`text-sm rounded-xl px-3 py-2 mb-3 ${
            mensajePrecios.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
          }`}>{mensajePrecios}</p>
        )}

        <button
          onClick={guardarPrecios}
          disabled={guardandoPrecios}
          className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm"
        >
          {guardandoPrecios ? 'Guardando...' : 'Guardar precios'}
        </button>
      </div>

      {/* ── ZONA GEOCODING ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-1">📍 Zona de búsqueda de direcciones</h2>
        <p className="text-sm text-gray-500 mb-4">
          Limita el geocoding a un radio alrededor de tu zona de operación.
        </p>

        <div className={`rounded-xl p-3 mb-4 text-sm ${tieneZona ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
          {tieneZona
            ? `✓ Zona activa: ${zona.lat!.toFixed(5)}, ${zona.lng!.toFixed(5)} — radio ${zona.radio_km} km`
            : '⚠️ Sin zona configurada — busca en todo México'}
        </div>

        <button
          onClick={usarUbicacionActual}
          disabled={obteniendo}
          className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl mb-3 text-sm"
        >
          {obteniendo ? '📡 Obteniendo ubicación...' : '📍 Usar mi ubicación actual como centro'}
        </button>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Latitud</label>
            <input
              type="number" step="0.00001" placeholder="19.43260"
              value={zona.lat ?? ''}
              onChange={e => setZona(z => ({ ...z, lat: e.target.value ? parseFloat(e.target.value) : null }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Longitud</label>
            <input
              type="number" step="0.00001" placeholder="-99.13320"
              value={zona.lng ?? ''}
              onChange={e => setZona(z => ({ ...z, lng: e.target.value ? parseFloat(e.target.value) : null }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Radio de búsqueda: <strong>{zona.radio_km} km</strong>
          </label>
          <input type="range" min={1} max={50} value={zona.radio_km}
            onChange={e => setZona(z => ({ ...z, radio_km: parseInt(e.target.value) }))}
            className="w-full accent-sky-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>1 km</span><span>25 km</span><span>50 km</span>
          </div>
        </div>

        {tieneZona && (
          <a href={`https://www.google.com/maps/@${zona.lat},${zona.lng},13z`}
            target="_blank" rel="noopener noreferrer"
            className="block text-center text-xs text-sky-600 underline mb-4"
          >Ver centro en Google Maps →</a>
        )}

        {mensajeZona && (
          <p className={`text-sm rounded-xl px-3 py-2 mb-3 ${
            mensajeZona.startsWith('✅') ? 'bg-green-50 text-green-700' :
            mensajeZona.startsWith('📍') ? 'bg-sky-50 text-sky-700' : 'bg-yellow-50 text-yellow-700'
          }`}>{mensajeZona}</p>
        )}

        <div className="flex gap-2">
          {tieneZona && (
            <button onClick={() => setZona(z => ({ ...z, lat: null, lng: null }))}
              className="flex-1 border-2 border-gray-200 hover:bg-gray-50 py-2.5 rounded-xl text-gray-500 font-medium text-sm"
            >Quitar zona</button>
          )}
          <button onClick={guardarZona} disabled={guardandoZona}
            className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm"
          >{guardandoZona ? 'Guardando...' : 'Guardar zona'}</button>
        </div>
      </div>
    </div>
  )
}
