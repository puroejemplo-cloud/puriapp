'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type Pedido = {
  id:           string
  created_at:   string
  entregado_at: string | null
  cantidad:     number
  total:        number
  origen:       string | null
  clientes:     { nombre: string; telefono: string; direccion: string } | null
  repartidores: { nombre: string } | null
}

type VentaRuta = {
  id:          string
  created_at:  string
  cantidad:    number
  total:       number
  repartidores: { nombre: string } | null
}

type Rango = 'hoy' | 'semana' | 'mes' | 'custom'

function calcularInicio(rango: Rango, desde: string): Date {
  const ahora = new Date()
  if (rango === 'hoy') {
    ahora.setHours(0, 0, 0, 0)
    return ahora
  }
  if (rango === 'semana') {
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // lunes
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (rango === 'mes') {
    return new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  }
  return new Date(desde + 'T00:00:00')
}

function descargarCSV(filas: Record<string, unknown>[], nombre: string) {
  if (!filas.length) return
  const cols = Object.keys(filas[0])
  const header = cols.join(',')
  const rows = filas
    .map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + header + '\n' + rows], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${nombre}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function AdminReportes() {
  const supabase = useMemo(() => crearClienteBrowser(), [])

  const [rango, setRango]   = useState<Rango>('mes')
  const [desde, setDesde]   = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [hasta, setHasta]   = useState(() => new Date().toISOString().slice(0, 10))
  const [pedidos, setPedidos]   = useState<Pedido[]>([])
  const [ventas,  setVentas]    = useState<VentaRuta[]>([])
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    const ini = calcularInicio(rango, desde).toISOString()
    const fin = rango === 'custom'
      ? new Date(hasta + 'T23:59:59').toISOString()
      : new Date().toISOString()

    const [{ data: ped }, { data: ven }] = await Promise.all([
      supabase
        .from('pedidos')
        .select('id, created_at, entregado_at, cantidad, total, origen, clientes(nombre,telefono,direccion), repartidores(nombre)')
        .eq('estado', 'entregado')
        .gte('entregado_at', ini)
        .lte('entregado_at', fin)
        .order('entregado_at', { ascending: false }),
      supabase
        .from('ventas_ruta')
        .select('id, created_at, cantidad, total, repartidores(nombre)')
        .gte('created_at', ini)
        .lte('created_at', fin)
        .order('created_at', { ascending: false }),
    ])

    setPedidos((ped as unknown as Pedido[]) ?? [])
    setVentas((ven as unknown as VentaRuta[]) ?? [])
    setCargando(false)
  }, [supabase, rango, desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  const totalIngreso    = pedidos.reduce((s, p) => s + p.total, 0) + ventas.reduce((s, v) => s + v.total, 0)
  const totalGarrafones = pedidos.reduce((s, p) => s + p.cantidad, 0) + ventas.reduce((s, v) => s + v.cantidad, 0)

  const porRepartidor = useMemo(() => {
    const m: Record<string, { nombre: string; garrafones: number; ingreso: number }> = {}
    for (const p of pedidos) {
      const n = p.repartidores?.nombre ?? 'Sin asignar'
      if (!m[n]) m[n] = { nombre: n, garrafones: 0, ingreso: 0 }
      m[n].garrafones += p.cantidad; m[n].ingreso += p.total
    }
    for (const v of ventas) {
      const n = v.repartidores?.nombre ?? 'Sin asignar'
      if (!m[n]) m[n] = { nombre: n, garrafones: 0, ingreso: 0 }
      m[n].garrafones += v.cantidad; m[n].ingreso += v.total
    }
    return Object.values(m).sort((a, b) => b.ingreso - a.ingreso)
  }, [pedidos, ventas])

  const topClientes = useMemo(() => {
    const m: Record<string, { nombre: string; garrafones: number; pedidos: number }> = {}
    for (const p of pedidos) {
      const key = p.clientes?.telefono ?? p.clientes?.nombre ?? 'desconocido'
      if (!m[key]) m[key] = { nombre: p.clientes?.nombre ?? '—', garrafones: 0, pedidos: 0 }
      m[key].garrafones += p.cantidad; m[key].pedidos += 1
    }
    return Object.values(m).sort((a, b) => b.garrafones - a.garrafones).slice(0, 10)
  }, [pedidos])

  function exportarPedidos() {
    descargarCSV(pedidos.map(p => ({
      Fecha:       p.entregado_at ? new Date(p.entregado_at).toLocaleString('es-MX') : '',
      Cliente:     p.clientes?.nombre   ?? '',
      Telefono:    p.clientes?.telefono ?? '',
      Direccion:   p.clientes?.direccion ?? '',
      Repartidor:  p.repartidores?.nombre ?? '',
      Garrafones:  p.cantidad,
      Total:       p.total,
      Origen:      p.origen ?? '',
    })), 'pedidos_entregados')
  }

  function exportarVentas() {
    descargarCSV(ventas.map(v => ({
      Fecha:      new Date(v.created_at).toLocaleString('es-MX'),
      Repartidor: v.repartidores?.nombre ?? '',
      Garrafones: v.cantidad,
      Total:      v.total,
    })), 'ventas_ruta')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Reportes</h1>
        <p className="text-sm text-gray-500">Ventas y desempeño del negocio</p>
      </div>

      {/* Filtro de período */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {(['hoy', 'semana', 'mes', 'custom'] as Rango[]).map(r => (
            <button key={r} onClick={() => setRango(r)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                rango === r ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {r === 'hoy' ? 'Hoy' : r === 'semana' ? 'Esta semana' : r === 'mes' ? 'Este mes' : 'Personalizado'}
            </button>
          ))}
        </div>
        {rango === 'custom' && (
          <div className="flex gap-3 items-center flex-wrap">
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
            <span className="text-gray-400 text-sm">hasta</span>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
          </div>
        )}
      </div>

      {cargando ? (
        <div className="text-center py-16 text-gray-400">Cargando datos…</div>
      ) : (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Ingresos',    valor: `$${totalIngreso.toLocaleString('es-MX')}` },
              { label: 'Garrafones',  valor: totalGarrafones.toString() },
              { label: 'Órdenes',     valor: (pedidos.length + ventas.length).toString() },
            ].map(({ label, valor }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-sky-600 truncate">{valor}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Por repartidor */}
          {porRepartidor.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3">🚚 Por repartidor</h2>
              <div className="space-y-0">
                {porRepartidor.map(r => (
                  <div key={r.nombre} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm font-medium text-gray-700">{r.nombre}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-800">${r.ingreso.toLocaleString('es-MX')}</span>
                      <span className="text-xs text-gray-400 ml-2">· {r.garrafones} garfs.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top clientes */}
          {topClientes.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3">👥 Clientes top</h2>
              <div className="space-y-0">
                {topClientes.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{c.nombre}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-800">{c.garrafones} garfs.</span>
                      <span className="text-xs text-gray-400 ml-2">· {c.pedidos} pedidos</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pedidos entregados */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">📦 Pedidos entregados <span className="text-gray-400 font-normal">({pedidos.length})</span></h2>
              <button onClick={exportarPedidos} disabled={!pedidos.length}
                className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg font-medium disabled:opacity-40 hover:bg-green-100 transition">
                ⬇ CSV
              </button>
            </div>
            {pedidos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin pedidos en este período</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs min-w-[480px]">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      <th className="pb-2 pr-3 font-medium">Fecha</th>
                      <th className="pb-2 pr-3 font-medium">Cliente</th>
                      <th className="pb-2 pr-3 font-medium">Repartidor</th>
                      <th className="pb-2 pr-2 text-right font-medium">Garrfs.</th>
                      <th className="pb-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map(p => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
                          {new Date(p.entregado_at ?? p.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="py-2 pr-3 font-medium text-gray-700 max-w-[140px] truncate">{p.clientes?.nombre ?? '—'}</td>
                        <td className="py-2 pr-3 text-gray-500">{p.repartidores?.nombre ?? '—'}</td>
                        <td className="py-2 pr-2 text-right text-gray-700">{p.cantidad}</td>
                        <td className="py-2 text-right font-semibold text-gray-800">${p.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ventas en ruta */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">🛣️ Ventas en ruta <span className="text-gray-400 font-normal">({ventas.length})</span></h2>
              <button onClick={exportarVentas} disabled={!ventas.length}
                className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg font-medium disabled:opacity-40 hover:bg-green-100 transition">
                ⬇ CSV
              </button>
            </div>
            {ventas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin ventas en ruta en este período</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs min-w-[320px]">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      <th className="pb-2 pr-3 font-medium">Fecha</th>
                      <th className="pb-2 pr-3 font-medium">Repartidor</th>
                      <th className="pb-2 pr-2 text-right font-medium">Garrfs.</th>
                      <th className="pb-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map(v => (
                      <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
                          {new Date(v.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="py-2 pr-3 text-gray-500">{v.repartidores?.nombre ?? '—'}</td>
                        <td className="py-2 pr-2 text-right text-gray-700">{v.cantidad}</td>
                        <td className="py-2 text-right font-semibold text-gray-800">${v.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
