'use client'

import { useState, useEffect, useCallback } from 'react'
import { use } from 'react'
import { distanciaKm } from '@/lib/distancia'

// ── Cookies (sin localStorage per restricción del proyecto) ───────────────
function leerCookie(nombre: string): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(nombre)}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : ''
}
function guardarCookie(nombre: string, valor: string) {
  const exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${encodeURIComponent(nombre)}=${encodeURIComponent(valor)};path=/;expires=${exp};SameSite=Lax`
}

// Normaliza a +52XXXXXXXXXX (mismo criterio que el panel admin)
function normalizarTelefono(tel: string): string {
  const limpio = tel.trim().replace(/\s/g, '')
  if (limpio.startsWith('+')) return limpio
  return '+52' + limpio.replace(/^52/, '')
}

// ── Tipos ──────────────────────────────────────────────────────────────────
type ZonaConfig = { lat: number; lng: number; radio_km: number } | null
type EstadoGPS  = 'idle' | 'obteniendo' | 'ok' | 'fuera' | 'error'
type PedidoOk   = { pedidoId: string; total: number; precio: number; cantidad: number; nombre: string }

// ── Componente ─────────────────────────────────────────────────────────────
export default function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: purificadoraId } = use(params)

  const [nombrePuri, setNombrePuri] = useState('')
  const [zona,       setZona]       = useState<ZonaConfig>(null)
  const [cargando,   setCargando]   = useState(true)
  const [noDisponible, setNoDisponible] = useState(false)

  // Campos del formulario
  const [nombre,    setNombre]    = useState('')
  const [telefono,  setTelefono]  = useState('')
  const [direccion, setDireccion] = useState('')
  const [cantidad,  setCantidad]  = useState(1)

  // GPS
  const [lat,       setLat]       = useState<number | null>(null)
  const [lng,       setLng]       = useState<number | null>(null)
  const [estadoGPS, setEstadoGPS] = useState<EstadoGPS>('idle')

  // Envío
  const [enviando, setEnviando] = useState(false)
  const [error,    setError]    = useState('')
  const [pedidoOk, setPedidoOk] = useState<PedidoOk | null>(null)

  // Cargar config de zona y recordar al usuario desde cookies
  useEffect(() => {
    setNombre(leerCookie('ped_nombre'))
    setTelefono(leerCookie('ped_telefono'))
    setDireccion(leerCookie('ped_direccion'))

    fetch(`/api/pedido/public?purificadoraId=${purificadoraId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setNoDisponible(true); return }
        setNombrePuri(d.nombre ?? '')
        if (d.zona) setZona(d.zona)
      })
      .catch(() => setNoDisponible(true))
      .finally(() => setCargando(false))
  }, [purificadoraId])

  // Obtener GPS y validar contra zona configurada
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

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (estadoGPS === 'fuera') {
      setError(`Tu ubicación está fuera de nuestra zona de entrega (${zona?.radio_km} km).`)
      return
    }

    setEnviando(true)
    try {
      const res = await fetch('/api/pedido/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purificadoraId,
          telefono:  normalizarTelefono(telefono),
          nombre:    nombre.trim(),
          direccion: direccion.trim(),
          cantidad,
          lat,
          lng,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al enviar el pedido. Intenta de nuevo.')
        return
      }
      guardarCookie('ped_nombre',    nombre.trim())
      guardarCookie('ped_telefono',  telefono)
      guardarCookie('ped_direccion', direccion.trim())
      setPedidoOk({ ...data, cantidad, nombre: nombre.trim() })
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  // ── Pantalla de carga ────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center">
        <p className="text-sky-400 text-sm">Cargando…</p>
      </div>
    )
  }

  // ── Purificadora no encontrada o inactiva ────────────────────────────────
  if (noDisponible) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">😕</div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">Servicio no disponible</h1>
          <p className="text-gray-500 text-sm">
            Este enlace no está activo. Contacta a tu purificadora para obtener el enlace correcto.
          </p>
        </div>
      </div>
    )
  }

  // ── Pantalla de éxito ────────────────────────────────────────────────────
  if (pedidoOk) {
    return (
      <div className="min-h-screen bg-sky-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">¡Pedido recibido!</h1>
          {nombrePuri && (
            <p className="text-xs text-sky-500 font-medium mb-1">{nombrePuri}</p>
          )}
          <p className="text-gray-500 text-sm mb-5">
            Gracias, <strong>{pedidoOk.nombre}</strong>.{' '}
            Te avisaremos cuando el repartidor esté en camino.
          </p>
          <div className="bg-sky-50 rounded-xl p-4 text-left text-sm space-y-1 mb-6">
            <p className="text-gray-600">
              🫙 {pedidoOk.cantidad} garrafón{pedidoOk.cantidad > 1 ? 'es' : ''} × ${pedidoOk.precio}
            </p>
            <p className="font-semibold text-gray-800">Total: ${pedidoOk.total}</p>
          </div>
          <button
            onClick={() => { setPedidoOk(null); setEstadoGPS('idle'); setLat(null); setLng(null) }}
            className="w-full py-3 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition"
          >
            Hacer otro pedido
          </button>
        </div>
      </div>
    )
  }

  // ── Formulario ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-sky-50 py-8 px-4">
      <div className="max-w-sm mx-auto">

        <div className="text-center mb-6">
          <div className="text-4xl mb-2">💧</div>
          <h1 className="text-2xl font-bold text-gray-800">Pedir agua</h1>
          {nombrePuri && (
            <p className="text-sky-500 text-sm font-medium mt-1">{nombrePuri}</p>
          )}
          <p className="text-gray-400 text-xs mt-0.5">Entrega a domicilio</p>
        </div>

        <form onSubmit={enviar} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Juan Pérez"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="55 1234 5678"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
            <p className="text-xs text-gray-400 mt-1">10 dígitos sin código de país</p>
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección de entrega</label>
            <textarea
              value={direccion}
              onChange={e => setDireccion(e.target.value)}
              placeholder="Calle, número, colonia"
              required
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
            />
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad de garrafones</label>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setCantidad(c => Math.max(1, c - 1))}
                className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 text-xl font-bold hover:bg-gray-200 transition flex items-center justify-center">
                −
              </button>
              <span className="text-2xl font-bold text-sky-600 w-8 text-center">{cantidad}</span>
              <button type="button" onClick={() => setCantidad(c => Math.min(10, c + 1))}
                className="w-10 h-10 rounded-full bg-sky-100 text-sky-600 text-xl font-bold hover:bg-sky-200 transition flex items-center justify-center">
                +
              </button>
              <span className="text-sm text-gray-500">garrafón{cantidad > 1 ? 'es' : ''} 20 L</span>
            </div>
          </div>

          {/* GPS */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ubicación actual{' '}
              <span className="text-gray-400 font-normal">(opcional, mejora la entrega)</span>
            </label>
            <button
              type="button"
              onClick={obtenerUbicacion}
              disabled={estadoGPS === 'obteniendo'}
              className={`w-full py-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 ${
                estadoGPS === 'ok'    ? 'bg-green-50 text-green-700 border border-green-200' :
                estadoGPS === 'fuera' ? 'bg-red-50 text-red-600 border border-red-200' :
                estadoGPS === 'error' ? 'bg-gray-50 text-gray-500 border border-gray-200' :
                'bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100'
              }`}
            >
              {estadoGPS === 'idle'       && <><span>📍</span> Compartir mi ubicación</>}
              {estadoGPS === 'obteniendo' && <><span>⏳</span> Obteniendo ubicación…</>}
              {estadoGPS === 'ok'         && <><span>✅</span> Ubicación dentro de la zona</>}
              {estadoGPS === 'fuera'      && <><span>❌</span> Fuera de zona de entrega</>}
              {estadoGPS === 'error'      && <><span>⚠️</span> No se pudo obtener ubicación</>}
            </button>
            {estadoGPS === 'fuera' && zona && (
              <p className="text-xs text-red-500 mt-1">
                Tu ubicación está a más de {zona.radio_km} km de la zona de entrega.
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={enviando || estadoGPS === 'fuera'}
            className="w-full py-3.5 rounded-xl bg-sky-500 text-white font-semibold text-sm hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {enviando ? 'Enviando pedido…' : `🫙 Pedir ${cantidad} garrafón${cantidad > 1 ? 'es' : ''}`}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Tus datos se guardan en este dispositivo para futuros pedidos.
        </p>
      </div>
    </div>
  )
}
