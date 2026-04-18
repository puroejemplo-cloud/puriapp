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

const FORM_VACIO = { nombre: '', telefono: '' }

export default function AdminRepartidores() {
  const supabase = useMemo(() => crearClienteBrowser(), [])
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [form, setForm]         = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError]       = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)

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
      const { error: e } = await supabase.from('repartidores').insert({
        nombre:   form.nombre.trim(),
        telefono: form.telefono.trim() || null,
        activo:   true,
      })
      if (e) throw e
      setForm(FORM_VACIO)
      setMostrarForm(false)
      await cargar()
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
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
          onClick={() => { setMostrarForm(f => !f); setError('') }}
          className="bg-sky-500 text-white text-sm px-4 py-2 rounded-xl font-medium"
        >
          {mostrarForm ? 'Cancelar' : '+ Nuevo'}
        </button>
      </div>

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
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Teléfono (opcional)</label>
            <input
              type="tel"
              value={form.telefono}
              onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <p className="text-xs text-gray-400">
            Después de crear el repartidor, ve a Supabase → Auth → crear usuario con su email.
            Luego pon el <code className="bg-gray-100 px-1 rounded">user_id</code> en esta tabla.
          </p>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full bg-sky-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
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
                <p className="text-xs text-orange-500 mt-0.5">⚠️ Sin cuenta de usuario vinculada</p>
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
