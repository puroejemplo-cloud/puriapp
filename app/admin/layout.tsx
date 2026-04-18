'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { crearClienteBrowser } from '@/lib/supabase-browser'

const NAV = [
  { href: '/admin',              label: '📊 Resumen'       },
  { href: '/admin/pedidos',      label: '📦 Pedidos'       },
  { href: '/admin/clientes',     label: '👥 Clientes'      },
  { href: '/admin/ventas-ruta',  label: '🛣️ Ventas ruta'  },
  { href: '/admin/repartidores',   label: '🚚 Repartidores'  },
  { href: '/admin/ruta',            label: '🗺 Ruta'           },
  { href: '/admin/contabilidad',   label: '💰 Contabilidad'   },
  { href: '/admin/configuracion',  label: '⚙️ Config'        },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => crearClienteBrowser(), [])
  const [email, setEmail]         = useState('')
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    async function verificar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.user_metadata?.role !== 'admin') {
        router.replace('/login')
        return
      }
      setEmail(user.email ?? 'Admin')
      setVerificando(false)
    }
    verificar()
  }, [supabase, router])

  async function salir() {
    await supabase.auth.signOut()
    router.replace('/login')
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
            <span className="text-xl">💧</span>
            <span className="font-bold text-gray-800 text-sm">Purificadora Admin</span>
            <span className="text-xs text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">v1.3.0</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="hidden sm:inline">{email}</span>
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
