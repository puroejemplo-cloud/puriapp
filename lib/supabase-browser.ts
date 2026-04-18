import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Adaptador que guarda la sesión en cookies del navegador (no localStorage)
const cookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(key)}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : null
  },
  setItem: (key: string, value: string): void => {
    if (typeof document === 'undefined') return
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
    const secure  = location.protocol === 'https:' ? ';Secure' : ''
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)};path=/;expires=${expires};SameSite=Lax${secure}`
  },
  removeItem: (key: string): void => {
    if (typeof document === 'undefined') return
    document.cookie = `${encodeURIComponent(key)}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT;SameSite=Lax`
  },
}

// Singleton a nivel de módulo — misma instancia en toda la app
let _cliente: SupabaseClient | null = null

export function crearClienteBrowser(): SupabaseClient {
  if (_cliente) return _cliente

  _cliente = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage:          cookieStorage,
        persistSession:   true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }
  )

  return _cliente
}
