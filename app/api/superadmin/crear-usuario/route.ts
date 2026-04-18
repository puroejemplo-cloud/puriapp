import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const supabase = getSupabaseAdmin()

  // Verificar que quien llama es super_admin
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const { data: { user: caller } } = await supabase.auth.getUser(token)
  if (caller?.user_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { email, password, role, purificadoraId, nombre } = await request.json()

  if (!email || !password || !role || !purificadoraId) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { role, purificadora_id: purificadoraId, nombre: nombre ?? '' },
    email_confirm: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si es repartidor, crear registro en tabla repartidores
  if (role === 'repartidor' && nombre) {
    await supabase.from('repartidores').insert({
      nombre,
      user_id:         data.user.id,
      purificadora_id: purificadoraId,
    })
  }

  return NextResponse.json({ ok: true, userId: data.user.id })
}
