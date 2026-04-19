import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const supabase = getSupabaseAdmin()

  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })

  // Desvincular pedidos del cliente antes de eliminarlo
  await supabase.from('pedidos').update({ cliente_id: null }).eq('cliente_id', id)

  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
