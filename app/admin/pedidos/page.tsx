'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type Repartidor = { id: string; nombre: string }

type Pedido = {
  id:            string
  estado:        'pendiente' | 'en_ruta' | 'entregado' | 'cancelado'
  cantidad:      number
  total:         number
  notas:         string | null
  created_at:    string
  clientes:      { nombre: string; telefono: string; direccion: string } | null
  repartidores:  { nombre: string } | null
}

const ESTADOS = ['todos', 'pendiente', 'en_ruta', 'entregado', 'cancelado'] as const
type Filtro = typeof ESTADOS[number]

const ETIQUETA: Record<string, string> = {
  pendiente: 'Pendiente', en_ruta: 'En ruta', entregado: 'Entregado', cancelado: 'Cancelado',
}
const COLOR_ESTADO: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  en_ruta:   'bg-blue-100 text-blue-800',
  entregado: 'bg-green-100 text-green-800',
  cancelado: 'bg-gray-100 text-gray-500',
}

export default function AdminPedidos() {
  const supabase      = useMemo(() => crearClienteBrowser(), [])
  const [pedidos, setPedidos]           = useState<Pedido[]>([])
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [filtro, setFiltro]             = useState<Filtro>('todos')
  const [cargando, setCargando]         = useState(true)

  async function cargar() {
    let q = supabase
      .from('pedidos')
      .select('id, estado, cantidad, total, notas, created_at, clientes(nombre,telefono,direccion), repartidores(nombre)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filtro !== 'todos') q = q.eq('estado', filtro)

    const { data } = await q
    setPedidos((data as unknown as Pedido[]) ?? [])
    setCargando(false)
  }

  useEffect(() => {
    supabase.from('repartidores').select('id, nombre').eq('activo', true)
      .then(({ data }) => setRepartidores(data ?? []))
  }, [supabase])

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel('admin-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [supabase, filtro])

  async function cambiarEstado(id: string, estado: string) {
    const extra = estado === 'entregado' ? { entregado_at: new Date().toISOString() } : {}
    await supabase.from('pedidos').update({ estado, ...extra }).eq('id', id)
  }

  async function asignarRepartidor(id: string, repartidorId: string) {
    await supabase.from('pedidos').update({ repartidor_id: repartidorId, estado: 'en_ruta' }).eq('id', id)
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-4">Pedidos</h1>

      {/* Filtros de estado */}
      <div className="flex gap-2 flex-wrap mb-4">
        {ESTADOS.map(e => (
          <button
            key={e}
            onClick={() => setFiltro(e)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filtro === e ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {e === 'todos' ? 'Todos' : ETIQUETA[e]}
          </button>
        ))}
      </div>

      {cargando && <p className="text-gray-400 text-sm">Cargando...</p>}

      {!cargando && pedidos.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-10">Sin pedidos con este filtro</p>
      )}

      <div className="space-y-3">
        {pedidos.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COLOR_ESTADO[p.estado]}`}>
                    {ETIQUETA[p.estado]}
                  </span>
                  <span className="text-sm font-bold text-gray-800">
                    {p.cantidad} garrafón{p.cantidad > 1 ? 'es' : ''} — ${p.total}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1 font-medium">
                  {p.clientes?.nombre ?? 'Sin nombre'}{' '}
                  <span className="text-gray-400 font-normal text-xs">{p.clientes?.telefono}</span>
                </p>
                <p className="text-xs text-gray-400 truncate">{p.clientes?.direccion}</p>
                {p.repartidores && (
                  <p className="text-xs text-gray-500 mt-0.5">🚚 {p.repartidores.nombre}</p>
                )}
                {p.notas && <p className="text-xs text-gray-400 mt-0.5 italic">{p.notas}</p>}
                <p className="text-xs text-gray-300 mt-1">
                  {new Date(p.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            </div>

            {/* Acciones */}
            {p.estado !== 'entregado' && p.estado !== 'cancelado' && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {p.estado === 'pendiente' && (
                  <select
                    defaultValue=""
                    onChange={e => e.target.value && asignarRepartidor(p.id, e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                  >
                    <option value="" disabled>Asignar repartidor…</option>
                    {repartidores.map(r => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                )}
                {p.estado === 'en_ruta' && (
                  <button
                    onClick={() => cambiarEstado(p.id, 'entregado')}
                    className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg"
                  >
                    Marcar entregado
                  </button>
                )}
                <button
                  onClick={() => cambiarEstado(p.id, 'cancelado')}
                  className="text-xs bg-red-50 text-red-500 border border-red-200 px-3 py-1.5 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
