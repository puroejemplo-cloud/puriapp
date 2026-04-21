'use client'

import { useState, useEffect, useCallback } from 'react'
import { use } from 'react'
import { distanciaKm } from '@/lib/distancia'

// ── Cookies ───────────────────────────────────────────────────────────────
function leerCookie(n: string): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(n)}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : ''
}
function guardarCookie(n: string, v: string) {
  const exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${encodeURIComponent(n)}=${encodeURIComponent(v)};path=/;expires=${exp};SameSite=Lax`
}
function normalizarTelefono(tel: string): string {
  const limpio = tel.trim().replace(/\s/g, '')
  if (limpio.startsWith('+')) return limpio
  return '+52' + limpio.replace(/^52/, '')
}

// ── Tipos ──────────────────────────────────────────────────────────────────
type ZonaConfig   = { lat: number; lng: number; radio_km: number } | null
type EstadoGPS    = 'idle' | 'obteniendo' | 'ok' | 'fuera' | 'error'
type HorarioHoy   = { inicio: string; fin: string } | null
type PedidoOk     = { pedidoId: string; total: number; precio: number; cantidad: number; nombre: string }

// ── Componente ─────────────────────────────────────────────────────────────
export default function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: purificadoraId } = use(params)

  const [nombrePuri,   setNombrePuri]   = useState('')
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null)
  const [zona,         setZona]         = useState<ZonaConfig>(null)
  const [municipios,   setMunicipios]   = useState<string[]>([])
  const [cargando,     setCargando]     = useState(true)
  const [noDisponible, setNoDisponible] = useState(false)
  const [abierto,      setAbierto]      = useState(true)
  const [horarioHoy,   setHorarioHoy]   = useState<HorarioHoy>(null)

  // Formulario
  const [nombre,      setNombre]      = useState('')
  const [telefono,    setTelefono]    = useState('')
  const [direccion,   setDireccion]   = useState('')
  const [municipio,   setMunicipio]   = useState('')
  const [referencias, setReferencias] = useState('')
  const [cantidad,    setCantidad]    = useState(1)

  // GPS
  const [lat,       setLat]       = useState<number | null>(null)
  const [lng,       setLng]       = useState<number | null>(null)
  const [estadoGPS, setEstadoGPS] = useState<EstadoGPS>('idle')

  // Envío
  const [enviando,       setEnviando]       = useState(false)
  const [error,          setError]          = useState('')
  const [pedidoOk,       setPedidoOk]       = useState<PedidoOk | null>(null)
  const [modalUbicacion, setModalUbicacion] = useState(false)

  useEffect(() => {
    setNombre(leerCookie('ped_nombre'))
    setTelefono(leerCookie('ped_telefono'))
    setDireccion(leerCookie('ped_direccion'))
    setReferencias(leerCookie('ped_referencias'))

    fetch(`/api/pedido/public?purificadoraId=${purificadoraId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setNoDisponible(true); return }
        setNombrePuri(d.nombre ?? '')
        setLogoUrl(d.logoUrl ?? null)
        if (d.zona)               setZona(d.zona)
        if (d.municipios?.length) setMunicipios(d.municipios)
        setAbierto(d.abierto !== false)
        setHorarioHoy(d.horarioHoy ?? null)
      })
      .catch(() => setNoDisponible(true))
      .finally(() => setCargando(false))
  }, [purificadoraId])

  const obtenerUbicacion = useCallback(() => {
    if (!navigator.geolocation) { setEstadoGPS('error'); return }
    setEstadoGPS('obteniendo')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        setLat(latitude); setLng(longitude)
        if (zona?.lat && zona?.lng) {
          const dist = distanciaKm(latitude, longitude, zona.lat, zona.lng)
          setEstadoGPS(dist <= zona.radio_km ? 'ok' : 'fuera')
        } else {
          setEstadoGPS('ok')
        }
      },
      () => setEstadoGPS('error'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [zona])

  // Lógica de envío separada para poder reutilizarla desde el modal
  async function realizarPedido(coordLat: number | null, coordLng: number | null) {
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/pedido/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purificadoraId,
          telefono:    normalizarTelefono(telefono),
          nombre:      nombre.trim(),
          direccion:   direccion.trim(),
          municipio:   municipio || null,
          referencias: referencias.trim() || null,
          cantidad,
          lat:         coordLat,
          lng:         coordLng,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al enviar el pedido.'); return }
      guardarCookie('ped_nombre',      nombre.trim())
      guardarCookie('ped_telefono',    telefono)
      guardarCookie('ped_direccion',   direccion.trim())
      guardarCookie('ped_referencias', referencias.trim())
      setPedidoOk({ ...data, cantidad, nombre: nombre.trim() })
    } catch {
      setError('Error de conexión. Verifica tu internet.')
    } finally {
      setEnviando(false)
    }
  }

  // "Sí, compartir" → pide GPS y luego envía
  async function compartirYPedir() {
    setModalUbicacion(false)
    if (!navigator.geolocation) { await realizarPedido(null, null); return }
    setEstadoGPS('obteniendo')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        setLat(latitude); setLng(longitude)
        if (zona?.lat && zona?.lng) {
          const dist = distanciaKm(latitude, longitude, zona.lat, zona.lng)
          if (dist > zona.radio_km) {
            setEstadoGPS('fuera')
            setError(`Tu ubicación está fuera de la zona de entrega (${zona.radio_km} km).`)
            return
          }
          setEstadoGPS('ok')
        } else {
          setEstadoGPS('ok')
        }
        await realizarPedido(latitude, longitude)
      },
      async () => {
        setEstadoGPS('error')
        await realizarPedido(null, null) // Falla el GPS → continuar igual
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (estadoGPS === 'fuera') {
      setError(`Tu ubicación está fuera de la zona de entrega (${zona?.radio_km} km).`)
      return
    }
    // Si no intentó GPS todavía, preguntar antes de enviar
    if (estadoGPS === 'idle') { setModalUbicacion(true); return }
    await realizarPedido(lat, lng)
  }

  // ── Carga ────────────────────────────────────────────────────────────────
  if (cargando) return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center">
      <p className="text-sky-400 text-sm">Cargando…</p>
    </div>
  )

  if (noDisponible) return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">😕</div>
        <h1 className="text-lg font-bold text-gray-800 mb-2">Servicio no disponible</h1>
        <p className="text-gray-500 text-sm">Este enlace no está activo. Contacta a tu purificadora.</p>
      </div>
    </div>
  )

  // ── Éxito ────────────────────────────────────────────────────────────────
  if (pedidoOk) return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">¡Pedido recibido!</h1>
        {nombrePuri && <p className="text-xs text-sky-500 font-medium mb-1">{nombrePuri}</p>}
        <p className="text-gray-500 text-sm mb-5">
          Gracias, <strong>{pedidoOk.nombre}</strong>. Te avisaremos cuando el repartidor esté en camino.
        </p>
        <div className="bg-sky-50 rounded-xl p-4 text-left text-sm space-y-1 mb-4">
          <p className="text-gray-600">🫙 {pedidoOk.cantidad} garrafón{pedidoOk.cantidad > 1 ? 'es' : ''} × ${pedidoOk.precio}</p>
          <p className="font-semibold text-gray-800">Total: ${pedidoOk.total}</p>
        </div>
        <a
          href={`/seguimiento/${pedidoOk.pedidoId}`}
          className="block w-full py-3 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition mb-3"
        >
          📍 Ver estado de mi pedido
        </a>
        <button
          onClick={() => { setPedidoOk(null); setEstadoGPS('idle'); setLat(null); setLng(null) }}
          className="w-full py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition"
        >
          Hacer otro pedido
        </button>
      </div>
    </div>
  )

  // ── Formulario ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-sky-50 py-8 px-4">
      <div className="max-w-sm mx-auto">

        {/* Encabezado con logo y nombre */}
        <div className="text-center mb-6">
          {logoUrl
            ? <img src={logoUrl} alt={nombrePuri} className="h-16 w-16 rounded-2xl object-cover mx-auto mb-3 shadow-sm" />
            : <div className="text-4xl mb-2">💧</div>
          }
          <h1 className="text-2xl font-bold text-gray-800">
            {nombrePuri || 'Pedir agua'}
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">Entrega a domicilio</p>
        </div>

        {/* Banner cerrado */}
        {!abierto && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center mb-2">
            <p className="text-amber-800 font-semibold text-sm">⏰ Estamos cerrados en este momento</p>
            {horarioHoy
              ? <p className="text-amber-600 text-xs mt-1">Horario de hoy: {horarioHoy.inicio}–{horarioHoy.fin}</p>
              : <p className="text-amber-600 text-xs mt-1">Hoy no tenemos servicio. Vuelve mañana.</p>
            }
          </div>
        )}

        <form onSubmit={enviar} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Juan Pérez" required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de teléfono</label>
            <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
              placeholder="55 1234 5678" required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
            <p className="text-xs text-gray-400 mt-1">10 dígitos sin código de país</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección de entrega</label>
            <textarea value={direccion} onChange={e => setDireccion(e.target.value)}
              placeholder="Calle, número" required rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referencias <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input type="text" value={referencias} onChange={e => setReferencias(e.target.value)}
              placeholder="Ej: 2do piso, portón azul, junto a la farmacia"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
          </div>

          {municipios.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Colonia / Municipio</label>
              <select value={municipio} onChange={e => setMunicipio(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white">
                <option value="">Selecciona tu colonia…</option>
                {municipios.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad de garrafones</label>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setCantidad(c => Math.max(1, c - 1))}
                className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 text-xl font-bold hover:bg-gray-200 transition flex items-center justify-center">−</button>
              <span className="text-2xl font-bold text-sky-600 w-8 text-center">{cantidad}</span>
              <button type="button" onClick={() => setCantidad(c => Math.min(10, c + 1))}
                className="w-10 h-10 rounded-full bg-sky-100 text-sky-600 text-xl font-bold hover:bg-sky-200 transition flex items-center justify-center">+</button>
              <span className="text-sm text-gray-500">garrafón{cantidad > 1 ? 'es' : ''} 20 L</span>
            </div>
          </div>

          {/* Botón GPS (solo si ya intentó compartir o no) */}
          {estadoGPS !== 'idle' && (
            <div>
              <button type="button" onClick={obtenerUbicacion} disabled={estadoGPS === 'obteniendo'}
                className={`w-full py-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 ${
                  estadoGPS === 'ok'    ? 'bg-green-50 text-green-700 border border-green-200' :
                  estadoGPS === 'fuera' ? 'bg-red-50 text-red-600 border border-red-200' :
                  'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>
                {estadoGPS === 'obteniendo' && <><span>⏳</span> Obteniendo ubicación…</>}
                {estadoGPS === 'ok'         && <><span>✅</span> Ubicación dentro de la zona</>}
                {estadoGPS === 'fuera'      && <><span>❌</span> Fuera de zona — toca para reintentar</>}
                {estadoGPS === 'error'      && <><span>⚠️</span> Sin ubicación — toca para reintentar</>}
              </button>
              {estadoGPS === 'fuera' && zona && (
                <p className="text-xs text-red-500 mt-1">Tu ubicación está a más de {zona.radio_km} km.</p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button type="submit" disabled={enviando || estadoGPS === 'fuera' || !abierto}
            className="w-full py-3.5 rounded-xl bg-sky-500 text-white font-semibold text-sm hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {enviando ? 'Enviando pedido…' : !abierto ? '⏰ Cerrado por ahora' : `🫙 Pedir ${cantidad} garrafón${cantidad > 1 ? 'es' : ''}`}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Tus datos se guardan en este dispositivo para futuros pedidos.
        </p>
      </div>

      {/* ── Modal confirmación de ubicación ─────────────────────────────── */}
      {modalUbicacion && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="text-3xl text-center mb-3">📍</div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-2">
              ¿Compartir tu dirección?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Nos ayuda a encontrarte más rápido y confirmar que estás dentro de nuestra zona de entrega.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={compartirYPedir}
                className="w-full py-3 rounded-xl bg-sky-500 text-white font-semibold text-sm hover:bg-sky-600 transition"
              >
                Sí, compartir mi ubicación
              </button>
              <button
                onClick={() => { setModalUbicacion(false); realizarPedido(null, null) }}
                className="w-full py-3 rounded-xl bg-gray-100 text-gray-600 font-medium text-sm hover:bg-gray-200 transition"
              >
                No, continuar sin ubicación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
