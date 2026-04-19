'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type Repartidor = {
  id:       string
  nombre:   string
  telefono: string | null
  activo:   boolean
  user_id:  string | null
}

type Credenciales = { email: string; password: string }

const FORM_VACIO = { nombre: '', telefono: '' }

export default function AdminRepartidores() {
  const supabase = useMemo(() => crearClienteBrowser(), [])
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [form, setForm]               = useState(FORM_VACIO)
  const [guardando, setGuardando]     = useState(false)
  const [error, setError]             = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null)

  async function cargar() {
    const { data } = await supabase.from('repartidores').select('*').order('nombre')
    setRepartidores(data ?? [])
  }

  useEffect(() => { cargar() }, [supabase])

  async function guardar() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/repartidor', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ nombre: form.nombre.trim(), telefono: form.telefono.trim() }),
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

      {/* Credenciales generadas */}
      {credenciales && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5 space-y-2">
          <p className="text-sm font-bold text-green-800">✅ Repartidor creado — comparte estas credenciales:</p>
          <div className="bg-white rounded-xl border border-green-100 p-3 space-y-1 font-mono text-sm">
            <p><span className="text-gray-400 text-xs">Email:</span><br /><strong>{credenciales.email}</strong></p>
            <p className="mt-1"><span className="text-gray-400 text-xs">Contraseña:</span><br /><strong>{credenciales.password}</strong></p>
          </div>
          <p className="text-xs text-green-700">El repartidor inicia sesión en la app con estos datos. Puede cambiar su contraseña después.</p>
          <button
            onClick={() => setCredenciales(null)}
            className="text-xs text-green-600 underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Formulario de alta */}
      {mostrarForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 space-y-3 max-w-md">
          <h2 className="text-sm font-bold text-gray-700">Nuevo repartidor</h2>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="Juan Pérez"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Teléfono (opcional)</label>
            <input
              type="tel"
              value={form.telefono}
              onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="5512345678"
            />
          </div>

          <p className="text-xs text-gray-400">
            Se creará automáticamente una cuenta con email y contraseña temporal.
          </p>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full bg-sky-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm"
          >
            {guardando ? 'Creando cuenta...' : 'Crear repartidor'}
          </button>
        </div>
      )}

      {repartidores.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-10">Sin repartidores registrados</p>
      )}

      <div className="space-y-2">
        {repartidores.map(r => (
          <div key={r.id}
            className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-2 ${
              r.activo ? 'border-gray-100' : 'border-gray-100 opacity-50'
            }`}>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">{r.nombre}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  r.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {r.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              {r.telefono && <p className="text-xs text-gray-400">{r.telefono}</p>}
              {!r.user_id && (
                <p className="text-xs text-orange-500 mt-0.5">⚠️ Sin cuenta vinculada</p>
              )}
            </div>
            <button
              onClick={() => toggleActivo(r)}
              className={`text-xs px-3 py-1.5 rounded-lg shrink-0 ${
                r.activo ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'
              }`}
            >
              {r.activo ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
