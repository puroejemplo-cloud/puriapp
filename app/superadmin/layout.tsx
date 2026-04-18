'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { crearClienteBrowser } from '@/lib/supabase-browser'

const NAV = [
  { href: '/superadmin', label: '🏭 Purificadoras' },
]

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => crearClienteBrowser(), [])
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.user_metadata?.role !== 'super_admin') {
        router.replace('/login')
        return
      }
      setVerificando(false)
    })
  }, [supabase, router])

  if (verificando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-400 text-sm">Verificando acceso...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-bold text-sm">Super Admin</span>
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.replace('/login'))}
            className="text-gray-400 hover:text-white text-sm"
          >
            Salir
          </button>
        </div>
        <nav className="max-w-7xl mx-auto px-2 flex">
          {NAV.map(item => {
            const activo = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activo ? 'border-yellow-400 text-yellow-300' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
