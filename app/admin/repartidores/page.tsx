'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type Repartidor = {
  id:       string
  nombre:   string
  telefono: string | null
  activo:   boolean
  user_id:  string | null
  email?:   string | null
}

type Credenciales = { email: string; password: string }

const FORM_VACIO = { nombre: '', telefono: '' }

export default function AdminRepartidores() {
  const supabase = useMemo(() => crearClienteBrowser(), [])
  const [repartidores,  setRepartidores]  = useState<Repartidor[]>([])
  const [form,          setForm]          = useState(FORM_VACIO)
  const [guardando,     setGuardando]     = useState(false)
  const [error,         setError]         = useState('')
  const [mostrarForm,   setMostrarForm]   = useState(false)
  const [credenciales,  setCredenciales]  = useState<Credenciales | null>(null)
  // Modal cambiar contraseña
  const [modalRep,      setModalRep]      = useState<Repartidor | null>(null)
  const [cambiando,     setCambiando]     = useState(false)
  const [nuevaCred,     setNuevaCred]     = useState<Credenciales | null>(null)

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }

  async function cargar() {
    const { data } = await supabase.from('repartidores').select('*').order('nombre')
    if (!data?.length) { setRepartidores([]); return }

    // Cargar emails desde auth
    const token = await getToken()
    const userIds = data.filter(r => r.user_id).map(r => r.user_id!)
    let emailMap: Record<string, string> = {}
    if (userIds.length) {
      const res = await fetch('/api/admin/usuario', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ userIds }),
      })
      if (res.ok) {
        const lista: { id: string; email: string }[] = await res.json()
        emailMap = Object.fromEntries(lista.map(u => [u.id, u.email]))
      }
    }

    setRepartidores(data.map(r => ({ ...r, email: r.user_id ? emailMap[r.user_id] ?? null : null })))
  }

  useEffect(() => { cargar() }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true); setError('')
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/repartidor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ nombre: form.nombre.trim(), telefono: form.telefono.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'No se pudo crear'); return }
      setCredenciales({ email: json.email, password: json.password })
      setForm(FORM_VACIO)
      setMostrarForm(false)
      await cargar()
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(r: Repartidor) {
    await supabase.from('repartidores').update({ activo: !r.activo }).eq('id', r.id)
    cargar()
  }

  async function cambiarPassword() {
    if (!modalRep?.user_id) return
    setCambiando(true)
    const token = await getToken()
    const res = await fetch('/api/admin/usuario', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ userId: modalRep.user_id }),
    })
    const json = await res.json()
    setCambiando(false)
    if (!res.ok) { setError(json.error ?? 'Error'); return }
    setNuevaCred({ email: json.email, password: json.password })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Repartidores</h1>
        <button
          onClick={() => { setMostrarForm(f => !f); setError(''); setCredenciales(null) }}
          className="bg-sky-500 text-white text-sm px-4 py-2 rounded-xl font-medium"
        >
          {mostrarForm ? 'Cancelar' : '+ Nuevo'}
        </button>
      </div>

      {/* Credenciales de creación */}
      {credenciales && <CuadroCredenciales cred={credenciales} onCerrar={() => setCredenciales(null)} />}

      {/* Formulario alta */}
      {mostrarForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 space-y-3 max-w-md">
          <h2 className="text-sm font-bold text-gray-700">Nuevo repartidor</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre *</label>
            <input type="text" value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="Juan Pérez" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Teléfono (opcional)</label>
            <input type="tel" value={form.telefono}
              onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="5512345678" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button onClick={guardar} disabled={guardando}
            className="w-full bg-sky-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm">
            {guardando ? 'Creando cuenta...' : 'Crear repartidor'}
          </button>
        </div>
      )}

      {repartidores.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-10">Sin repartidores registrados</p>
      )}

      <div className="space-y-2">
        {repartidores.map(r => (
          <div key={r.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${
            r.activo ? 'border-gray-100' : 'border-gray-100 opacity-50'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-gray-800">{r.nombre}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {r.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                {r.telefono && <p className="text-xs text-gray-400 mt-0.5">{r.telefono}</p>}
                {r.email
                  ? <p className="text-xs font-mono text-gray-500 mt-0.5 truncate">{r.email}</p>
                  : <p className="text-xs text-orange-500 mt-0.5">⚠️ Sin cuenta vinculada</p>
                }
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={() => toggleActivo(r)}
                  className={`text-xs px-3 py-1.5 rounded-lg ${
                    r.activo ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'
                  }`}>
                  {r.activo ? 'Desactivar' : 'Activar'}
                </button>
                {r.user_id && (
                  <button onClick={() => { setModalRep(r); setNuevaCred(null); setError('') }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600">
                    🔑 Contraseña
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal cambiar contraseña */}
      {modalRep && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-800">Credenciales — {modalRep.nombre}</h2>
              {modalRep.email && (
                <p className="text-sm font-mono text-gray-500 mt-1 break-all">{modalRep.email}</p>
              )}
            </div>

            {nuevaCred ? (
              <CuadroCredenciales cred={nuevaCred} onCerrar={() => { setNuevaCred(null); setModalRep(null) }} />
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  Se generará una nueva contraseña aleatoria y se aplicará de inmediato. La contraseña anterior dejará de funcionar.
                </p>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setModalRep(null)}
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
