'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type VentaRuta = {
  id:             string
  nombre_cliente: string | null
  telefono:       string | null
  direccion:      string | null
  cantidad:       number
  total:          number
  convertir_cliente: boolean
  created_at:     string
  repartidores:   { nombre: string } | null
}

type Rango = 'hoy' | 'semana' | 'mes'

function fechaDesde(rango: Rango): string {
  const d = new Date()
  if (rango === 'hoy')   return d.toISOString().slice(0, 10)
  if (rango === 'semana') {
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  }
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

export default function AdminVentasRuta() {
  const supabase = useMemo(() => crearClienteBrowser(), [])
  const [ventas, setVentas]   = useState<VentaRuta[]>([])
  const [rango, setRango]     = useState<Rango>('hoy')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    supabase
      .from('ventas_ruta')
      .select('*, repartidores(nombre)')
      .gte('created_at', fechaDesde(rango))
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setVentas((data as unknown as VentaRuta[]) ?? [])
        setCargando(false)
      })
  }, [supabase, rango])

  const totalGarrafones = ventas.reduce((s, v) => s + v.cantidad, 0)
  const totalIngreso    = ventas.reduce((s, v) => s + Number(v.total), 0)

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-4">Ventas en ruta</h1>

      {/* Selector de rango */}
      <div className="flex gap-2 mb-4">
        {(['hoy', 'semana', 'mes'] as Rango[]).map(r => (
          <button
            key={r}
            onClick={() => setRango(r)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              rango === r ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {r === 'hoy' ? 'Hoy' : r === 'semana' ? 'Últimos 7 días' : 'Este mes'}
          </button>
        ))}
      </div>

      {/* Totales */}
      <div className="flex gap-4 mb-5">
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex-1 text-center">
          <div className="text-2xl font-bold text-purple-700">{totalGarrafones}</div>
          <div className="text-xs text-gray-500">Garrafones</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex-1 text-center">
          <div className="text-2xl font-bold text-emerald-700">${totalIngreso}</div>
          <div className="text-xs text-gray-500">Total ingresado</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex-1 text-center">
          <div className="text-2xl font-bold text-gray-700">{ventas.length}</div>
          <div className="text-xs text-gray-500">Ventas</div>
        </div>
      </div>

      {cargando && <p className="text-gray-400 text-sm">Cargando...</p>}

      {!cargando && ventas.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-10">Sin ventas en este período</p>
      )}

      <div className="space-y-2">
        {ventas.map(v => (
          <div key={v.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">
                    {v.cantidad} garrafón{v.cantidad > 1 ? 'es' : ''} — ${v.total}
                  </span>
                  {v.convertir_cliente && (
                    <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">Cliente fijo</span>
                  )}
                </div>
                {v.nombre_cliente && <p className="text-xs text-gray-600">{v.nombre_cliente}</p>}
                {v.telefono && <p className="text-xs text-gray-400">{v.telefono}</p>}
                {v.direccion && <p className="text-xs text-gray-400 truncate">{v.direccion}</p>}
                {v.repartidores && (
                  <p className="text-xs text-gray-400 mt-0.5">🚚 {v.repartidores.nombre}</p>
                )}
                <p className="text-xs text-gray-300 mt-1">
                  {new Date(v.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
