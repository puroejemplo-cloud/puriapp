import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Convierte nombre a slug simple: minúsculas, sin espacios ni caracteres especiales
function slugify(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

// Genera contraseña aleatoria de 10 caracteres
function generarPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(request: NextRequest) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const supabase = getSupabaseAdmin()

  // Verificar que es admin
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const purificadoraId: string | null = user?.user_metadata?.purificadora_id ?? null
  if (!purificadoraId) {
    return NextResponse.json({ error: 'Sin purificadora asignada' }, { status: 400 })
  }

  const { nombre, telefono } = await request.json()
  if (!nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  }

  // Obtener nombre de la purificadora para generar el email
  const { data: purificadora } = await supabase
    .from('purificadoras')
    .select('nombre')
    .eq('id', purificadoraId)
    .maybeSingle()

  const slugPuri   = slugify(purificadora?.nombre ?? 'purificadora')
  const slugNombre = slugify(nombre.trim())
  const email = `${slugPuri}+${slugNombre}@${slugPuri}.com`
  const password = generarPassword()

  // Crear usuario en Supabase Auth
  const { data: nuevoUsuario, error: errAuth } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'repartidor',
      purificadora_id: purificadoraId,
    },
  })

  if (errAuth) {
    return NextResponse.json({ error: errAuth.message }, { status: 500 })
  }

  // Insertar en tabla repartidores vinculando el user_id
  const { error: errRep } = await supabase.from('repartidores').insert({
    nombre:          nombre.trim(),
    telefono:        telefono?.trim() || null,
    activo:          true,
    user_id:         nuevoUsuario.user.id,
    purificadora_id: purificadoraId,
  })

  if (errRep) {
    // Revertir: eliminar el usuario auth creado
    await supabase.auth.admin.deleteUser(nuevoUsuario.user.id)
    return NextResponse.json({ error: errRep.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email, password })
}
