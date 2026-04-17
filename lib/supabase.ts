import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cliente normal: usado en el navegador y en rutas de servidor sin privilegios elevados
export const supabase = createClient(url, anonKey)

// Cliente admin: usado solo en rutas de servidor (webhooks, push, etc.)
// NUNCA lo exportes al cliente — usa solo en archivos route.ts o server actions
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
