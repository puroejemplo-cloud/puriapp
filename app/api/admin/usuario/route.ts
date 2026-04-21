import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function generarPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function verificarAdmin(request: NextRequest) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const supabase = getSupabaseAdmin()
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'super_admin') return null
  return { supabase, adminUser: user }
}

// POST { userIds: string[] } → [{ id, email }]
export async function POST(request: NextRequest) {
  const ctx = await verificarAdmin(request)
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { supabase } = ctx

  const { userIds } = await request.json()
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json([])
  }

  const resultados = await Promise.all(
    userIds.map(async (id: string) => {
      const { data } = await supabase.auth.admin.getUserById(id)
      return { id, email: data?.user?.email ?? null }
    })
  )

  return NextResponse.json(resultados)
}

// PATCH { userId } → { email, password } — genera y aplica nueva contraseña
export async function PATCH(request: NextRequest) {
  const ctx = await verificarAdmin(request)
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { supabase } = ctx

  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'Falta userId' }, { status: 400 })

  const password = generarPassword()

  const { data, error } = await supabase.auth.admin.updateUserById(userId, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, email: data.user.email, password })
}
