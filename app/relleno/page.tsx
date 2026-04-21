'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type Turno = {
  id:            string
  fecha:         string
  estado:        'abierto' | 'cerrado'
  stock_inicial: number
  operador_id:   string
}

type Repartidor = { id: string; nombre: string }

type Movimiento = {
  id:            string
  tipo:          'entrega_inicial' | 'entrega_repartidor' | 'recepcion_vacio' | 'relleno' | 'merma'
  cantidad:      number
  nota:          string | null
  created_at:    string
  repartidor_id: string | null
  repartidores:  { nombre: string } | null
}

type Pedido = {
  id:          string
  estado:      'pendiente' | 'en_ruta'
  cantidad:    number
  total:       number | null
  notas:       string | null
  origen:      string | null
  created_at:  string
  clientes:    { nombre: string; telefono: string; direccion: string } | null
  repartidores: { nombre: string } | null
}

type ModalMovimiento = {
  tipo:          Movimiento['tipo']
  label:         string
  conRepartidor: boolean
} | null

type ModalPedido = {
  pedido:       Pedido
  repartidorId: string
} | null

const ETIQUETAS: Record<Movimiento['tipo'], string> = {
  entrega_inicial:    'Entrega inicial',
  entrega_repartidor: 'Entrega a repartidor',
  recepcion_vacio:    'Recepción de vacíos',
  relleno:            'Garrafones rellenados',
  merma:              'Merma / baja',
}

const ORIGEN_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  manual:   'Manual',
  admin:    'Admin',
  web:      'Web',
}

function deltaStock(tipo: Movimiento['tipo'], cantidad: number): number {
  switch (tipo) {
    case 'entrega_inicial':    return cantidad
    case 'relleno':            return cantidad
    case 'entrega_repartidor': return -cantidad
    case 'recepcion_vacio':    return 0
    case 'merma':              return -cantidad
  }
}

export default function RellenoPage() {
  const supabase = useMemo(() => crearClienteBrowser(), [])

  const [turno,        setTurno]        = useState<Turno | null>(null)
  const [operadorId,   setOperadorId]   = useState<string>('')
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [movimientos,  setMovimientos]  = useState<Movimiento[]>([])
  const [pedidos,      setPedidos]      = useState<Pedido[]>([])
  const [cargando,     setCargando]     = useState(true)

  const [stockInicial, setStockInicial] = useState('')
  const [abriendo,     setAbriendo]     = useState(false)

  const [modalMov,       setModalMov]       = useState<ModalMovimiento>(null)
  const [modalCantidad,  setModalCantidad]  = useState('')
  const [modalRepId,     setModalRepId]     = useState('')
  const [modalNota,      setModalNota]      = useState('')
  const [guardando,      setGuardando]      = useState(false)
  const [error,          setError]          = useState('')

  const [modalPedido,    setModalPedido]    = useState<ModalPedido>(null)
  const [asignando,      setAsignando]      = useState(false)

  const [cerrando,       setCerrando]       = useState(false)
  const [confirmCierre,  setConfirmCierre]  = useState(false)

  // Vista activa: 'stock' | 'pedidos'
  const [vista,          setVista]          = useState<'stock' | 'pedidos'>('stock')

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }

  const cargarPedidos = useCallback(async (token?: string) => {
    const t = token ?? await getToken()
    const res = await fetch('/api/relleno/pedido', {
      headers: { Authorization: `Bearer ${t}` },
    })
    if (res.ok) setPedidos(await res.json())
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const cargarMovimientos = useCallback(async (turnoId: string, token?: string) => {
    const t = token ?? await getToken()
    const res = await fetch(`/api/relleno/movimiento?turno_id=${turnoId}`, {
      headers: { Authorization: `Bearer ${t}` },
    })
    if (res.ok) setMovimientos(await res.json())
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const cargarTurno = useCallback(async () => {
    const token = await getToken()
    const res = await fetch('/api/relleno/turno', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const json = await res.json()
    setTurno(json.turno)
    setOperadorId(json.operadorId)
    setRepartidores(json.repartidores)
    setCargando(false)
    if (json.turno) await cargarMovimientos(json.turno.id, token)
    await cargarPedidos(token)
  }, [cargarMovimientos, cargarPedidos]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargarTurno() }, [cargarTurno])

  // Suscripción realtime a pedidos nuevos
  useEffect(() => {
    const canal = supabase
      .channel('relleno-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarPedidos()
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [supabase, cargarPedidos])

  const stockDisponible = useMemo(() => {
    const base = turno?.stock_inicial ?? 0
    return movimientos.reduce((acc, m) => acc + deltaStock(m.tipo, m.cantidad), base)
  }, [movimientos, turno])

  const balancesRep = useMemo(() => {
    const map: Record<string, { nombre: string; entregados: number; vacios: number }> = {}
    for (const m of movimientos) {
      if (!m.repartidor_id || !m.repartidores) continue
      if (m.tipo !== 'entrega_repartidor' && m.tipo !== 'recepcion_vacio') continue
      if (!map[m.repartidor_id]) map[m.repartidor_id] = { nombre: m.repartidores.nombre, entregados: 0, vacios: 0 }
      if (m.tipo === 'entrega_repartidor') map[m.repartidor_id].entregados += m.cantidad
      if (m.tipo === 'recepcion_vacio')    map[m.repartidor_id].vacios    += m.cantidad
    }
    return Object.values(map)
  }, [movimientos])

  const totales = useMemo(() => ({
    rellenados: movimientos.filter(m => m.tipo === 'relleno').reduce((s, m) => s + m.cantidad, 0),
    entregados: movimientos.filter(m => m.tipo === 'entrega_repartidor').reduce((s, m) => s + m.cantidad, 0),
    vacios:     movimientos.filter(m => m.tipo === 'recepcion_vacio').reduce((s, m) => s + m.cantidad, 0),
    mermas:     movimientos.filter(m => m.tipo === 'merma').reduce((s, m) => s + m.cantidad, 0),
  }), [movimientos])

  const pedidosPendientes = pedidos.filter(p => p.estado === 'pendiente')
  const pedidosEnRuta     = pedidos.filter(p => p.estado === 'en_ruta')

  async function abrirTurno() {
    const n = parseInt(stockInicial)
    if (isNaN(n) || n < 0) { setError('Ingresa una cantidad válida'); return }
    setAbriendo(true); setError('')
    const token = await getToken()
    const res = await fetch('/api/relleno/turno', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ operadorId, stockInicial: n }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setAbriendo(false); return }
    setTurno(json.turno)
    setMovimientos([])
    setAbriendo(false)
  }

  async function registrarMovimiento() {
    if (!modalMov || !turno) return
    const cant = parseInt(modalCantidad)
    if (isNaN(cant) || cant <= 0) { setError('Cantidad inválida'); return }
    if (modalMov.conRepartidor && !modalRepId) { setError('Selecciona un repartidor'); return }
    setGuardando(true); setError('')
    const token = await getToken()
    const res = await fetch('/api/relleno/movimiento', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({
        turnoId:      turno.id,
        tipo:         modalMov.tipo,
        cantidad:     cant,
        repartidorId: modalMov.conRepartidor ? modalRepId : null,
        nota:         modalNota || null,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setGuardando(false); return }
    setMovimientos(prev => [json, ...prev])
    cerrarModalMov()
    setGuardando(false)
  }

  async function asignarPedido() {
    if (!modalPedido?.repartidorId) { setError('Selecciona un repartidor'); return }
    setAsignando(true); setError('')
    const token = await getToken()
    const res = await fetch('/api/relleno/pedido', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ pedidoId: modalPedido.pedido.id, repartidorId: modalPedido.repartidorId }),
    })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error)
      setAsignando(false)
      return
    }
    await cargarPedidos()
    setModalPedido(null)
    setAsignando(false)
  }

  async function cancelarPedido(pedidoId: string) {
    const token = await getToken()
    await fetch('/api/relleno/pedido', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ pedidoId, accion: 'cancelar' }),
    })
    await cargarPedidos()
  }

  function abrirModalMov(tipo: Movimiento['tipo'], label: string, conRepartidor = false) {
    setModalMov({ tipo, label, conRepartidor })
    setModalCantidad('')
    setModalRepId(repartidores[0]?.id ?? '')
    setModalNota('')
    setError('')
  }

  function cerrarModalMov() { setModalMov(null); setError('') }

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-sky-50">
        <p className="text-gray-400 text-sm">Cargando...</p>
      </div>
    )
  }

  // ── Sin turno abierto ───────────────────────────────────────────────────
  if (!turno) {
    return (
      <div className="min-h-screen bg-sky-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 w-full max-w-sm space-y-5">
          <div className="text-center">
            <div className="text-5xl mb-3">💧</div>
            <h1 className="text-xl font-bold text-gray-800">Rellenadora</h1>
            <p className="text-sm text-gray-400 mt-1">Abre el turno para comenzar el día</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Garrafones llenos al inicio del turno
            </label>
            <input
              type="number" min="0" value={stockInicial}
              onChange={e => setStockInicial(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button onClick={abrirTurno} disabled={abriendo}
            className="w-full bg-sky-500 disabled:opacity-50 text-white py-3 rounded-2xl font-bold text-base">
            {abriendo ? 'Abriendo...' : 'Abrir turno'}
          </button>
        </div>
      </div>
    )
  }

  const turnoCerrado = turno.estado === 'cerrado'

  // ── Turno activo ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-sky-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💧</span>
            <div>
              <p className="text-sm font-bold text-gray-800">Rellenadora</p>
              <p className="text-xs text-gray-400">{turno.fecha}</p>
            </div>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            turnoCerrado ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
          }`}>
            {turnoCerrado ? 'Turno cerrado' : 'Turno abierto'}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex mt-2 gap-1">
          <button
            onClick={() => setVista('stock')}
            className={`flex-1 py-2 text-sm font-medium rounded-xl transition ${
              vista === 'stock' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Stock
          </button>
          <button
            onClick={() => setVista('pedidos')}
            className={`flex-1 py-2 text-sm font-medium rounded-xl transition relative ${
              vista === 'pedidos' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Pedidos
            {pedidosPendientes.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {pedidosPendientes.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* ── Vista Stock ── */}
        {vista === 'stock' && (
          <>
            {/* Stock disponible */}
            <div className={`rounded-3xl p-6 text-center shadow-sm ${
              stockDisponible <= 5 ? 'bg-red-500' : 'bg-sky-500'
            }`}>
              <p className="text-white/80 text-sm font-medium">Garrafones llenos disponibles</p>
              <p className="text-white font-black text-7xl leading-none mt-1">{stockDisponible}</p>
              {stockDisponible <= 5 && (
                <p className="text-white/90 text-xs mt-2 font-medium">⚠️ Stock bajo — rellenar pronto</p>
              )}
            </div>

            {/* Resumen del día */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Rellenados', value: totales.rellenados, color: 'text-sky-600'    },
                { label: 'Entregados', value: totales.entregados, color: 'text-orange-500' },
                { label: 'Vacíos rec.',value: totales.vacios,     color: 'text-green-600'  },
                { label: 'Mermas',     value: totales.mermas,     color: 'text-red-500'    },
              ].map(item => (
                <div key={item.label}>
                  <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-gray-400 leading-tight">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Balance por repartidor */}
            {balancesRep.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Balance por repartidor</h2>
                {balancesRep.map(b => (
                  <div key={b.nombre} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{b.nombre}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-orange-500">↑ {b.entregados}</span>
                      <span className="text-green-600">↓ {b.vacios}</span>
                      <span className={`font-bold ${(b.entregados - b.vacios) > 0 ? 'text-gray-800' : 'text-green-700'}`}>
                        = {b.entregados - b.vacios}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Botones de acción */}
            {!turnoCerrado && (
              <div className="space-y-2">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1">Registrar movimiento</h2>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => abrirModalMov('entrega_repartidor', 'Entregar llenos a repartidor', true)}
                    className="bg-orange-500 text-white rounded-2xl py-4 font-bold text-sm shadow-sm">
                    🚚 Entregar a repartidor
                  </button>
                  <button onClick={() => abrirModalMov('recepcion_vacio', 'Recibir vacíos de repartidor', true)}
                    className="bg-green-500 text-white rounded-2xl py-4 font-bold text-sm shadow-sm">
                    ♻️ Recibir vacíos
                  </button>
                  <button onClick={() => abrirModalMov('relleno', 'Garrafones rellenados')}
                    className="bg-sky-500 text-white rounded-2xl py-4 font-bold text-sm shadow-sm">
                    💧 Registrar relleno
                  </button>
                  <button onClick={() => abrirModalMov('merma', 'Registrar merma o baja')}
                    className="bg-red-400 text-white rounded-2xl py-4 font-bold text-sm shadow-sm">
                    ⚠️ Merma / baja
                  </button>
                </div>
              </div>
            )}

            {/* Log de movimientos */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Movimientos del día</h2>
              </div>
              {movimientos.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Sin movimientos aún</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {movimientos.map(m => (
                    <div key={m.id} className="px-4 py-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{ETIQUETAS[m.tipo]}</p>
                        {m.repartidores && <p className="text-xs text-gray-400">{m.repartidores.nombre}</p>}
                        {m.nota && <p className="text-xs text-gray-400 italic">{m.nota}</p>}
                        <p className="text-xs text-gray-300">
                          {new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={`shrink-0 text-lg font-black ${
                        deltaStock(m.tipo, m.cantidad) >= 0 ? 'text-sky-600' : 'text-red-500'
                      }`}>
                        {deltaStock(m.tipo, m.cantidad) >= 0 ? '+' : ''}{deltaStock(m.tipo, m.cantidad) || m.cantidad}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cerrar día */}
            {!turnoCerrado && (
              <div className="pb-6">
                {!confirmCierre ? (
                  <button onClick={() => setConfirmCierre(true)}
                    className="w-full border-2 border-gray-200 text-gray-500 rounded-2xl py-3 font-medium text-sm">
                    Cerrar día
                  </button>
                ) : (
                  <div className="bg-gray-800 rounded-2xl p-5 space-y-3 text-center">
                    <p className="text-white font-bold">¿Cerrar el turno de hoy?</p>
                    <p className="text-gray-300 text-sm">
                      Rellenados: {totales.rellenados} · Entregados: {totales.entregados} · Mermas: {totales.mermas}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmCierre(false)}
                        className="flex-1 bg-gray-600 text-white rounded-xl py-2.5 text-sm font-medium">
                        Cancelar
                      </button>
                      <button onClick={async () => {
                        setCerrando(true)
                        const token = await getToken()
                        const res = await fetch('/api/relleno/turno', {
                          method:  'PATCH',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body:    JSON.stringify({ turnoId: turno.id }),
                        })
                        if (res.ok) setTurno(prev => prev ? { ...prev, estado: 'cerrado' } : prev)
                        setConfirmCierre(false)
                        setCerrando(false)
                      }} disabled={cerrando}
                        className="flex-1 bg-sky-500 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-bold">
                        {cerrando ? 'Cerrando...' : 'Confirmar cierre'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Vista Pedidos ── */}
        {vista === 'pedidos' && (
          <div className="space-y-4 pb-6">
            {/* Pendientes */}
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1 mb-2">
                Por asignar ({pedidosPendientes.length})
              </h2>
              {pedidosPendientes.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
                  <p className="text-gray-400 text-sm">Sin pedidos pendientes</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pedidosPendientes.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl border-l-4 border-l-yellow-400 border border-gray-100 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-800">
                              {p.clientes?.nombre ?? 'Cliente'}
                            </span>
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                              {p.origen ? (ORIGEN_LABEL[p.origen] ?? p.origen) : 'WhatsApp'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{p.clientes?.direccion}</p>
                          <p className="text-xs text-gray-400">{p.clientes?.telefono}</p>
                          {p.notas && <p className="text-xs text-gray-400 italic mt-0.5">{p.notas}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xl font-black text-sky-600">{p.cantidad}</p>
                          <p className="text-xs text-gray-400">garrafones</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setModalPedido({ pedido: p, repartidorId: repartidores[0]?.id ?? '' })}
                          className="flex-1 bg-sky-500 text-white rounded-xl py-2 text-sm font-bold"
                        >
                          Asignar repartidor
                        </button>
                        <button
                          onClick={() => cancelarPedido(p.id)}
                          className="px-3 bg-red-50 text-red-400 rounded-xl text-sm font-medium"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* En ruta */}
            {pedidosEnRuta.length > 0 && (
              <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1 mb-2">
                  En ruta ({pedidosEnRuta.length})
                </h2>
                <div className="space-y-2">
                  {pedidosEnRuta.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl border-l-4 border-l-blue-400 border border-gray-100 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-gray-800">{p.clientes?.nombre ?? 'Cliente'}</span>
                          <p className="text-xs text-gray-500 truncate">{p.clientes?.direccion}</p>
                          {p.repartidores && (
                            <p className="text-xs text-blue-500 mt-0.5">🚚 {p.repartidores.nombre}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xl font-black text-blue-500">{p.cantidad}</p>
                          <p className="text-xs text-gray-400">garrafones</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal: registrar movimiento */}
      {modalMov && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-800">{modalMov.label}</h2>
            {modalMov.conRepartidor && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Repartidor</label>
                <select value={modalRepId} onChange={e => setModalRepId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
                  <option value="">-- Selecciona --</option>
                  {repartidores.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
              <input type="number" min="1" value={modalCantidad}
                onChange={e => setModalCantidad(e.target.value)} placeholder="0" autoFocus
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-center text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nota (opcional)</label>
              <input type="text" value={modalNota} onChange={e => setModalNota(e.target.value)}
                placeholder="Ej: garrafón roto en ruta"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={cerrarModalMov}
                className="flex-1 border border-gray-200 text-gray-500 rounded-2xl py-3 text-sm font-medium">
                Cancelar
              </button>
              <button onClick={registrarMovimiento} disabled={guardando}
                className="flex-1 bg-sky-500 disabled:opacity-50 text-white rounded-2xl py-3 font-bold text-sm">
                {guardando ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: asignar pedido */}
      {modalPedido && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-800">Asignar pedido</h2>
              <p className="text-sm text-gray-500 mt-1">
                {modalPedido.pedido.clientes?.nombre} — {modalPedido.pedido.cantidad} garrafón{modalPedido.pedido.cantidad > 1 ? 'es' : ''}
              </p>
              <p className="text-xs text-gray-400 truncate">{modalPedido.pedido.clientes?.direccion}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Repartidor</label>
              <select
                value={modalPedido.repartidorId}
                onChange={e => setModalPedido(prev => prev ? { ...prev, repartidorId: e.target.value } : prev)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="">-- Selecciona --</option>
                {repartidores.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setModalPedido(null); setError('') }}
                className="flex-1 border border-gray-200 text-gray-500 rounded-2xl py-3 text-sm font-medium">
                Cancelar
              </button>
              <button onClick={asignarPedido} disabled={asignando}
                className="flex-1 bg-sky-500 disabled:opacity-50 text-white rounded-2xl py-3 font-bold text-sm">
                {asignando ? 'Asignando...' : 'Enviar a ruta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
