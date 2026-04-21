'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { crearClienteBrowser } from '@/lib/supabase-browser'
import { activarPushAdmin, pushAdminActivo } from '@/lib/push-admin'

const NAV = [
  { href: '/admin',              label: '📊 Resumen'       },
  { href: '/admin/pedidos',      label: '📦 Pedidos'       },
  { href: '/admin/clientes',     label: '👥 Clientes'      },
  { href: '/admin/ventas-ruta',  label: '🛣️ Ventas ruta'  },
  { href: '/admin/repartidores', label: '🚚 Repartidores'  },
  { href: '/admin/relleno',      label: '💧 Rellenadora'   },
  { href: '/admin/ruta',         label: '🗺 Ruta'          },
  { href: '/admin/contabilidad', label: '💰 Contabilidad'  },
  { href: '/admin/reportes',     label: '📈 Reportes'      },
  { href: '/admin/configuracion',label: '⚙️ Config'        },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => crearClienteBrowser(), [])

  const [email,          setEmail]          = useState('')
  const [userId,         setUserId]         = useState('')
  const [purificadoraId, setPurificadoraId] = useState('')
  const [logoUrl,        setLogoUrl]        = useState<string | null>(null)
  const [verificando,    setVerificando]    = useState(true)

  // Push
  const [pushActivo,    setPushActivo]    = useState(false)
  const [activandoPush, setActivandoPush] = useState(false)

  // Copiar URL
  const [urlCopiada, setUrlCopiada] = useState(false)

  useEffect(() => {
    async function verificar() {
      await supabase.auth.refreshSession().catch(() => {})
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.user_metadata?.role !== 'admin') {
        router.replace('/login')
        return
      }
      setEmail(user.email ?? 'Admin')
      setUserId(user.id)
      const puriId = user.user_metadata?.purificadora_id ?? ''
      setPurificadoraId(puriId)
      setPushActivo(pushAdminActivo())

      // Cargar logo si existe
      if (puriId) {
        const { data: cfgLogo } = await supabase
          .from('configuracion')
          .select('valor')
          .eq('clave', 'logo_url')
          .eq('purificadora_id', puriId)
          .maybeSingle()
        if (cfgLogo?.valor) setLogoUrl(cfgLogo.valor as string)
      }

      setVerificando(false)
    }
    verificar()

    // Mantener JWT fresco mientras el admin está en el panel
    const jwtTimer = setInterval(() => {
      supabase.auth.refreshSession().catch(() => {})
    }, 50 * 60 * 1000)

    return () => clearInterval(jwtTimer)
  }, [supabase, router])

  async function salir() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  async function activarNotificaciones() {
    if (!userId || !purificadoraId) return
    setActivandoPush(true)
    const resultado = await activarPushAdmin(userId, purificadoraId)
    setActivandoPush(false)
    if (resultado === 'ok') setPushActivo(true)
    else if (resultado === 'permiso_denegado') alert('Permiso de notificaciones denegado. Actívalo en la configuración del navegador.')
    else if (resultado === 'no_soportado') alert('Tu navegador no soporta notificaciones push.')
  }

  function copiarUrlPedidos() {
    if (!purificadoraId) return
    const url = `${window.location.origin}/pedido/${purificadoraId}`
    navigator.clipboard.writeText(url).then(() => {
      setUrlCopiada(true)
      setTimeout(() => setUrlCopiada(false), 2000)
    })
  }

  if (verificando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-400 text-sm">Verificando acceso...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded-lg object-cover" />
              : <span className="text-xl">💧</span>
            }
            <span className="font-bold text-gray-800 text-sm">Purificadora Admin</span>
            <span className="text-xs text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">v1.3.0</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="hidden sm:inline text-xs">{email}</span>

            {/* Botón copiar URL de pedidos */}
            {purificadoraId && (
              <button
                onClick={copiarUrlPedidos}
                title={`Copiar enlace: /pedido/${purificadoraId}`}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition font-medium ${
                  urlCopiada
                    ? 'bg-green-100 text-green-700'
                    : 'bg-sky-50 text-sky-600 hover:bg-sky-100'
                }`}
              >
                {urlCopiada ? '✅ Copiado' : '🔗 URL pedidos'}
              </button>
            )}

            {/* Botón activar notificaciones push */}
            <button
              onClick={activarNotificaciones}
              disabled={activandoPush || pushActivo}
              title={pushActivo ? 'Notificaciones activas' : 'Activar notificaciones de nuevos pedidos'}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition font-medium ${
                pushActivo
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {activandoPush ? '⏳' : pushActivo ? '🔔 Activo' : '🔕 Notifs'}
            </button>

            <button onClick={salir} className="text-red-500 hover:underline text-sm">
              Salir
            </button>
          </div>
        </div>

        {/* Tabs de navegación */}
        <nav className="max-w-7xl mx-auto px-2 flex overflow-x-auto">
          {NAV.map(item => {
            const activo = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activo
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
