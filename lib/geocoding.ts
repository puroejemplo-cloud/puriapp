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

// Convierte centro + radio a viewbox para Nominatim (oeste,norte,este,sur)
function calcularViewbox(zona: ZonaGeocoding): string {
  const deltaLat = zona.radio_km / 111
  const deltaLng = zona.radio_km / (111 * Math.cos((zona.lat * Math.PI) / 180))
  const oeste = zona.lng - deltaLng
  const este  = zona.lng + deltaLng
  const norte = zona.lat + deltaLat
  const sur   = zona.lat - deltaLat
  return `${oeste},${norte},${este},${sur}`
}

export async function geocodificar(
  direccion: string,
  zona?: ZonaGeocoding | null
): Promise<Coordenadas | null> {
  const params: Record<string, string> = {
    q:            direccion,
    format:       'json',
    limit:        '1',
    countrycodes: 'mx',
  }

  if (zona?.lat && zona?.lng) {
    params.viewbox  = calcularViewbox(zona)
    params.bounded  = '1'
  }

  const respuesta = await fetch(
    `https://nominatim.openstreetmap.org/search?${new URLSearchParams(params)}`,
    { headers: { 'User-Agent': 'PurificadoraApp/1.0' } }
  )

  if (!respuesta.ok) return null

  const datos = await respuesta.json()
  if (!datos.length) return null

  const primero = datos[0]
  return {
    lat: parseFloat(primero.lat),
    lng: parseFloat(primero.lon),
    direccionFormateada: primero.display_name,
  }
}
