'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { crearClienteBrowser } from '@/lib/supabase-browser'

export default function RellenoLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const supabase = useMemo(() => crearClienteBrowser(), [])
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    async function verificar() {
      // Intentar hasta 3 veces en caso de race condition post-login
      for (let intento = 0; intento < 3; intento++) {
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user?.user_metadata?.role === 'relleno') {
            setVerificando(false)
            return
          }
          // Sesión válida pero rol incorrecto — redirigir de inmediato
          router.replace('/login')
          return
        }

        // Sin sesión aún, esperar un poco y reintentar
        if (intento < 2) await new Promise(r => setTimeout(r, 400))
      }

      // Sin sesión tras 3 intentos
      router.replace('/login')
    }
    verificar()
  }, [supabase, router])

  if (verificando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-sky-50">
        <p className="text-gray-400 text-sm">Verificando acceso...</p>
      </div>
    )
  }

  return <>{children}</>
}
