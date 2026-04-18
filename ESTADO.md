# Estado del proyecto

**Última actualización:** 2026-04-17
**Última fase completada:** FASE 7 — Deploy a Vercel

---

## Qué se probó y funciona

### FASE 1 — Setup inicial ✅
- `npm run dev` arranca sin errores
- TypeScript compila limpio

### FASE 2 — Base de datos ✅
- 7 tablas creadas vía MCP Supabase
- Realtime activo en `pedidos` y `ventas_ruta`
- Productos semilla: Garrafón 20L $35, Botella 1L $10, Paquete 4x1L $35

### FASE 3 — Webhook WhatsApp ✅
- Webhook funcional con Twilio Sandbox
- Comandos: PEDIDO, ESTADO, CANCELAR, REGISTRO, AYUDA

### FASE 4 — PWA Repartidor ✅
- Login funcional (fix: `allowedDevOrigins` para acceso desde red local)
- Auth con cookies (no localStorage)
- GPS, Realtime, Haversine, botones Tomar/Navegar/Entregado

### FASE 5 — Ventas en ruta ✅
- Botón flotante verde `+` en pantalla del repartidor
- Modal con selector de cantidad +/−
- Campos opcionales: nombre, teléfono, dirección
- Precio consultado desde tabla `productos` (no hardcodeado)
- Opción "Agregar como cliente fijo" (aparece solo si hay teléfono)
- Geocodificación con Nominatim al convertir a cliente
- Resumen del día en header verde (garrafones + total $)
- Realtime actualiza el contador al guardar

### FASE 6 — Dashboard admin ✅
- `lib/auth.ts` — helper `esAdmin()` para verificar rol
- `app/admin/layout.tsx` — shell con nav tabs y auth check (redirige si no es admin)
- `app/admin/page.tsx` — 6 cards: pendientes, en ruta, entregados hoy, garrafones ruta, clientes activos, ingreso hoy; Realtime en tiempo real
- `app/admin/pedidos/page.tsx` — tabla filtrable por estado, asignar repartidor, marcar entregado, cancelar
- `app/admin/clientes/page.tsx` — CRUD completo con búsqueda, re-geocoding al cambiar dirección, toggle activo
- `app/admin/ventas-ruta/page.tsx` — listado con filtros hoy/semana/mes, totales de garrafones e ingreso
- `app/admin/repartidores/page.tsx` — alta de repartidores, toggle activo/inactivo, aviso si no tiene cuenta vinculada
- Usuario admin creado en Supabase: `admin@purificadora.com` / `admin123456` (role: admin)

---

## Qué falta probar

- Login con usuario admin y verificar que los tabs navegan correctamente
- Realtime del resumen: crear un pedido desde WhatsApp y ver si las cards se actualizan
- Asignar repartidor desde admin pedidos
- Buscar clientes por nombre y teléfono
- Filtros de ventas ruta (hoy / semana / mes)

---

### FASE 7 — Deploy a Vercel ✅
- Repo GitHub: `puroejemplo-cloud/puriapp` (rama main)
- URL producción: `https://purificadorapp-puroejemplo-5776s-projects.vercel.app`
- Variables de entorno configuradas en Vercel
- Supabase Auth URL Configuration actualizada
- Twilio webhook apuntando a producción
- Login admin y repartidor funcionando en producción

---

## Siguiente fase

**FASE 8 — Notificaciones push**
Repartidor recibe push incluso con la app cerrada.

---

## Notas importantes para retomar

### Credenciales de prueba
| Qué | Valor |
|---|---|
| URL app (dev) | http://192.168.100.98:3000 |
| Admin email | admin@purificadora.com |
| Admin password | admin123456 |
| Repartidor email | repartidor1@test.com |
| Repartidor password | test123456 |
| Nombre repartidor | Juan Repartidor |
| Supabase URL | https://jchfscppgohkbdpglzex.supabase.co |
| Twilio Sandbox número | whatsapp:+14155238886 |

### Fix importante aplicado en FASE 4
- `allowedDevOrigins: ['192.168.100.98']` en `next.config.ts` — sin esto el JS no carga desde la IP local
- Auth usa cookies vía adaptador custom en `lib/supabase-browser.ts` (no localStorage)

### Decisiones tomadas
- Precio del garrafón se consulta desde BD (`productos`) — no hardcodeado
- Checkbox "convertir a cliente fijo" solo aparece si el teléfono está lleno
- El GPS del repartidor se usa como ubicación aproximada del cliente espontáneo
- Geocodificación solo se intenta si el cliente tiene dirección y no hay GPS preciso
- Admin pedidos: asignar repartidor cambia estado a `en_ruta` automáticamente
- Admin clientes: re-geocodifica solo si cambia la dirección (evita llamadas innecesarias a Nominatim)

### Archivos clave
```
purificadora-app/
├── app/
│   ├── login/page.tsx
│   ├── repartidor/page.tsx             ← PWA principal (FASE 4+5)
│   ├── admin/
│   │   ├── layout.tsx                  ← FASE 6: shell + auth
│   │   ├── page.tsx                    ← FASE 6: resumen 6 cards
│   │   ├── pedidos/page.tsx            ← FASE 6: gestión pedidos
│   │   ├── clientes/page.tsx           ← FASE 6: CRUD clientes
│   │   ├── ventas-ruta/page.tsx        ← FASE 6: ventas espontáneas
│   │   └── repartidores/page.tsx       ← FASE 6: alta repartidores
│   └── api/whatsapp/route.ts
├── components/
│   ├── VentaRutaModal.tsx
│   └── RegistrarSW.tsx
├── lib/
│   ├── supabase.ts                     ← admin (solo servidor)
│   ├── supabase-browser.ts             ← cliente con cookies
│   ├── auth.ts                         ← FASE 6: esAdmin()
│   ├── distancia.ts, geocoding.ts, comandos.ts
├── public/
│   ├── manifest.json, sw.js, icon-*.png
│   └── notif.mp3                       ← colocar manualmente
└── next.config.ts                      ← allowedDevOrigins
```
