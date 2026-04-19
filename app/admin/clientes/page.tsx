'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'
import { geocodificar } from '@/lib/geocoding'

type Cliente = {
  id:          string
  nombre:      string
  telefono:    string
  direccion:   string
  referencias: string | null
  lat:         number | null
  lng:         number | null
  activo:      boolean
  garrafones_prestados: number
}

const VACIO: Omit<Cliente, 'id'> = {
  nombre: '', telefono: '', direccion: '', referencias: '',
  lat: null, lng: null, activo: true, garrafones_prestados: 0,
}

export default function AdminClientes() {
  const supabase = useMemo(() => crearClienteBrowser(), [])
  const [clientes, setClientes]   = useState<Cliente[]>([])
  const [busqueda, setBusqueda]   = useState('')
  const [editando, setEditando]   = useState<Cliente | null>(null)
  const [form, setForm]           = useState(VACIO)
  const [modo, setModo]           = useState<'lista' | 'form'>('lista')
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  async function cargar() {
    let q = supabase.from('clientes').select('*').order('nombre')
    if (busqueda) q = q.or(`nombre.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%`)
    const { data } = await q
    setClientes(data ?? [])
  }

  useEffect(() => { cargar() }, [supabase, busqueda])

  function abrirNuevo() {
    setEditando(null)
    setForm(VACIO)
    setError('')
    setModo('form')
  }

  function abrirEditar(c: Cliente) {
    setEditando(c)
    setForm({ nombre: c.nombre, telefono: c.telefono, direccion: c.direccion,
              referencias: c.referencias ?? '', lat: c.lat, lng: c.lng,
              activo: c.activo, garrafones_prestados: c.garrafones_prestados })
    setError('')
    setModo('form')
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.telefono.trim()) {
      setError('Nombre y teléfono son obligatorios')
      return
    }
    setGuardando(true)
    setError('')

    try {
      // Re-geocodificar si cambió la dirección o no hay coords
      let lat = form.lat
      let lng = form.lng
      const dirCambio = editando ? editando.direccion !== form.direccion : true
      if (form.direccion.trim() && dirCambio) {
        const geo = await geocodificar(form.direccion.trim())
        if (geo) { lat = geo.lat; lng = geo.lng }
      }

      const payload = { ...form, lat, lng }

      if (editando) {
        await supabase.from('clientes').update(payload).eq('id', editando.id)
      } else {
        await supabase.from('clientes').insert(payload)
      }

      await cargar()
      setModo('lista')
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(c: Cliente) {
    await supabase.from('clientes').update({ activo: !c.activo }).eq('id', c.id)
    cargar()
  }

  async function eliminar(c: Cliente) {
    if (!confirm(`¿Eliminar a ${c.nombre}? Esta acción no se puede deshacer.`)) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/cliente', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ id: c.id }),
    })
    if (res.ok) cargar()
    else alert('No se pudo eliminar. El cliente puede tener pedidos asociados.')
  }

  if (modo === 'form') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setModo('lista')} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">←</button>
          <h1 className="text-xl font-bold text-gray-800">{editando ? 'Editar cliente' : 'Nuevo cliente'}</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3 max-w-lg">
          {[
            { label: 'Nombre *', key: 'nombre',      type: 'text' },
            { label: 'Teléfono *', key: 'telefono',  type: 'tel'  },
            { label: 'Dirección', key: 'direccion',  type: 'text' },
            { label: 'Referencias', key: 'referencias', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              <input
                type={f.type}
                value={(form as Record<string, unknown>)[f.key] as string ?? ''}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Garrafones prestados</label>
            <input
              type="number" min={0}
              value={form.garrafones_prestados}
              onChange={e => setForm(prev => ({ ...prev, garrafones_prestados: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.activo}
              onChange={e => setForm(prev => ({ ...prev, activo: e.target.checked }))}
              className="w-4 h-4 accent-sky-500" />
            <span className="text-sm text-gray-700">Cliente activo</span>
          </label>

          {form.lat && form.lng && (
            <p className="text-xs text-green-600">📍 {form.lat.toFixed(5)}, {form.lng.toFixed(5)}</p>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full bg-sky-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Clientes</h1>
        <button onClick={abrirNuevo}
          className="bg-sky-500 text-white text-sm px-4 py-2 rounded-xl font-medium">
          + Nuevo
        </button>
      </div>

      <input
        type="search"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o teléfono…"
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-sky-400"
      />

      {clientes.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-10">Sin clientes</p>
      )}

      <div className="space-y-2">
        {clientes.map(c => (
          <div key={c.id}
            className={`bg-white rounded-2xl border shadow-sm p-4 flex items-start justify-between gap-2 ${
              c.activo ? 'border-gray-100' : 'border-gray-100 opacity-50'
            }`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">{c.nombre}</span>
                {!c.activo && <span className="text-xs text-gray-400">(inactivo)</span>}
                {c.garrafones_prestados > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                    {c.garrafones_prestados} prestados
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{c.telefono}</p>
              <p className="text-xs text-gray-400 truncate">{c.direccion}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => abrirEditar(c)}
                className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200">
                Editar
              </button>
              <button onClick={() => toggleActivo(c)}
                className={`text-xs px-3 py-1.5 rounded-lg ${
                  c.activo ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'
                }`}>
                {c.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button onClick={() => eliminar(c)}
                className="text-xs bg-red-50 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-100">
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
