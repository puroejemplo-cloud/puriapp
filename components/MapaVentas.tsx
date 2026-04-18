'use client'

import { useEffect, useRef } from 'react'

export type PuntoMapa = {
  lat:      number
  lng:      number
  nombre:   string
  direccion: string
  cantidad: number
  hora:     number   // 0–23
  fecha:    string
}

// Colores según franja horaria
function colorHora(hora: number): string {
  if (hora >= 6  && hora < 12) return '#f59e0b'  // mañana — amarillo
  if (hora >= 12 && hora < 17) return '#f97316'  // tarde  — naranja
  if (hora >= 17 && hora < 21) return '#3b82f6'  // noche  — azul
  return '#8b5cf6'                                // madrugada — morado
}

function etiquetaHora(hora: number): string {
  if (hora >= 6  && hora < 12) return 'Mañana (6–12 h)'
  if (hora >= 12 && hora < 17) return 'Tarde (12–17 h)'
  if (hora >= 17 && hora < 21) return 'Noche (17–21 h)'
  return 'Madrugada (0–6 h)'
}

interface Props {
  puntos:  PuntoMapa[]
  centro?: { lat: number; lng: number }
}

export default function MapaVentas({ puntos, centro }: Props) {
  const divRef   = useRef<HTMLDivElement>(null)
  const mapaRef  = useRef<unknown>(null)

  useEffect(() => {
    if (!divRef.current || puntos.length === 0) return

    // Carga dinámica de Leaflet (solo en cliente)
    import('leaflet').then(L => {
      // Corregir íconos de Leaflet con Webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      // Destruir mapa previo si existe
      if (mapaRef.current) {
        (mapaRef.current as ReturnType<typeof L.map>).remove()
        mapaRef.current = null
      }

      // Centro: primero el prop, luego el promedio de los puntos
      const lat = centro?.lat ?? puntos.reduce((s, p) => s + p.lat, 0) / puntos.length
      const lng = centro?.lng ?? puntos.reduce((s, p) => s + p.lng, 0) / puntos.length

      const mapa = L.map(divRef.current!).setView([lat, lng], 14)
      mapaRef.current = mapa

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapa)

      // Punto de inicio (purificadora)
      if (centro) {
        L.circleMarker([centro.lat, centro.lng], {
          radius: 10, color: '#0ea5e9', fillColor: '#0ea5e9',
          fillOpacity: 1, weight: 3,
        })
          .bindPopup('<b>📍 Purificadora</b><br>Punto de inicio')
          .addTo(mapa)
      }

      // Círculos de ventas
      puntos.forEach(p => {
        const color  = colorHora(p.hora)
        const radio  = 6 + p.cantidad * 2   // más garrafones = círculo más grande
        const etiq   = etiquetaHora(p.hora)
        const hora12 = p.hora % 12 || 12
        const ampm   = p.hora < 12 ? 'AM' : 'PM'

        L.circleMarker([p.lat, p.lng], {
          radius: radio, color, fillColor: color,
          fillOpacity: 0.75, weight: 2,
        })
          .bindPopup(`
            <div style="font-size:13px;line-height:1.5">
              <b>${p.nombre}</b><br>
              📍 ${p.direccion}<br>
              🫙 ${p.cantidad} garrafón${p.cantidad > 1 ? 'es' : ''}<br>
              🕐 ${hora12}:00 ${ampm} — ${etiq}<br>
              📅 ${new Date(p.fecha).toLocaleDateString('es-MX')}
            </div>
          `)
          .addTo(mapa)
      })

      // Ajustar vista para mostrar todos los puntos
      if (puntos.length > 1) {
        const bounds = L.latLngBounds(puntos.map(p => [p.lat, p.lng]))
        mapa.fitBounds(bounds, { padding: [40, 40] })
      }
    })

    return () => {
      if (mapaRef.current) {
        (mapaRef.current as { remove: () => void }).remove()
        mapaRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puntos, centro])

  if (puntos.length === 0) {
    return (
      <div className="h-80 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 text-sm">
        Sin puntos con ubicación para mostrar
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 px-1">
        {[
          { color: '#f59e0b', label: 'Mañana (6–12 h)' },
          { color: '#f97316', label: 'Tarde (12–17 h)' },
          { color: '#3b82f6', label: 'Noche (17–21 h)' },
          { color: '#8b5cf6', label: 'Madrugada' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </div>
        ))}
        <div className="text-xs text-gray-400 ml-auto">Tamaño = cantidad de garrafones</div>
      </div>

      {/* Mapa */}
      <div ref={divRef} className="h-96 rounded-2xl overflow-hidden border border-gray-200 z-0" />
    </div>
  )
}
