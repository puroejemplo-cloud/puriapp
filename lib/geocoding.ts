// Geocodificación con Nominatim (OpenStreetMap) — gratis, sin API key
// Límite: 1 solicitud por segundo. Siempre incluir User-Agent.

export interface Coordenadas {
  lat: number
  lng: number
  direccionFormateada: string
}

export async function geocodificar(
  direccion: string
): Promise<Coordenadas | null> {
  const params = new URLSearchParams({
    q: direccion,
    format: 'json',
    limit: '1',
    countrycodes: 'mx', // Prioriza resultados en México
  })

  const respuesta = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        'User-Agent': 'PurificadoraApp/1.0',
      },
    }
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
