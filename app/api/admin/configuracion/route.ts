import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getUser(request: NextRequest) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const supabase = getSupabaseAdmin()
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  return { supabase, user }
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await getUser(request)
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const purificadoraId: string | null = user?.user_metadata?.purificadora_id ?? null
  if (!purificadoraId) {
    return NextResponse.json({ error: 'Sin purificadora asignada' }, { status: 400 })
  }

  const [{ data }, { data: puri }] = await Promise.all([
    supabase.from('configuracion').select('clave, valor').eq('purificadora_id', purificadoraId),
    supabase.from('purificadoras').select('slug').eq('id', purificadoraId).single(),
  ])

  return NextResponse.json({ data: data ?? [], slug: puri?.slug ?? null })
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUser(request)
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const purificadoraId: string | null = user?.user_metadata?.purificadora_id ?? null
  if (!purificadoraId) {
    return NextResponse.json({ error: 'Sin purificadora asignada' }, { status: 400 })
  }

  const { clave, valor } = await request.json()
  if (!clave || valor === undefined) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  }

  // El slug se guarda directamente en la tabla purificadoras
  if (clave === 'slug') {
    const slug = (valor as string).trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (slug.length < 3) return NextResponse.json({ error: 'El slug debe tener al menos 3 caracteres' }, { status: 400 })

    // Verificar que no esté en uso por otra purificadora
    const { data: existeSlug } = await supabase
      .from('purificadoras').select('id').eq('slug', slug).maybeSingle()
    if (existeSlug && existeSlug.id !== purificadoraId) {
      return NextResponse.json({ error: 'Ese nombre ya está en uso, elige otro' }, { status: 409 })
    }

    const { error } = await supabase.from('purificadoras').update({ slug }).eq('id', purificadoraId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, slug })
  }

  // Buscar si ya existe la fila para esta purificadora
  const { data: existente } = await supabase
    .from('configuracion')
    .select('id')
    .eq('clave', clave)
    .eq('purificadora_id', purificadoraId)
    .maybeSingle()

  if (existente?.id) {
    const { error } = await supabase
      .from('configuracion')
      .update({ valor })
      .eq('id', existente.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('configuracion')
      .insert({ clave, valor, purificadora_id: purificadoraId })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
