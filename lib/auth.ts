import { crearClienteBrowser } from './supabase-browser'

// Verifica si el usuario autenticado tiene rol de admin
export async function esAdmin(): Promise<boolean> {
  const supabase = crearClienteBrowser()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.user_metadata?.role === 'admin'
}
