'use client'

import { useEffect, useState, useMemo } from 'react'
import { crearClienteBrowser } from '@/lib/supabase-browser'
import { distanciaKm } from '@/lib/distancia'

type Repartidor = { id: string; nombre: string }

type Pedido = {
  id:            string
  estado:        'pendiente' | 'en_ruta' | 'entregado' | 'cancelado'
  cantidad:      number
  total:         number
  notas:         string | null
  created_at:    string
  clientes:      { nombre: string; telefono: string; direccion: string; lat: number | null; lng: number | null } | null
  repartidores:  { nombre: string; lat: number | null; lng: number | null } | null
}

type NuevoPedidoForm = {
  nombre:       string
  telefono:     string
  direccion:    string
  urlUbicacion: string
  cantidad:     number
  notas:        string
  repartidorId: string
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

// Extrae lat/lng de una URL de Google Maps
function parsearUbicacion(url: string): { lat: number; lng: number } | null {
  if (!url.trim()) return null
  // Formato: /@lat,lng,zoom  (el más común al compartir desde Google Maps)
  const atMatch = url.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/)
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) }
  // Formato: ?q=lat,lng
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/)
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) }
  return null
}

const FORM_VACIO: NuevoPedidoForm = {
  nombre: '', telefono: '', direccion: '', urlUbicacion: '',
  cantidad: 1, notas: '', repartidorId: '',
}

export default function AdminPedidos() {
  const supabase = useMemo(() => crearClienteBrowser(), [])
  const [pedidos, setPedidos]           = useState<Pedido[]>([])
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [filtro, setFiltro]             = useState<Filtro>('todos')
  const [cargando, setCargando]         = useState(true)

  const [modalAbierto, setModalAbierto]       = useState(false)
  const [form, setForm]                       = useState<NuevoPedidoForm>(FORM_VACIO)
  const [guardando, setGuardando]             = useState(false)
  const [errorForm, setErrorForm]             = useState('')
  const [urlValida, setUrlValida]             = useState<boolean | null>(null)
  const [precioPedido, setPrecioPedido]       = useState(35)
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [clienteEncontrado, setClienteEncontrado] = useState<boolean | null>(null)

  async function cargar() {
    let q = supabase
      .from('pedidos')
      .select('id, estado, cantidad, total, notas, created_at, clientes(nombre,telefono,direccion,lat,lng), repartidores(nombre,lat,lng)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filtro !== 'todos') q = q.eq('estado', filtro)

    const { data } = await q
    setPedidos((data as unknown as Pedido[]) ?? [])
    setCargando(false)
  }

  useEffect(() => {
    supabase.from('repartidores').select('id, nombre').eq('activo', true)
      .then(({ data }) => {
        const lista = data ?? []
        setRepartidores(lista)
        // Seleccionar el primero por default si existe
        if (lista.length > 0) {
          setForm(f => ({ ...f, repartidorId: lista[0].id }))
        }
      })

    // Cargar precio real desde configuracion
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const res = await fetch('/api/admin/configuracion', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const json = await res.json()
      const rows: { clave: string; valor: Record<string, number> }[] = json.data ?? []
      const precio = rows.find(r => r.clave === 'precios')?.valor?.pedido
      if (precio) setPrecioPedido(precio)
    })
  }, [supabase])

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel('admin-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, filtro])

  async function cambiarEstado(id: string, estado: string) {
    const extra = estado === 'entregado' ? { entregado_at: new Date().toISOString() } : {}
    await supabase.from('pedidos').update({ estado, ...extra }).eq('id', id)
  }

  async function asignarRepartidor(id: string, repartidorId: string) {
    await supabase.from('pedidos').update({ repartidor_id: repartidorId, estado: 'en_ruta' }).eq('id', id)
  }

  function setField<K extends keyof NuevoPedidoForm>(k: K, v: NuevoPedidoForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function onUrlChange(url: string) {
    setField('urlUbicacion', url)
    if (!url.trim()) { setUrlValida(null); return }
    setUrlValida(parsearUbicacion(url) !== null)
  }

  function abrirModal() {
    setModalAbierto(true)
    setErrorForm('')
    setUrlValida(null)
    setClienteEncontrado(null)
    // Preservar repartidor por default si ya hay uno seleccionado
    setForm(f => ({ ...FORM_VACIO, repartidorId: f.repartidorId }))
  }

  async function buscarClientePorTelefono(telRaw: string) {
    if (!telRaw.trim()) { setClienteEncontrado(null); return }
    let tel = telRaw.trim().replace(/\s/g, '')
    if (!tel.startsWith('+')) tel = '+52' + tel.replace(/^52/, '')

    setBuscandoCliente(true)
    const { data } = await supabase
      .from('clientes')
      .select('nombre, direccion')
      .eq('telefono', tel)
      .maybeSingle()
    setBuscandoCliente(false)

    if (data) {
      setClienteEncontrado(true)
      setForm(f => ({ ...f, nombre: data.nombre ?? '', direccion: data.direccion ?? '' }))
    } else {
      setClienteEncontrado(false)
    }
  }

  async function crearPedido() {
    setErrorForm('')
    if (!form.nombre.trim())    return setErrorForm('El nombre es requerido')
    if (!form.telefono.trim())  return setErrorForm('El teléfono es requerido')
    if (!form.direccion.trim()) return setErrorForm('La dirección es requerida')
    if (form.cantidad < 1)      return setErrorForm('La cantidad debe ser al menos 1')

    let tel = form.telefono.trim().replace(/\s/g, '')
    if (!tel.startsWith('+')) tel = '+52' + tel.replace(/^52/, '')

    // Parsear coords de la URL si se proporcionó
    const coords = parsearUbicacion(form.urlUbicacion)

    setGuardando(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/pedido', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        nombre:      form.nombre.trim(),
        telefono:    tel,
        direccion:   form.direccion.trim(),
        cantidad:    form.cantidad,
        notas:       form.notas.trim() || null,
        lat:         coords?.lat ?? null,
        lng:         coords?.lng ?? null,
        repartidorId: form.repartidorId || null,
      }),
    })

    const json = await res.json()
    setGuardando(false)

    if (!res.ok) {
      setErrorForm(json.error ?? 'Error al crear el pedido')
      return
    }

    setModalAbierto(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Pedidos</h1>
        <button
          onClick={abrirModal}
          className="bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-4 py-2 rounded-xl"
        >
          + Nuevo pedido
        </button>
      </div>

      {/* Filtros */}
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
                  <p className="text-xs text-gray-500 mt-0.5">
                    🚚 {p.repartidores.nombre}
                    {p.repartidores.lat && p.clientes?.lat && (
                      <span className="ml-1.5 text-sky-500 font-medium">
                        · {distanciaKm(p.repartidores.lat, p.repartidores.lng!, p.clientes.lat, p.clientes.lng!).toFixed(1)} km
                      </span>
                    )}
                  </p>
                )}
                {p.notas && <p className="text-xs text-gray-400 mt-0.5 italic">{p.notas}</p>}
                <p className="text-xs text-gray-300 mt-1">
                  {new Date(p.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            </div>

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
                <button
                  onClick={() => cambiarEstado(p.id, 'entregado')}
                  className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg"
                >
                  Marcar entregado
                </button>
                {p.clientes?.telefono && (
                  <a
                    href={`tel:${p.clientes.telefono}`}
                    className="text-xs bg-sky-50 text-sky-600 border border-sky-200 px-3 py-1.5 rounded-lg"
                  >
                    📞 Llamar
                  </a>
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

      {/* Modal nuevo pedido */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Nuevo pedido</h2>

            <div className="space-y-3">

              {/* Repartidor */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Repartidor asignado</label>
                <select
                  value={form.repartidorId}
                  onChange={e => setField('repartidorId', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                >
                  <option value="">Sin asignar (quedará pendiente)</option>
                  {repartidores.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Teléfono — llave primaria del cliente */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Teléfono *</label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="5512345678"
                    value={form.telefono}
                    onChange={e => { setField('telefono', e.target.value); setClienteEncontrado(null) }}
                    onBlur={e => buscarClientePorTelefono(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 pr-8"
                  />
                  {buscandoCliente && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">…</span>
                  )}
                </div>
                {clienteEncontrado === true  && <p className="text-xs text-green-600 mt-0.5">✓ Cliente encontrado — datos cargados</p>}
                {clienteEncontrado === false && <p className="text-xs text-gray-400 mt-0.5">Cliente nuevo — completa los datos</p>}
                {clienteEncontrado === null  && <p className="text-xs text-gray-400 mt-0.5">Se agrega +52 si no incluyes código de país</p>}
              </div>

              {/* Nombre */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nombre del cliente *</label>
                <input
                  type="text"
                  placeholder="Juan Pérez"
                  value={form.nombre}
                  onChange={e => setField('nombre', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>

              {/* Dirección */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Dirección *</label>
                <input
                  type="text"
                  placeholder="Calle Agua 123, Col. Centro"
                  value={form.direccion}
                  onChange={e => setField('direccion', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>

              {/* URL de ubicación */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  URL de ubicación (Google Maps)
                  <span className="text-gray-400 font-normal ml-1">— opcional</span>
                </label>
                <input
                  type="url"
                  placeholder="https://maps.google.com/..."
                  value={form.urlUbicacion}
                  onChange={e => onUrlChange(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 ${
                    urlValida === false ? 'border-red-300' :
                    urlValida === true  ? 'border-green-400' :
                    'border-gray-200'
                  }`}
                />
                {urlValida === true  && <p className="text-xs text-green-600 mt-0.5">✓ Coordenadas detectadas</p>}
                {urlValida === false && <p className="text-xs text-red-500 mt-0.5">No se encontraron coordenadas en esta URL</p>}
                {urlValida === null  && <p className="text-xs text-gray-400 mt-0.5">Pega la URL que aparece al compartir desde Google Maps</p>}
              </div>

              {/* Garrafones */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Garrafones *</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setField('cantidad', Math.max(1, form.cantidad - 1))}
                    className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-xl font-bold text-gray-600 flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="text-2xl font-bold text-sky-600 w-10 text-center">{form.cantidad}</span>
                  <button
                    onClick={() => setField('cantidad', form.cantidad + 1)}
                    className="w-10 h-10 rounded-full bg-sky-100 hover:bg-sky-200 text-xl font-bold text-sky-600 flex items-center justify-center"
                  >
                    +
                  </button>
                  <span className="text-sm text-gray-500">× ${precioPedido} = <strong>${form.cantidad * precioPedido}</strong></span>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Notas (opcional)</label>
                <input
                  type="text"
                  placeholder="Casa blanca, portón azul..."
                  value={form.notas}
                  onChange={e => setField('notas', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>

              {errorForm && (
                <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{errorForm}</p>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setModalAbierto(false)}
                className="flex-1 border-2 border-gray-200 hover:bg-gray-50 py-2.5 rounded-xl text-gray-600 font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={crearPedido}
                disabled={guardando}
                className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm"
              >
                {guardando ? 'Creando...' : 'Crear pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
