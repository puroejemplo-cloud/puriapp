'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { crearClienteBrowser } from '@/lib/supabase-browser'

export default function RellenoLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter()
  const supabase = useMemo(() => crearClienteBrowser(), [])

  useEffect(() => {
    async function verificar() {
      await supabase.auth.refreshSession().catch(() => {})
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.user_metadata?.role !== 'relleno') {
        router.replace('/login')
      }
    }
    verificar()
  }, [supabase, router])

  return <>{children}</>
}
