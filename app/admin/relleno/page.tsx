'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type Operador = {
  id:      string
  nombre:  string
  activo:  boolean
  user_id: string | null
  email?:  string | null
}

type Credenciales = { email: string; password: string }

type TurnoResumen = {
  id:            string
  fecha:         string
  estado:        string
  stock_inicial: number
  operador_id:   string
  rellenados:    number
  entregados:    number
  vacios:        number
  mermas:        number
  stock_final:   number
}

export default function AdminRellenoPage() {
  const supabase = useMemo(() => crearClienteBrowser(), [])

  const [operadores,     setOperadores]     = useState<Operador[]>([])
  const [credenciales,   setCredenciales]   = useState<Credenciales | null>(null)
  const [nombre,         setNombre]         = useState('')
  const [guardando,      setGuardando]      = useState(false)
  const [error,          setError]          = useState('')
  const [mostrarForm,    setMostrarForm]     = useState(false)
  const [turnos,         setTurnos]         = useState<TurnoResumen[]>([])
  const [cargandoTurnos, setCargandoTurnos] = useState(true)
  const [modalOp,        setModalOp]        = useState<Operador | null>(null)
  const [cambiando,      setCambiando]      = useState(false)
  const [nuevaCred,      setNuevaCred]      = useState<Credenciales | null>(null)

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }

  async function cargarOperadores() {
    const token = await getToken()
    const res = await fetch('/api/admin/relleno', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const data: Operador[] = await res.json()
    if (!data.length) { setOperadores([]); return }

    const userIds = data.filter(o => o.user_id).map(o => o.user_id!)
    let emailMap: Record<string, string> = {}
    if (userIds.length) {
      const r2 = await fetch('/api/admin/usuario', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ userIds }),
      })
      if (r2.ok) {
        const lista: { id: string; email: string }[] = await r2.json()
        emailMap = Object.fromEntries(lista.map(u => [u.id, u.email]))
      }
    }
    setOperadores(data.map(o => ({ ...o, email: o.user_id ? emailMap[o.user_id] ?? null : null })))
  }

  async function cambiarPassword() {
    if (!modalOp?.user_id) return
    setCambiando(true)
    const token = await getToken()
    const res = await fetch('/api/admin/usuario', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ userId: modalOp.user_id }),
    })
    const json = await res.json()
    setCambiando(false)
    if (!res.ok) { setError(json.error ?? 'Error'); return }
    setNuevaCred({ email: json.email, password: json.password })
  }

  async function cargarTurnos() {
    setCargandoTurnos(true)
    const { data: { user } } = await supabase.auth.getUser()
    const purificadoraId = user?.user_metadata?.purificadora_id
    if (!purificadoraId) { setCargandoTurnos(false); return }

    // Últimos 30 días de turnos con sus movimientos agregados
    const { data: rawTurnos } = await supabase
      .from('turnos_relleno')
      .select('id, fecha, estado, stock_inicial, operador_id')
      .eq('purificadora_id', purificadoraId)
      .order('fecha', { ascending: false })
      .limit(30)

    if (!rawTurnos) { setCargandoTurnos(false); return }

    // Para cada turno calcular totales desde movimientos
    const turnосConTotales: TurnoResumen[] = await Promise.all(
      rawTurnos.map(async turno => {
        const { data: movs } = await supabase
          .from('movimientos_relleno')
          .select('tipo, cantidad')
          .eq('turno_id', turno.id)

        const rellenados = (movs ?? []).filter(m => m.tipo === 'relleno').reduce((s, m) => s + m.cantidad, 0)
        const entregados = (movs ?? []).filter(m => m.tipo === 'entrega_repartidor').reduce((s, m) => s + m.cantidad, 0)
        const vacios     = (movs ?? []).filter(m => m.tipo === 'recepcion_vacio').reduce((s, m) => s + m.cantidad, 0)
        const mermas     = (movs ?? []).filter(m => m.tipo === 'merma').reduce((s, m) => s + m.cantidad, 0)
        const stock_final = turno.stock_inicial + rellenados - entregados - mermas

        return { ...turno, rellenados, entregados, vacios, mermas, stock_final }
      })
    )

    setTurnos(turnосConTotales)
    setCargandoTurnos(false)
  }

  useEffect(() => {
    cargarOperadores()
    cargarTurnos()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function crearOperador() {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/relleno', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ nombre: nombre.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'No se pudo crear'); return }
      setCredenciales({ email: json.email, password: json.password })
      setNombre('')
      setMostrarForm(false)
      await cargarOperadores()
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(op: Operador) {
    const token = await getToken()
    await fetch('/api/admin/relleno', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ id: op.id, activo: !op.activo }),
    })
    cargarOperadores()
  }

  const operadoresMap = useMemo(() =>
    Object.fromEntries(operadores.map(o => [o.id, o.nombre])),
  [operadores])

  return (
    <div className="space-y-6">
      {/* Operadores */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">Rellenadora</h1>
          <button
            onClick={() => { setMostrarForm(f => !f); setError(''); setCredenciales(null) }}
            className="bg-sky-500 text-white text-sm px-4 py-2 rounded-xl font-medium"
          >
            {mostrarForm ? 'Cancelar' : '+ Nuevo operador'}
          </button>
        </div>

        {credenciales && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5 space-y-2">
            <p className="text-sm font-bold text-green-800">✅ Operador creado — comparte estas credenciales:</p>
            <div className="bg-white rounded-xl border border-green-100 p-3 space-y-1 font-mono text-sm">
              <p><span className="text-gray-400 text-xs">Email:</span><br /><strong>{credenciales.email}</strong></p>
              <p className="mt-1"><span className="text-gray-400 text-xs">Contraseña:</span><br /><strong>{credenciales.password}</strong></p>
            </div>
            <p className="text-xs text-green-700">Entra en <strong>/relleno</strong> con estas credenciales.</p>
            <button onClick={() => setCredenciales(null)} className="text-xs text-green-600 underline">Cerrar</button>
          </div>
        )}

        {mostrarForm && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 max-w-md space-y-3">
            <h2 className="text-sm font-bold text-gray-700">Nuevo operador de rellenadora</h2>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre *</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="María López"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={crearOperador}
              disabled={guardando}
              className="w-full bg-sky-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm"
            >
              {guardando ? 'Creando cuenta...' : 'Crear operador'}
            </button>
          </div>
        )}

        <div className="space-y-2 max-w-md">
          {operadores.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-6">Sin operadores registrados</p>
          )}
          {operadores.map(op => (
            <div key={op.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${
              op.activo ? 'border-gray-100' : 'border-gray-100 opacity-50'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-800">{op.nombre}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      op.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {op.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  {op.email
                    ? <p className="text-xs font-mono text-gray-500 mt-0.5 truncate">{op.email}</p>
                    : <p className="text-xs text-orange-500 mt-0.5">⚠️ Sin cuenta vinculada</p>
                  }
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => toggleActivo(op)}
                    className={`text-xs px-3 py-1.5 rounded-lg ${
                      op.activo ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'
                    }`}>
                    {op.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  {op.user_id && (
                    <button onClick={() => { setModalOp(op); setNuevaCred(null); setError('') }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600">
                      🔑 Contraseña
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historial de turnos */}
      <div>
        <h2 className="text-base font-bold text-gray-800 mb-3">Historial de turnos</h2>
        {cargandoTurnos ? (
          <p className="text-gray-400 text-sm">Cargando...</p>
        ) : turnos.length === 0 ? (
          <p className="text-gray-400 text-sm">Sin turnos registrados aún</p>
        ) : (
          <div className="space-y-2">
            {turnos.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">{t.fecha}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.estado === 'cerrado' ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                    }`}>
                      {t.estado === 'cerrado' ? 'Cerrado' : 'Abierto'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{operadoresMap[t.operador_id] ?? '—'}</span>
                </div>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {[
                    { label: 'Inicio',      value: t.stock_inicial, color: 'text-gray-600' },
                    { label: 'Rellenados',  value: t.rellenados,    color: 'text-sky-600'  },
                    { label: 'Entregados',  value: t.entregados,    color: 'text-orange-500' },
                    { label: 'Mermas',      value: t.mermas,        color: 'text-red-500'  },
                    { label: 'Stock final', value: t.stock_final,   color: 'text-gray-800 font-black' },
                  ].map(item => (
                    <div key={item.label}>
                      <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                      <p className="text-xs text-gray-400 leading-tight">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal cambiar contraseña */}
      {modalOp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-800">Credenciales — {modalOp.nombre}</h2>
              {modalOp.email && (
                <p className="text-sm font-mono text-gray-500 mt-1 break-all">{modalOp.email}</p>
              )}
            </div>
            {nuevaCred ? (
              <CuadroCredenciales cred={nuevaCred} onCerrar={() => { setNuevaCred(null); setModalOp(null) }} />
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  Se generará una nueva contraseña aleatoria. La contraseña anterior dejará de funcionar.
                </p>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setModalOp(null)}
                    className="flex-1 border border-gray-200 text-gray-500 rounded-2xl py-3 text-sm font-medium">
                    Cancelar
                  </button>
                  <button onClick={cambiarPassword} disabled={cambiando}
                    className="flex-1 bg-sky-500 disabled:opacity-50 text-white rounded-2xl py-3 font-bold text-sm">
                    {cambiando ? 'Generando...' : 'Nueva contraseña'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CuadroCredenciales({ cred, onCerrar }: { cred: { email: string; password: string }; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false)

  function copiar() {
    navigator.clipboard.writeText(`Email: ${cred.email}\nContraseña: ${cred.password}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2">
      <p className="text-sm font-bold text-green-800">✅ Credenciales listas — compártelas:</p>
      <div className="bg-white rounded-xl border border-green-100 p-3 space-y-1 font-mono text-sm">
        <p><span className="text-gray-400 text-xs">Email:</span><br /><strong>{cred.email}</strong></p>
        <p className="mt-1"><span className="text-gray-400 text-xs">Contraseña:</span><br /><strong>{cred.password}</strong></p>
      </div>
      <div className="flex gap-2">
        <button onClick={copiar}
          className={`flex-1 text-xs font-medium py-2 rounded-xl transition ${
            copiado ? 'bg-green-200 text-green-800' : 'bg-green-100 text-green-700'
          }`}>
          {copiado ? '✓ Copiado' : 'Copiar todo'}
        </button>
        <button onClick={onCerrar} className="text-xs text-green-600 underline px-2">Cerrar</button>
      </div>
    </div>
  )
}
