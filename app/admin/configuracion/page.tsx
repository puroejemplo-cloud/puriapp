'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'
import { type HorarioSemana, NOMBRES_DIAS, ORDEN_DIAS, HORARIO_DEFAULT } from '@/lib/horario'

type ZonaConfig   = { lat: number | null; lng: number | null; radio_km: number; ciudad?: string }
type PreciosConfig = { pedido: number; ruta: number }

export default function AdminConfiguracion() {
  const supabase = useMemo(() => crearClienteBrowser(), [])

  // Zona de geocoding
  const [zona, setZona]             = useState<ZonaConfig>({ lat: null, lng: null, radio_km: 10, ciudad: '' })
  const [guardandoZona, setGZ]      = useState(false)
  const [mensajeZona, setMZ]        = useState('')
  const [obteniendo, setObteniendo] = useState(false)
  const [urlMaps, setUrlMaps]       = useState('')
  const [urlError, setUrlError]     = useState('')

  // Precios
  const [precios, setPrecios]       = useState<PreciosConfig>({ pedido: 35, ruta: 35 })
  const [guardandoPrecios, setGP]   = useState(false)
  const [mensajePrecios, setMP]     = useState('')

  const [purificadoraId, setPurificadoraId] = useState<string | null>(null)
  const [urlCopiada, setUrlCopiada]         = useState(false)

  // Logo
  const [logoUrl,       setLogoUrl]       = useState<string | null>(null)
  const [subiendoLogo,  setSubiendoLogo]  = useState(false)
  const [mensajeLogo,   setMensajeLogo]   = useState('')

  // Municipios / colonias
  const [municipios,       setMunicipios]       = useState<string[]>([])
  const [nuevoMunicipio,   setNuevoMunicipio]   = useState('')
  const [guardandoMunis,   setGuardandoMunis]   = useState(false)
  const [mensajeMunis,     setMensajeMunis]     = useState('')

  // Horario
  const [horario,         setHorario]         = useState<HorarioSemana>(HORARIO_DEFAULT)
  const [guardandoHorario,setGuardandoHorario] = useState(false)
  const [mensajeHorario,  setMensajeHorario]  = useState('')

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
        if (row.clave === 'municipios')     setMunicipios((row.valor as string[]) ?? [])
        if (row.clave === 'logo_url')       setLogoUrl(row.valor as string)
        if (row.clave === 'horario')        setHorario(row.valor as HorarioSemana)
      }
    }
    cargar()
  }, [supabase])

  // ── Zona ──────────────────────────────────────────────────────────────────
  function extraerCoordsDeUrl(url: string) {
    setUrlError('')
    // Formato /@lat,lng,zoom
    const atMatch = url.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/)
    if (atMatch) {
      setZona(z => ({ ...z, lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) }))
      setUrlMaps('')
      setMZ('📍 Coordenadas extraídas de la URL. Guarda los cambios para aplicarlas.')
      return
    }
    // Formato ?q=lat,lng
    const qMatch = url.match(/[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/)
    if (qMatch) {
      setZona(z => ({ ...z, lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) }))
      setUrlMaps('')
      setMZ('📍 Coordenadas extraídas de la URL. Guarda los cambios para aplicarlas.')
      return
    }
    setUrlError('No se encontraron coordenadas en esta URL. Asegúrate de pegar la URL completa de Google Maps.')
  }

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
    setMensaje(json.ok ? '✅ Guardado v1.3' : `⚠️ Error: ${json.error}`)
  }

  async function guardarZona() {
    await guardarConfig('geocoding_zona', zona, setGZ, setMZ)
  }

  async function guardarHorario() {
    await guardarConfig('horario', horario, setGuardandoHorario, setMensajeHorario)
  }

  // ── Logo ──────────────────────────────────────────────────────────────────
  async function subirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !purificadoraId) return
    setSubiendoLogo(true)
    setMensajeLogo('')

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(`${purificadoraId}/logo`, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setMensajeLogo(`⚠️ Error al subir: ${uploadError.message}`)
      setSubiendoLogo(false)
      return
    }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(`${purificadoraId}/logo`)
    // Añadir timestamp para evitar caché al reemplazar el logo
    const url = `${urlData.publicUrl}?v=${Date.now()}`
    setLogoUrl(url)
    await guardarConfig('logo_url', url, setSubiendoLogo, setMensajeLogo)
  }

  // ── Municipios ────────────────────────────────────────────────────────────
  function agregarMunicipio() {
    const nombre = nuevoMunicipio.trim()
    if (!nombre || municipios.includes(nombre)) return
    setMunicipios(m => [...m, nombre])
    setNuevoMunicipio('')
  }

  function quitarMunicipio(nombre: string) {
    setMunicipios(m => m.filter(x => x !== nombre))
  }

  async function guardarMunicipios() {
    await guardarConfig('municipios', municipios, setGuardandoMunis, setMensajeMunis)
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

  function copiarUrl() {
    if (!purificadoraId) return
    const url = `${window.location.origin}/pedido/${purificadoraId}`
    navigator.clipboard.writeText(url).then(() => {
      setUrlCopiada(true)
      setTimeout(() => setUrlCopiada(false), 2500)
    })
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 mb-1">Configuración</h1>
        <p className="text-sm text-gray-500">Ajustes generales del sistema</p>
      </div>

      {/* ── ENLACE DE PEDIDOS WEB ──────────────────────────────────────── */}
      {purificadoraId && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-semibold text-sky-800 mb-1">🔗 Enlace de pedidos en línea</h2>
          <p className="text-xs text-sky-600 mb-3">
            Comparte este enlace con tus clientes para que hagan pedidos sin WhatsApp.
          </p>
          <div className="bg-white rounded-xl border border-sky-200 px-4 py-3 font-mono text-xs text-gray-700 break-all mb-3">
            {typeof window !== 'undefined'
              ? `${window.location.origin}/pedido/${purificadoraId}`
              : `/pedido/${purificadoraId}`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={copiarUrl}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                urlCopiada
                  ? 'bg-green-500 text-white'
                  : 'bg-sky-500 hover:bg-sky-600 text-white'
              }`}
            >
              {urlCopiada ? '✅ Enlace copiado' : '📋 Copiar enlace'}
            </button>
            <a
              href={`/pedido/${purificadoraId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-sky-200 text-sky-600 hover:bg-sky-50 transition"
            >
              Abrir →
            </a>
          </div>
        </div>
      )}

      {/* ── LOGO ────────────────────────────────────────────────────────── */}
      {purificadoraId && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-1">🖼️ Logo de la purificadora</h2>
          <p className="text-sm text-gray-500 mb-4">
            Aparece en el panel admin, la app del repartidor y la página de pedidos.
          </p>

          <div className="flex items-center gap-4 mb-4">
            {logoUrl
              ? <img src={logoUrl} alt="Logo actual" className="h-16 w-16 rounded-xl object-cover border border-gray-200" />
              : <div className="h-16 w-16 rounded-xl bg-gray-100 flex items-center justify-center text-2xl">💧</div>
            }
            <div>
              <p className="text-xs text-gray-500 mb-2">
                {logoUrl ? 'Logo actual (JPG, PNG o WebP, máx. 2 MB)' : 'Sin logo — se muestra 💧 por defecto'}
              </p>
              <label className="cursor-pointer bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-4 py-2 rounded-xl inline-block transition">
                {subiendoLogo ? 'Subiendo...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={subirLogo}
                  disabled={subiendoLogo}
                />
              </label>
            </div>
          </div>

          {mensajeLogo && (
            <p className={`text-sm rounded-xl px-3 py-2 ${
              mensajeLogo.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
            }`}>{mensajeLogo}</p>
          )}
        </div>
      )}

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

        {/* Pegar URL de Google Maps */}
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Pegar URL de Google Maps
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://www.google.com/maps/@19.4326,-99.1332,13z"
              value={urlMaps}
              onChange={e => { setUrlMaps(e.target.value); setUrlError('') }}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
            <button
              onClick={() => extraerCoordsDeUrl(urlMaps)}
              disabled={!urlMaps.trim()}
              className="bg-sky-500 disabled:opacity-40 text-white text-xs font-semibold px-3 py-2 rounded-xl shrink-0"
            >
              Extraer
            </button>
          </div>
          {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
          <p className="text-xs text-gray-400 mt-1">Abre Google Maps, centra el mapa en tu zona y copia la URL del navegador</p>
        </div>

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

        <div className="mb-3">
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Ciudad / Estado <span className="text-gray-400 font-normal">(mejora la precisión del geocoding)</span>
          </label>
          <input
            type="text"
            placeholder="Ej: Guadalupe, Zacatecas"
            value={zona.ciudad ?? ''}
            onChange={e => setZona(z => ({ ...z, ciudad: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
          <p className="text-xs text-gray-400 mt-1">Se añade al buscar cada dirección para evitar confusiones con otras ciudades</p>
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

      {/* ── MUNICIPIOS / COLONIAS ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-1">🏘️ Municipios / Colonias de entrega</h2>
        <p className="text-sm text-gray-500 mb-4">
          El cliente verá un menú para elegir su colonia. Se combina con su calle para
          encontrar la dirección exacta sin necesitar GPS.
        </p>

        {/* Input agregar */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Ej: Col. Centro, Fracc. Las Flores…"
            value={nuevoMunicipio}
            onChange={e => setNuevoMunicipio(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregarMunicipio())}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
          <button
            onClick={agregarMunicipio}
            disabled={!nuevoMunicipio.trim()}
            className="bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shrink-0"
          >
            + Agregar
          </button>
        </div>

        {/* Lista */}
        {municipios.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4 border-2 border-dashed border-gray-100 rounded-xl mb-4">
            Sin municipios — el cliente escribirá su dirección completa
          </p>
        ) : (
          <ul className="space-y-2 mb-4">
            {municipios.map(m => (
              <li key={m} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                <span className="text-sm text-gray-700">📍 {m}</span>
                <button
                  onClick={() => quitarMunicipio(m)}
                  className="text-red-400 hover:text-red-600 text-xs font-medium"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        {mensajeMunis && (
          <p className={`text-sm rounded-xl px-3 py-2 mb-3 ${
            mensajeMunis.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
          }`}>{mensajeMunis}</p>
        )}

        <button
          onClick={guardarMunicipios}
          disabled={guardandoMunis}
          className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm"
        >
          {guardandoMunis ? 'Guardando...' : 'Guardar lista de municipios'}
        </button>
      </div>

      {/* ── HORARIO DE ATENCIÓN ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-1">🕐 Horario de atención</h2>
        <p className="text-sm text-gray-500 mb-4">
          Fuera de este horario no se aceptarán pedidos en línea ni por WhatsApp.
          Deja un día vacío si no hay servicio ese día.
        </p>

        <div className="space-y-2 mb-4">
          {ORDEN_DIAS.map(dia => {
            const h = horario[dia]
            return (
              <div key={dia} className="flex items-center gap-3">
                <div className="w-24 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`dia-${dia}`}
                    checked={!!h}
                    onChange={e => setHorario(prev => ({
                      ...prev,
                      [dia]: e.target.checked ? { inicio: '08:00', fin: '18:00' } : null,
                    }))}
                    className="accent-sky-500 w-4 h-4 shrink-0"
                  />
                  <label htmlFor={`dia-${dia}`} className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                    {NOMBRES_DIAS[dia]}
                  </label>
                </div>
                {h ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={h.inicio}
                      onChange={e => setHorario(prev => ({ ...prev, [dia]: { ...h, inicio: e.target.value } }))}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                    />
                    <span className="text-gray-400 text-sm">–</span>
                    <input
                      type="time"
                      value={h.fin}
                      onChange={e => setHorario(prev => ({ ...prev, [dia]: { ...h, fin: e.target.value } }))}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-gray-300 italic">Cerrado</span>
                )}
              </div>
            )
          })}
        </div>

        {mensajeHorario && (
          <p className={`text-sm rounded-xl px-3 py-2 mb-3 ${
            mensajeHorario.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
          }`}>{mensajeHorario}</p>
        )}

        <button
          onClick={guardarHorario}
          disabled={guardandoHorario}
          className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm"
        >
          {guardandoHorario ? 'Guardando...' : 'Guardar horario'}
        </button>
      </div>

      {/* Backfill colonia/municipio */}
      <BackfillGeo />
    </div>
  )
}

function BackfillGeo() {
  const supabase = useMemo(() => crearClienteBrowser(), [])
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'ok' | 'error'>('idle')
  const [msg,    setMsg]    = useState('')

  async function ejecutar() {
    setEstado('cargando')
    setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/backfill-geo', {
      method:  'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    const json = await res.json()
    if (!res.ok) { setEstado('error'); setMsg(json.error ?? 'Error'); return }
    setEstado('ok')
    setMsg(`✅ ${json.actualizados} de ${json.total} clientes actualizados`)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <div>
        <h2 className="text-base font-bold text-gray-800">Rellenar colonia y municipio</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Detecta colonia y municipio para todos los clientes que tienen GPS pero aún no tienen esos datos.
          Tarda ~1 segundo por cliente (límite Nominatim).
        </p>
      </div>
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
      <button
        onClick={ejecutar}
        disabled={estado === 'cargando'}
        className="w-full bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm"
      >
        {estado === 'cargando' ? 'Procesando clientes... (puede tardar)' : 'Ejecutar detección'}
      </button>
    </div>
  )
}
