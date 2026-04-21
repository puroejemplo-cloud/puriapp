import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function slugify(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function generarPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function GET(request: NextRequest) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const supabase = getSupabaseAdmin()

  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const purificadoraId = user?.user_metadata?.purificadora_id
  if (!purificadoraId) return NextResponse.json({ error: 'Sin purificadora' }, { status: 400 })

  const { data, error } = await supabase
    .from('relleno_operadores')
    .select('*')
    .eq('purificadora_id', purificadoraId)
    .order('nombre')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const supabase = getSupabaseAdmin()

  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const purificadoraId: string | null = user?.user_metadata?.purificadora_id ?? null
  if (!purificadoraId) return NextResponse.json({ error: 'Sin purificadora asignada' }, { status: 400 })

  const { nombre } = await request.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  const { data: purificadora } = await supabase
    .from('purificadoras')
    .select('nombre')
    .eq('id', purificadoraId)
    .maybeSingle()

  const slugPuri   = slugify(purificadora?.nombre ?? 'purificadora')
  const slugNombre = slugify(nombre.trim())
  const email      = `${slugPuri}+relleno${slugNombre}@purificadora.com`
  const password   = generarPassword()

  const { data: nuevoUsuario, error: errAuth } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role:            'relleno',
      purificadora_id: purificadoraId,
    },
  })

  if (errAuth) return NextResponse.json({ error: errAuth.message }, { status: 500 })

  const { error: errOp } = await supabase.from('relleno_operadores').insert({
    nombre:          nombre.trim(),
    user_id:         nuevoUsuario.user.id,
    purificadora_id: purificadoraId,
    activo:          true,
  })

  if (errOp) {
    await supabase.auth.admin.deleteUser(nuevoUsuario.user.id)
    return NextResponse.json({ error: errOp.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email, password })
}

export async function PATCH(request: NextRequest) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const supabase = getSupabaseAdmin()

  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id, activo } = await request.json()
  const { error } = await supabase.from('relleno_operadores').update({ activo }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
