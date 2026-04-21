'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type VentaRuta = {
  id:             string
  nombre_cliente: string | null
  telefono:       string | null
  cantidad:       number
  total:          number
  created_at:     string
  repartidor_id:  string | null
  repartidores:   { nombre: string } | null
}

type PedidoEntregado = {
  id:           string
  cantidad:     number
  total:        number | null
  entregado_at: string | null
  created_at:   string
  repartidor_id: string | null
  repartidores: { nombre: string } | null
  clientes:     { nombre: string } | null
}

type Rango = 'hoy' | 'semana' | 'mes'

function fechaDesde(rango: Rango): string {
  const d = new Date()
  if (rango === 'hoy') return d.toISOString().slice(0, 10)
  if (rango === 'semana') { d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) }
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

type ResumenRep = {
  id:           string
  nombre:       string
  garrafonesRuta:    number
  ingresoRuta:       number
  garrafonesPedidos: number
  ingresoPedidos:    number
}

export default function AdminVentasRuta() {
  const supabase = useMemo(() => crearClienteBrowser(), [])
  const [ventas,    setVentas]    = useState<VentaRuta[]>([])
  const [pedidos,   setPedidos]   = useState<PedidoEntregado[]>([])
  const [rango,     setRango]     = useState<Rango>('hoy')
  const [cargando,  setCargando]  = useState(true)
  const [vista,     setVista]     = useState<'resumen' | 'detalle'>('resumen')

  useEffect(() => {
    setCargando(true)
    const desde = fechaDesde(rango)
    Promise.all([
      supabase
        .from('ventas_ruta')
        .select('id, nombre_cliente, telefono, cantidad, total, created_at, repartidor_id, repartidores(nombre)')
        .gte('created_at', desde)
        .order('created_at', { ascending: false }),
      supabase
        .from('pedidos')
        .select('id, cantidad, total, entregado_at, created_at, repartidor_id, repartidores(nombre), clientes(nombre)')
        .eq('estado', 'entregado')
        .gte('created_at', desde)
        .order('created_at', { ascending: false }),
    ]).then(([{ data: v }, { data: p }]) => {
      setVentas((v as unknown as VentaRuta[]) ?? [])
      setPedidos((p as unknown as PedidoEntregado[]) ?? [])
      setCargando(false)
    })
  }, [supabase, rango])

  // Totales globales
  const totalGarrafones = useMemo(() =>
    ventas.reduce((s, v) => s + v.cantidad, 0) +
    pedidos.reduce((s, p) => s + p.cantidad, 0),
  [ventas, pedidos])

  const totalIngreso = useMemo(() =>
    ventas.reduce((s, v) => s + Number(v.total), 0) +
    pedidos.reduce((s, p) => s + Number(p.total ?? 0), 0),
  [ventas, pedidos])

  // Resumen agrupado por repartidor
  const resumenReps = useMemo((): ResumenRep[] => {
    const map: Record<string, ResumenRep> = {}

    for (const v of ventas) {
      const id     = v.repartidor_id ?? 'sin-asignar'
      const nombre = v.repartidores?.nombre ?? 'Sin asignar'
      if (!map[id]) map[id] = { id, nombre, garrafonesRuta: 0, ingresoRuta: 0, garrafonesPedidos: 0, ingresoPedidos: 0 }
      map[id].garrafonesRuta += v.cantidad
      map[id].ingresoRuta    += Number(v.total)
    }

    for (const p of pedidos) {
      const id     = p.repartidor_id ?? 'sin-asignar'
      const nombre = p.repartidores?.nombre ?? 'Sin asignar'
      if (!map[id]) map[id] = { id, nombre, garrafonesRuta: 0, ingresoRuta: 0, garrafonesPedidos: 0, ingresoPedidos: 0 }
      map[id].garrafonesPedidos += p.cantidad
      map[id].ingresoPedidos    += Number(p.total ?? 0)
    }

    return Object.values(map).sort((a, b) =>
      (b.ingresoRuta + b.ingresoPedidos) - (a.ingresoRuta + a.ingresoPedidos)
    )
  }, [ventas, pedidos])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-4">Ventas en ruta</h1>

      {/* Selector rango */}
      <div className="flex gap-2 mb-4">
        {(['hoy', 'semana', 'mes'] as Rango[]).map(r => (
          <button key={r} onClick={() => setRango(r)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              rango === r ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {r === 'hoy' ? 'Hoy' : r === 'semana' ? 'Últimos 7 días' : 'Este mes'}
          </button>
        ))}
      </div>

      {/* Totales globales */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-sky-700">{totalGarrafones}</div>
          <div className="text-xs text-gray-500">Garrafones</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-emerald-700">${totalIngreso.toFixed(0)}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-gray-700">{ventas.length + pedidos.length}</div>
          <div className="text-xs text-gray-500">Transacciones</div>
        </div>
      </div>

      {/* Tabs resumen / detalle */}
      <div className="flex gap-1 mb-4">
        {(['resumen', 'detalle'] as const).map(v => (
          <button key={v} onClick={() => setVista(v)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              vista === v ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
            {v === 'resumen' ? 'Por repartidor' : 'Detalle'}
          </button>
        ))}
      </div>

      {cargando && <p className="text-gray-400 text-sm">Cargando...</p>}

      {/* Vista: resumen por repartidor */}
      {!cargando && vista === 'resumen' && (
        <div className="space-y-3">
          {resumenReps.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-10">Sin ventas en este período</p>
          )}
          {resumenReps.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">🚚 {r.nombre}</p>
              <div className="grid grid-cols-2 gap-2">
                {/* Ventas espontáneas */}
                <div className="bg-purple-50 rounded-xl p-3">
                  <p className="text-xs text-purple-500 font-medium mb-1">Ventas en ruta</p>
                  <p className="text-xl font-black text-purple-700">{r.garrafonesRuta} <span className="text-xs font-normal">garrafones</span></p>
                  <p className="text-sm font-bold text-purple-600">${r.ingresoRuta.toFixed(0)}</p>
                </div>
                {/* Pedidos entregados */}
                <div className="bg-sky-50 rounded-xl p-3">
                  <p className="text-xs text-sky-500 font-medium mb-1">Pedidos entregados</p>
                  <p className="text-xl font-black text-sky-700">{r.garrafonesPedidos} <span className="text-xs font-normal">garrafones</span></p>
                  <p className="text-sm font-bold text-sky-600">${r.ingresoPedidos.toFixed(0)}</p>
                </div>
              </div>
              {/* Total combinado */}
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">Total del período</span>
                <span className="text-base font-black text-gray-800">
                  {r.garrafonesRuta + r.garrafonesPedidos} garrafones — ${(r.ingresoRuta + r.ingresoPedidos).toFixed(0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vista: detalle de transacciones */}
      {!cargando && vista === 'detalle' && (
        <div className="space-y-2">
          {ventas.length === 0 && pedidos.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-10">Sin ventas en este período</p>
          )}
          {/* Mezclar y ordenar por fecha */}
          {[
            ...ventas.map(v => ({ ...v, _tipo: 'ruta' as const })),
            ...pedidos.map(p => ({ ...p, _tipo: 'pedido' as const, nombre_cliente: p.clientes?.nombre ?? null, telefono: null })),
          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
           .map(tx => (
            <div key={tx.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-bold text-gray-800">
                      {tx.cantidad} garrafón{tx.cantidad > 1 ? 'es' : ''} — ${Number(tx.total ?? 0).toFixed(0)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      tx._tipo === 'ruta' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
                    }`}>
                      {tx._tipo === 'ruta' ? 'Venta ruta' : 'Pedido'}
                    </span>
                  </div>
                  {tx.nombre_cliente && <p className="text-xs text-gray-600">{tx.nombre_cliente}</p>}
                  {'telefono' in tx && tx.telefono && <p className="text-xs text-gray-400">{tx.telefono}</p>}
                  {tx.repartidores && <p className="text-xs text-gray-400 mt-0.5">🚚 {tx.repartidores.nombre}</p>}
                  <p className="text-xs text-gray-300 mt-1">
                    {new Date(tx.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
