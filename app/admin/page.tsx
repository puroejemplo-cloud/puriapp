'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'

type Cards = {
  pendientes:    number
  en_ruta:       number
  entregados:    number
  ventas_ruta:   number
  clientes:      number
  ingreso:       number
}

const HOY = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

export default function AdminResumen() {
  const supabase = useMemo(() => crearClienteBrowser(), [])
  const [cards, setCards] = useState<Cards>({
    pendientes: 0, en_ruta: 0, entregados: 0,
    ventas_ruta: 0, clientes: 0, ingreso: 0,
  })
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    const [
      { count: pendientes },
      { count: en_ruta },
      { data: entregadosHoy },
      { data: ventasHoy },
      { count: clientes },
    ] = await Promise.all([
      supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('estado', 'en_ruta'),
      supabase.from('pedidos').select('total').eq('estado', 'entregado').gte('entregado_at', HOY),
      supabase.from('ventas_ruta').select('total, cantidad').gte('created_at', HOY),
      supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
    ])

    const ingresosPedidos  = (entregadosHoy ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0)
    const ingresosVentas   = (ventasHoy    ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0)

    setCards({
      pendientes:  pendientes  ?? 0,
      en_ruta:     en_ruta     ?? 0,
      entregados:  (entregadosHoy ?? []).length,
      ventas_ruta: (ventasHoy     ?? []).reduce((s, r) => s + Number(r.cantidad ?? 0), 0),
      clientes:    clientes    ?? 0,
      ingreso:     ingresosPedidos + ingresosVentas,
    })
    setCargando(false)
  }

  useEffect(() => {
    cargar()

    const canal = supabase
      .channel('admin-resumen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos'     }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas_ruta' }, cargar)
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [supabase])

  const CARDS = [
    { label: 'Pedidos pendientes', value: cards.pendientes,  color: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', icon: '⏳' },
    { label: 'En ruta ahora',      value: cards.en_ruta,     color: 'bg-blue-50 border-blue-200',     text: 'text-blue-700',   icon: '🚚' },
    { label: 'Entregados hoy',     value: cards.entregados,  color: 'bg-green-50 border-green-200',   text: 'text-green-700',  icon: '✅' },
    { label: 'Garrafones ruta hoy',value: cards.ventas_ruta, color: 'bg-purple-50 border-purple-200', text: 'text-purple-700', icon: '🛣️' },
    { label: 'Clientes activos',   value: cards.clientes,    color: 'bg-gray-50 border-gray-200',     text: 'text-gray-700',   icon: '👥' },
    { label: 'Ingreso hoy',        value: `$${cards.ingreso}`,color:'bg-emerald-50 border-emerald-200',text:'text-emerald-700', icon: '💰' },
  ]

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-gray-400 text-sm">Cargando...</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-5">Resumen del día</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {CARDS.map(c => (
          <div key={c.label} className={`rounded-2xl border p-4 ${c.color}`}>
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className={`text-3xl font-bold ${c.text}`}>{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
