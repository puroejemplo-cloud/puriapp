'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type PedidoRow = {
  id: string
  cantidad: number
  total: number
  origen: string
  created_at: string
  entregado_at: string | null
  clientes: { nombre: string; telefono: string } | null
  repartidores: { nombre: string } | null
}

type VentaRutaRow = {
  id: string
  nombre_cliente: string
  telefono: string | null
  cantidad: number
  total: number
  created_at: string
  repartidores: { nombre: string } | null
}

type Resumen = {
  ingresos:     number
  garrafones:   number
  transacciones: number
  ticketPromedio: number
  porOrigen: { whatsapp: number; admin: number; ruta: number }
}

const PERIODOS = [
  { key: 'hoy',    label: 'Hoy' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes',    label: 'Este mes' },
  { key: 'anio',   label: 'Este año' },
  { key: 'todo',   label: 'Todo el tiempo' },
] as const
type Periodo = typeof PERIODOS[number]['key']

function inicioDesde(periodo: Periodo): Date | null {
  const d = new Date()
  if (periodo === 'hoy')    { d.setHours(0, 0, 0, 0); return d }
  if (periodo === 'semana') { d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d }
  if (periodo === 'mes')    { return new Date(d.getFullYear(), d.getMonth(), 1) }
  if (periodo === 'anio')   { return new Date(d.getFullYear(), 0, 1) }
  return null
}

function formatMXN(n: number) {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Badge({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${color}`}>
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AdminContabilidad() {
  const supabase = useMemo(() => crearClienteBrowser(), [])

  const [periodo, setPeriodo]       = useState<Periodo>('mes')
  const [pedidos, setPedidos]       = useState<PedidoRow[]>([])
  const [ventas, setVentas]         = useState<VentaRutaRow[]>([])
  const [cargando, setCargando]     = useState(true)
  const [tabDetalle, setTabDetalle] = useState<'pedidos' | 'ventas_ruta'>('pedidos')

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const desde = inicioDesde(periodo)

      let qPedidos = supabase
        .from('pedidos')
        .select('id, cantidad, total, origen, created_at, entregado_at, clientes(nombre, telefono), repartidores(nombre)')
        .eq('estado', 'entregado')
        .order('entregado_at', { ascending: false })

      let qVentas = supabase
        .from('ventas_ruta')
        .select('id, nombre_cliente, telefono, cantidad, total, created_at, repartidores(nombre)')
        .order('created_at', { ascending: false })

      if (desde) {
        qPedidos = qPedidos.gte('entregado_at', desde.toISOString())
        qVentas  = qVentas.gte('created_at', desde.toISOString())
      }

      const [{ data: p }, { data: v }] = await Promise.all([qPedidos, qVentas])
      setPedidos((p as unknown as PedidoRow[]) ?? [])
      setVentas((v as unknown as VentaRutaRow[]) ?? [])
      setCargando(false)
    }
    cargar()
  }, [supabase, periodo])

  const resumen = useMemo<Resumen>(() => {
    const ingPedidos = pedidos.reduce((s, p) => s + Number(p.total), 0)
    const ingVentas  = ventas.reduce((s, v) => s + Number(v.total), 0)
    const garPedidos = pedidos.reduce((s, p) => s + p.cantidad, 0)
    const garVentas  = ventas.reduce((s, v) => s + v.cantidad, 0)
    const total      = ingPedidos + ingVentas
    const trans      = pedidos.length + ventas.length

    return {
      ingresos:      total,
      garrafones:    garPedidos + garVentas,
      transacciones: trans,
      ticketPromedio: trans > 0 ? total / trans : 0,
      porOrigen: {
        whatsapp: pedidos.filter(p => p.origen === 'whatsapp').reduce((s, p) => s + Number(p.total), 0),
        admin:    pedidos.filter(p => p.origen === 'admin').reduce((s, p) => s + Number(p.total), 0),
        ruta:     ingVentas,
      },
    }
  }, [pedidos, ventas])

  // Ventas agrupadas por día (para mini gráfico de barras)
  const porDia = useMemo(() => {
    const mapa: Record<string, number> = {}
    const toKey = (d: string) => d.slice(0, 10)

    pedidos.forEach(p => {
      const k = toKey(p.entregado_at ?? p.created_at)
      mapa[k] = (mapa[k] ?? 0) + Number(p.total)
    })
    ventas.forEach(v => {
      const k = toKey(v.created_at)
      mapa[k] = (mapa[k] ?? 0) + Number(v.total)
    })

    return Object.entries(mapa)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)  // últimos 14 días máximo
  }, [pedidos, ventas])

  const maxDia = Math.max(...porDia.map(([, v]) => v), 1)

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Contabilidad</h1>
      <p className="text-sm text-gray-500 mb-4">Resumen financiero de todas las ventas</p>

      {/* Selector de período */}
      <div className="flex gap-2 flex-wrap mb-5">
        {PERIODOS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriodo(p.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              periodo === p.key ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : (
        <>
          {/* Tarjetas principales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <Badge label="Ingresos totales"   value={formatMXN(resumen.ingresos)}     color="border-green-200"  sub={`${resumen.transacciones} ventas`} />
            <Badge label="Garrafones"          value={String(resumen.garrafones)}      color="border-sky-200"    sub="unidades vendidas" />
            <Badge label="Ticket promedio"     value={formatMXN(resumen.ticketPromedio)} color="border-purple-200" sub="por venta" />
            <Badge label="Ventas en ruta"      value={formatMXN(resumen.porOrigen.ruta)} color="border-emerald-200" sub={`${ventas.length} transacciones`} />
          </div>

          {/* Origen de ventas */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Ingresos por canal</h2>
            <div className="space-y-2">
              {[
                { label: '💬 WhatsApp',    valor: resumen.porOrigen.whatsapp, color: 'bg-green-400' },
                { label: '🖥 Admin',        valor: resumen.porOrigen.admin,    color: 'bg-sky-400'   },
                { label: '🛣️ Venta en ruta', valor: resumen.porOrigen.ruta,  color: 'bg-emerald-400' },
              ].map(item => {
                const pct = resumen.ingresos > 0 ? (item.valor / resumen.ingresos) * 100 : 0
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                      <span>{item.label}</span>
                      <span className="font-medium">{formatMXN(item.valor)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Gráfico de barras por día */}
          {porDia.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Ingresos por día</h2>
              <div className="flex items-end gap-1 h-24">
                {porDia.map(([fecha, valor]) => {
                  const pct  = (valor / maxDia) * 100
                  const dia  = new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
                  return (
                    <div key={fecha} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-full bg-sky-400 rounded-t-sm transition-all hover:bg-sky-500"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      />
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-1 bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                        {dia}: {formatMXN(valor)}
                      </div>
                      <span className="text-[9px] text-gray-400 truncate w-full text-center">{dia.split(' ')[0]}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Detalle de transacciones */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setTabDetalle('pedidos')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tabDetalle === 'pedidos' ? 'text-sky-600 border-b-2 border-sky-500' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📦 Pedidos entregados ({pedidos.length})
              </button>
              <button
                onClick={() => setTabDetalle('ventas_ruta')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tabDetalle === 'ventas_ruta' ? 'text-sky-600 border-b-2 border-sky-500' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🛣️ Ventas en ruta ({ventas.length})
              </button>
            </div>

            {/* Tabla pedidos */}
            {tabDetalle === 'pedidos' && (
              pedidos.length === 0
                ? <p className="text-center text-gray-400 text-sm py-10">Sin pedidos entregados en este período</p>
                : <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">Cliente</th>
                          <th className="px-4 py-2 text-left">Canal</th>
                          <th className="px-4 py-2 text-center">Garrafones</th>
                          <th className="px-4 py-2 text-right">Total</th>
                          <th className="px-4 py-2 text-right">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {pedidos.map(p => (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-gray-800">{p.clientes?.nombre ?? '—'}</p>
                              <p className="text-xs text-gray-400">{p.clientes?.telefono}</p>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                p.origen === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-sky-100 text-sky-700'
                              }`}>
                                {p.origen === 'whatsapp' ? '💬 WhatsApp' : '🖥 Admin'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center text-gray-600">{p.cantidad}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{formatMXN(p.total)}</td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-400">
                              {new Date(p.entregado_at ?? p.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 font-semibold text-sm">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-gray-700">Total</td>
                          <td className="px-4 py-3 text-center text-gray-700">{pedidos.reduce((s,p)=>s+p.cantidad,0)}</td>
                          <td className="px-4 py-3 text-right text-green-700">{formatMXN(pedidos.reduce((s,p)=>s+Number(p.total),0))}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
            )}

            {/* Tabla ventas en ruta */}
            {tabDetalle === 'ventas_ruta' && (
              ventas.length === 0
                ? <p className="text-center text-gray-400 text-sm py-10">Sin ventas en ruta en este período</p>
                : <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">Cliente</th>
                          <th className="px-4 py-2 text-left">Repartidor</th>
                          <th className="px-4 py-2 text-center">Garrafones</th>
                          <th className="px-4 py-2 text-right">Total</th>
                          <th className="px-4 py-2 text-right">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {ventas.map(v => (
                          <tr key={v.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-gray-800">{v.nombre_cliente}</p>
                              <p className="text-xs text-gray-400">{v.telefono ?? '—'}</p>
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 text-xs">{v.repartidores?.nombre ?? '—'}</td>
                            <td className="px-4 py-2.5 text-center text-gray-600">{v.cantidad}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{formatMXN(v.total)}</td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-400">
                              {new Date(v.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 font-semibold text-sm">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-gray-700">Total</td>
                          <td className="px-4 py-3 text-center text-gray-700">{ventas.reduce((s,v)=>s+v.cantidad,0)}</td>
                          <td className="px-4 py-3 text-right text-green-700">{formatMXN(ventas.reduce((s,v)=>s+Number(v.total),0))}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
