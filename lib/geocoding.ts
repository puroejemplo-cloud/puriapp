// Geocodificación con Nominatim (OpenStreetMap) — gratis, sin API key
// Límite: 1 solicitud por segundo. Siempre incluir User-Agent.

export interface Coordenadas {
  lat: number
  lng: number
  direccionFormateada: string
}

export interface ZonaGeocoding {
  lat: number
  lng: number
  radio_km: number
}

function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calcularViewbox(zona: ZonaGeocoding): string {
  const deltaLat = zona.radio_km / 111
  const deltaLng = zona.radio_km / (111 * Math.cos((zona.lat * Math.PI) / 180))
  const oeste = zona.lng - deltaLng
  const este  = zona.lng + deltaLng
  const norte = zona.lat + deltaLat
  const sur   = zona.lat - deltaLat
  return `${oeste},${norte},${este},${sur}`
}

async function buscarEnNominatim(q: string, extra: Record<string, string> = {}): Promise<{ lat: string; lon: string; display_name: string }[] | null> {
  const params = new URLSearchParams({ q, format: 'json', limit: '3', countrycodes: 'mx', ...extra })
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'PurificadoraApp/1.0' },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function geocodificar(
  direccion: string,
  zona?: ZonaGeocoding | null
): Promise<Coordenadas | null> {

  // Intento 1: con viewbox como sugerencia (sin bounded para no excluir resultados)
  const extra1: Record<string, string> = {}
  if (zona?.lat && zona?.lng) {
    extra1.viewbox = calcularViewbox(zona)
    // No usamos bounded=1 para no descartar resultados cercanos al borde
  }
  let datos = await buscarEnNominatim(direccion, extra1)

  // Intento 2: sin restricción de zona si no hubo resultados
  if (!datos?.length && zona?.lat) {
    datos = await buscarEnNominatim(direccion)
  }

  if (!datos?.length) return null

  // Si hay zona configurada, elegir el resultado más cercano al centro dentro del radio
  if (zona?.lat && zona?.lng) {
    const dentroDeZona = datos.filter(d => {
      const km = distanciaKm(zona.lat, zona.lng, parseFloat(d.lat), parseFloat(d.lon))
      return km <= zona.radio_km
    })
    // Si ninguno cae dentro, devolver null para no guardar coords incorrectas
    if (!dentroDeZona.length) return null
    // Ordenar por cercanía al centro y tomar el primero
    dentroDeZona.sort((a, b) =>
      distanciaKm(zona.lat, zona.lng, parseFloat(a.lat), parseFloat(a.lon)) -
      distanciaKm(zona.lat, zona.lng, parseFloat(b.lat), parseFloat(b.lon))
    )
    const mejor = dentroDeZona[0]
    return { lat: parseFloat(mejor.lat), lng: parseFloat(mejor.lon), direccionFormateada: mejor.display_name }
  }

  const primero = datos[0]
  return {
    lat: parseFloat(primero.lat),
    lng: parseFloat(primero.lon),
    direccionFormateada: primero.display_name,
  }
}
