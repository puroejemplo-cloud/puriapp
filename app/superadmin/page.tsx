'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type Purificadora = {
  id:                string
  nombre:            string
  telefono_whatsapp: string | null
  activo:            boolean
  created_at:        string
  stats?: { clientes: number; repartidores: number; pedidos_hoy: number }
}

type NuevaPuriForm = { nombre: string; telefonoWhatsapp: string }
type NuevoUserForm = { email: string; password: string; nombre: string; role: 'admin' | 'repartidor'; purificadoraId: string }

export default function SuperAdminPage() {
  const supabase = useMemo(() => crearClienteBrowser(), [])

  const [purificadoras, setPurificadoras]   = useState<Purificadora[]>([])
  const [cargando, setCargando]             = useState(true)
  const [token, setToken]                   = useState('')

  // Modal nueva purificadora
  const [modalPuri, setModalPuri]   = useState(false)
  const [formPuri, setFormPuri]     = useState<NuevaPuriForm>({ nombre: '', telefonoWhatsapp: '' })
  const [guardandoPuri, setGP]      = useState(false)
  const [errorPuri, setErrorPuri]   = useState('')

  // Modal nuevo usuario
  const [modalUser, setModalUser]   = useState(false)
  const [formUser, setFormUser]     = useState<NuevoUserForm>({ email: '', password: '', nombre: '', role: 'admin', purificadoraId: '' })
  const [guardandoUser, setGU]      = useState(false)
  const [errorUser, setErrorUser]   = useState('')
  const [mensajeUser, setMensajeUser] = useState('')

  useEffect(() => {
    async function cargar() {
      const { data: { session } } = await supabase.auth.getSession()
      setToken(session?.access_token ?? '')

      const { data: puris } = await supabase
        .from('purificadoras')
        .select('id, nombre, telefono_whatsapp, activo, created_at')
        .order('created_at')

      if (!puris) { setCargando(false); return }

      // Cargar stats de cada purificadora en paralelo
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
      const withStats = await Promise.all(puris.map(async p => {
        const [{ count: cl }, { count: rp }, { count: pe }] = await Promise.all([
          supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('purificadora_id', p.id),
          supabase.from('repartidores').select('*', { count: 'exact', head: true }).eq('purificadora_id', p.id).eq('activo', true),
          supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('purificadora_id', p.id).gte('created_at', hoy.toISOString()),
        ])
        return { ...p, stats: { clientes: cl ?? 0, repartidores: rp ?? 0, pedidos_hoy: pe ?? 0 } }
      }))

      setPurificadoras(withStats)
      setCargando(false)
    }
    cargar()
  }, [supabase])

  async function toggleActivo(id: string, activo: boolean) {
    await supabase.from('purificadoras').update({ activo: !activo }).eq('id', id)
    setPurificadoras(ps => ps.map(p => p.id === id ? { ...p, activo: !activo } : p))
  }

  async function crearPurificadora() {
    setErrorPuri('')
    if (!formPuri.nombre.trim()) { setErrorPuri('El nombre es requerido'); return }
    setGP(true)
    const res = await fetch('/api/superadmin/crear-purificadora', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nombre: formPuri.nombre.trim(), telefonoWhatsapp: formPuri.telefonoWhatsapp.trim() || null }),
    })
    const json = await res.json()
    setGP(false)
    if (!res.ok) { setErrorPuri(json.error); return }
    setModalPuri(false)
    setFormPuri({ nombre: '', telefonoWhatsapp: '' })
    // Recargar
    window.location.reload()
  }

  async function crearUsuario() {
    setErrorUser(''); setMensajeUser('')
    if (!formUser.email || !formUser.password || !formUser.purificadoraId) {
      setErrorUser('Completa todos los campos requeridos'); return
    }
    if (formUser.role === 'repartidor' && !formUser.nombre.trim()) {
      setErrorUser('El nombre es requerido para repartidores'); return
    }
    setGU(true)
    const res = await fetch('/api/superadmin/crear-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        email:          formUser.email.trim(),
        password:       formUser.password,
        role:           formUser.role,
        purificadoraId: formUser.purificadoraId,
        nombre:         formUser.nombre.trim(),
      }),
    })
    const json = await res.json()
    setGU(false)
    if (!res.ok) { setErrorUser(json.error); return }
    setMensajeUser(`✅ Usuario creado correctamente`)
    setFormUser({ email: '', password: '', nombre: '', role: 'admin', purificadoraId: formUser.purificadoraId })
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Purificadoras</h1>
          <p className="text-sm text-gray-500">{purificadoras.length} purificadora{purificadoras.length !== 1 ? 's' : ''} registrada{purificadoras.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setModalUser(true); setMensajeUser(''); setErrorUser('') }}
            className="bg-gray-700 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-xl"
          >
            + Nuevo usuario
          </button>
          <button onClick={() => { setModalPuri(true); setErrorPuri('') }}
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-bold px-4 py-2 rounded-xl"
          >
            + Nueva purificadora
          </button>
        </div>
      </div>

      {cargando && <p className="text-gray-400 text-sm">Cargando...</p>}

      <div className="space-y-4">
        {purificadoras.map(p => (
          <div key={p.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${!p.activo ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-bold text-gray-800 text-lg">{p.nombre}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                {p.telefono_whatsapp && (
                  <p className="text-xs text-gray-400 mb-2">💬 WhatsApp: {p.telefono_whatsapp}</p>
                )}
                <p className="text-xs text-gray-300 font-mono mb-3">ID: {p.id}</p>

                {/* Stats */}
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-bold text-sky-600">{p.stats?.clientes ?? 0}</p>
                    <p className="text-xs text-gray-400">Clientes</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-green-600">{p.stats?.repartidores ?? 0}</p>
                    <p className="text-xs text-gray-400">Repartidores</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-orange-500">{p.stats?.pedidos_hoy ?? 0}</p>
                    <p className="text-xs text-gray-400">Pedidos hoy</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => toggleActivo(p.id, p.activo)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium border ${
                    p.activo
                      ? 'border-red-200 text-red-500 hover:bg-red-50'
                      : 'border-green-200 text-green-600 hover:bg-green-50'
                  }`}
                >
                  {p.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  onClick={() => {
                    setFormUser(f => ({ ...f, purificadoraId: p.id }))
                    setModalUser(true)
                    setMensajeUser(''); setErrorUser('')
                  }}
                  className="text-xs px-3 py-1.5 rounded-xl font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  + Usuario
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal nueva purificadora */}
      {modalPuri && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Nueva purificadora</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nombre *</label>
                <input type="text" placeholder="Purificadora Agua Pura"
                  value={formPuri.nombre}
                  onChange={e => setFormPuri(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Número WhatsApp (opcional)</label>
                <input type="tel" placeholder="+5215512345678"
                  value={formPuri.telefonoWhatsapp}
                  onChange={e => setFormPuri(f => ({ ...f, telefonoWhatsapp: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                />
              </div>
              {errorPuri && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{errorPuri}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModalPuri(false)}
                className="flex-1 border-2 border-gray-200 py-2.5 rounded-xl text-gray-600 font-semibold text-sm hover:bg-gray-50"
              >Cancelar</button>
              <button onClick={crearPurificadora} disabled={guardandoPuri}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 py-2.5 rounded-xl font-bold text-sm"
              >{guardandoPuri ? 'Creando...' : 'Crear purificadora'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo usuario */}
      {modalUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Nuevo usuario</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Purificadora *</label>
                <select value={formUser.purificadoraId}
                  onChange={e => setFormUser(f => ({ ...f, purificadoraId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  <option value="">Seleccionar...</option>
                  {purificadoras.filter(p => p.activo).map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Rol *</label>
                <select value={formUser.role}
                  onChange={e => setFormUser(f => ({ ...f, role: e.target.value as 'admin' | 'repartidor' }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  <option value="admin">Admin</option>
                  <option value="repartidor">Repartidor</option>
                </select>
              </div>
              {formUser.role === 'repartidor' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Nombre *</label>
                  <input type="text" placeholder="Juan Repartidor"
                    value={formUser.nombre}
                    onChange={e => setFormUser(f => ({ ...f, nombre: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Correo *</label>
                <input type="email" placeholder="admin@purificadora.com"
                  value={formUser.email}
                  onChange={e => setFormUser(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Contraseña *</label>
                <input type="password" placeholder="mínimo 6 caracteres"
                  value={formUser.password}
                  onChange={e => setFormUser(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
              {errorUser   && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{errorUser}</p>}
              {mensajeUser && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2">{mensajeUser}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModalUser(false)}
                className="flex-1 border-2 border-gray-200 py-2.5 rounded-xl text-gray-600 font-semibold text-sm hover:bg-gray-50"
              >Cerrar</button>
              <button onClick={crearUsuario} disabled={guardandoUser}
                className="flex-1 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm"
              >{guardandoUser ? 'Creando...' : 'Crear usuario'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
