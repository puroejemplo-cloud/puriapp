import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Tiempo máximo 5 minutos — Nominatim 1 req/seg
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const { reverseGeocode }   = await import('@/lib/geocoding')
  const supabase = getSupabaseAdmin()

  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Clientes con coords pero sin colonia o municipio
  const { data: clientes, error } = await supabase
    .from('clientes')
    .select('id, lat, lng')
    .not('lat', 'is', null)
    .or('colonia.is.null,municipio.is.null')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!clientes?.length) return NextResponse.json({ ok: true, actualizados: 0 })

  let actualizados = 0
  for (const c of clientes) {
    const { municipio, colonia } = await reverseGeocode(c.lat!, c.lng!)
    if (municipio || colonia) {
      await supabase.from('clientes')
        .update({ ...(municipio && { municipio }), ...(colonia && { colonia }) })
        .eq('id', c.id)
      actualizados++
    }
    // Respetar rate limit de Nominatim: 1 req/seg
    await new Promise(r => setTimeout(r, 1100))
  }

  return NextResponse.json({ ok: true, actualizados, total: clientes.length })
}
