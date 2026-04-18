import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Cliente admin lazy — se crea solo cuando se llama, no en el import.
// Esto evita que Next.js truene durante el build al no tener las env vars.
let _admin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin
  _admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  return _admin
}
