'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type Usuario = {
  id:       string
  nombre:   string
  telefono?: string | null
  activo:   boolean
  user_id:  string | null
  email?:   string | null
}

type Credenciales = { email: string; password: string }
type Seccion = 'repartidores' | 'relleno'

export default function AdminUsuarios() {
  const supabase = useMemo(() => crearClienteBrowser(), [])
  const [seccion, setSeccion] = useState<Seccion>('repartidores')

  // Repartidores
  const [repartidores,    setRepartidores]    = useState<Usuario[]>([])
  const [formRep,         setFormRep]         = useState({ nombre: '', telefono: '' })
  const [mostrarFormRep,  setMostrarFormRep]  = useState(false)
  const [guardandoRep,    setGuardandoRep]    = useState(false)
  const [credRep,         setCredRep]         = useState<Credenciales | null>(null)

  // Operadores rellenadora
  const [operadores,      setOperadores]      = useState<Usuario[]>([])
  const [nombreOp,        setNombreOp]        = useState('')
  const [mostrarFormOp,   setMostrarFormOp]   = useState(false)
  const [guardandoOp,     setGuardandoOp]     = useState(false)
  const [credOp,          setCredOp]          = useState<Credenciales | null>(null)

  // Modal contraseña (compartido)
  const [modalUser,  setModalUser]  = useState<(Usuario & { tipo: Seccion }) | null>(null)
  const [cambiando,  setCambiando]  = useState(false)
  const [nuevaCred,  setNuevaCred]  = useState<Credenciales | null>(null)
  const [errorModal, setErrorModal] = useState('')
  const [errorRep,   setErrorRep]   = useState('')
  const [errorOp,    setErrorOp]    = useState('')

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }

  async function cargarEmails(lista: { id: string; user_id: string | null }[], token: string) {
    const userIds = lista.filter(u => u.user_id).map(u => u.user_id!)
    if (!userIds.length) return {} as Record<string, string>
    const res = await fetch('/api/admin/usuario', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ userIds }),
    })
    if (!res.ok) return {} as Record<string, string>
    const lista2: { id: string; email: string }[] = await res.json()
    return Object.fromEntries(lista2.map(u => [u.id, u.email]))
  }

  async function cargarRepartidores() {
    const { data } = await supabase.from('repartidores').select('*').order('nombre')
    if (!data) return
    const token = await getToken()
    const emailMap = await cargarEmails(data, token)
    setRepartidores(data.map(r => ({ ...r, email: r.user_id ? emailMap[r.user_id] ?? null : null })))
  }

  async function cargarOperadores() {
    const token = await getToken()
    const res = await fetch('/api/admin/relleno', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const data: Usuario[] = await res.json()
    const emailMap = await cargarEmails(data, token)
    setOperadores(data.map(o => ({ ...o, email: o.user_id ? emailMap[o.user_id] ?? null : null })))
  }

  useEffect(() => {
    cargarRepartidores()
    cargarOperadores()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function crearRepartidor() {
    if (!formRep.nombre.trim()) { setErrorRep('El nombre es obligatorio'); return }
    setGuardandoRep(true); setErrorRep('')
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/repartidor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ nombre: formRep.nombre.trim(), telefono: formRep.telefono.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setErrorRep(json.error ?? 'No se pudo crear'); return }
      setCredRep({ email: json.email, password: json.password })
      setFormRep({ nombre: '', telefono: '' })
      setMostrarFormRep(false)
      await cargarRepartidores()
    } catch {
      setErrorRep('Error de red. Intenta de nuevo.')
    } finally {
      setGuardandoRep(false)
    }
  }

  async function crearOperador() {
    if (!nombreOp.trim()) { setErrorOp('El nombre es obligatorio'); return }
    setGuardandoOp(true); setErrorOp('')
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/relleno', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ nombre: nombreOp.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setErrorOp(json.error ?? 'No se pudo crear'); return }
      setCredOp({ email: json.email, password: json.password })
      setNombreOp('')
      setMostrarFormOp(false)
      await cargarOperadores()
    } catch {
      setErrorOp('Error de red. Intenta de nuevo.')
    } finally {
      setGuardandoOp(false)
    }
  }

  async function toggleRepartidor(r: Usuario) {
    await supabase.from('repartidores').update({ activo: !r.activo }).eq('id', r.id)
    cargarRepartidores()
  }

  async function toggleOperador(op: Usuario) {
    const token = await getToken()
    await fetch('/api/admin/relleno', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ id: op.id, activo: !op.activo }),
    })
    cargarOperadores()
  }

  async function cambiarPassword() {
    if (!modalUser?.user_id) return
    setCambiando(true); setErrorModal('')
    const token = await getToken()
    const res = await fetch('/api/admin/usuario', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ userId: modalUser.user_id }),
    })
    const json = await res.json()
    setCambiando(false)
    if (!res.ok) { setErrorModal(json.error ?? 'Error'); return }
    setNuevaCred({ email: json.email, password: json.password })
  }

  function abrirModal(u: Usuario, tipo: Seccion) {
    setModalUser({ ...u, tipo })
    setNuevaCred(null)
    setErrorModal('')
  }

  function ListaUsuarios({ lista, tipo, onToggle }: {
    lista: Usuario[]
    tipo: Seccion
    onToggle: (u: Usuario) => void
  }) {
    return (
      <div className="space-y-2">
        {lista.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">Sin usuarios registrados</p>
        )}
        {lista.map(u => (
          <div key={u.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${
            u.activo ? 'border-gray-100' : 'border-gray-100 opacity-50'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-gray-800">{u.nombre}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                {'telefono' in u && u.telefono && (
                  <p className="text-xs text-gray-400 mt-0.5">{u.telefono}</p>
                )}
                {u.email
                  ? <p className="text-xs font-mono text-gray-500 mt-0.5 truncate">{u.email}</p>
                  : <p className="text-xs text-orange-500 mt-0.5">⚠️ Sin cuenta vinculada</p>
                }
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={() => onToggle(u)}
                  className={`text-xs px-3 py-1.5 rounded-lg ${
                    u.activo ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'
                  }`}>
                  {u.activo ? 'Desactivar' : 'Activar'}
                </button>
                {u.user_id && (
                  <button onClick={() => abrirModal(u, tipo)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600">
                    🔑 Contraseña
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-4">Usuarios</h1>

      {/* Tabs de sección */}
      <div className="flex gap-1 mb-5">
        {([
          { key: 'repartidores', label: '🚚 Repartidores' },
          { key: 'relleno',      label: '💧 Rellenadora'  },
        ] as { key: Seccion; label: string }[]).map(s => (
          <button key={s.key} onClick={() => setSeccion(s.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              seccion === s.key ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Sección repartidores */}
      {seccion === 'repartidores' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{repartidores.length} registrado{repartidores.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => { setMostrarFormRep(f => !f); setErrorRep(''); setCredRep(null) }}
              className="bg-sky-500 text-white text-sm px-4 py-2 rounded-xl font-medium">
              {mostrarFormRep ? 'Cancelar' : '+ Nuevo repartidor'}
            </button>
          </div>

          {credRep && <CuadroCredenciales cred={credRep} onCerrar={() => setCredRep(null)} />}

          {mostrarFormRep && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 space-y-3 max-w-md">
              <h2 className="text-sm font-bold text-gray-700">Nuevo repartidor</h2>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre *</label>
                <input type="text" value={formRep.nombre}
                  onChange={e => setFormRep(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="Juan Pérez" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Teléfono (opcional)</label>
                <input type="tel" value={formRep.telefono}
                  onChange={e => setFormRep(p => ({ ...p, telefono: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="5512345678" />
              </div>
              {errorRep && <p className="text-red-500 text-sm">{errorRep}</p>}
              <button onClick={crearRepartidor} disabled={guardandoRep}
                className="w-full bg-sky-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm">
                {guardandoRep ? 'Creando cuenta...' : 'Crear repartidor'}
              </button>
            </div>
          )}

          <ListaUsuarios lista={repartidores} tipo="repartidores" onToggle={toggleRepartidor} />
        </div>
      )}

      {/* Sección rellenadora */}
      {seccion === 'relleno' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{operadores.length} registrado{operadores.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => { setMostrarFormOp(f => !f); setErrorOp(''); setCredOp(null) }}
              className="bg-sky-500 text-white text-sm px-4 py-2 rounded-xl font-medium">
              {mostrarFormOp ? 'Cancelar' : '+ Nuevo operador'}
            </button>
          </div>

          {credOp && <CuadroCredenciales cred={credOp} onCerrar={() => setCredOp(null)} />}

          {mostrarFormOp && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 space-y-3 max-w-md">
              <h2 className="text-sm font-bold text-gray-700">Nuevo operador de rellenadora</h2>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre *</label>
                <input type="text" value={nombreOp}
                  onChange={e => setNombreOp(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="María López" />
              </div>
              {errorOp && <p className="text-red-500 text-sm">{errorOp}</p>}
              <button onClick={crearOperador} disabled={guardandoOp}
                className="w-full bg-sky-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm">
                {guardandoOp ? 'Creando cuenta...' : 'Crear operador'}
              </button>
            </div>
          )}

          <ListaUsuarios lista={operadores} tipo="relleno" onToggle={toggleOperador} />
        </div>
      )}

      {/* Modal cambiar contraseña */}
      {modalUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-800">Credenciales — {modalUser.nombre}</h2>
              {modalUser.email && (
                <p className="text-sm font-mono text-gray-500 mt-1 break-all">{modalUser.email}</p>
              )}
            </div>
            {nuevaCred ? (
              <CuadroCredenciales cred={nuevaCred} onCerrar={() => { setNuevaCred(null); setModalUser(null) }} />
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  Se generará una nueva contraseña aleatoria y se aplicará de inmediato. La contraseña anterior dejará de funcionar.
                </p>
                {errorModal && <p className="text-red-500 text-sm">{errorModal}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setModalUser(null)}
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
    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5 space-y-2">
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
