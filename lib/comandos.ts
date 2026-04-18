// Parser de comandos WhatsApp para la purificadora

export type TipoComando =
  | 'PEDIDO'
  | 'ESTADO'
  | 'CANCELAR'
  | 'AYUDA'
  | 'REGISTRO'
  | 'CONFIRMAR'
  | 'RECHAZAR'
  | 'DESCONOCIDO'

export interface ComandoParsed {
  tipo: TipoComando
  cantidad?: number        // Solo para PEDIDO
  nombre?: string          // Solo para REGISTRO
  direccion?: string       // Solo para REGISTRO
}

export function parsearComando(mensaje: string): ComandoParsed {
  const texto = mensaje.trim().toUpperCase()

  // PEDIDO 3 — pedir N garrafones
  const matchPedido = texto.match(/^PEDIDO\s+(\d+)$/)
  if (matchPedido) {
    return { tipo: 'PEDIDO', cantidad: parseInt(matchPedido[1]) }
  }

  // REGISTRO|Nombre Completo|Dirección completa
  if (texto.startsWith('REGISTRO|')) {
    const partes = mensaje.trim().split('|')
    if (partes.length >= 3) {
      return {
        tipo: 'REGISTRO',
        nombre: partes[1].trim(),
        direccion: partes[2].trim(),
      }
    }
  }

  if (texto === 'ESTADO') return { tipo: 'ESTADO' }
  if (texto === 'CANCELAR') return { tipo: 'CANCELAR' }
  if (texto === 'HOLA' || texto === 'AYUDA' || texto === 'MENU' || texto === 'MENÚ') {
    return { tipo: 'AYUDA' }
  }
  if (texto === 'SÍ' || texto === 'SI' || texto === 'S' || texto === 'YES') {
    return { tipo: 'CONFIRMAR' }
  }
  if (texto === 'NO' || texto === 'N') {
    return { tipo: 'RECHAZAR' }
  }

  return { tipo: 'DESCONOCIDO' }
}

// Mensaje de ayuda que se manda al cliente cuando escribe HOLA o un comando inválido
export const MENSAJE_AYUDA = `💧 *Purificadora — Menú de opciones*

1️⃣ *PEDIDO [cantidad]*
   Ej: PEDIDO 3 → para pedir 3 garrafones

2️⃣ *ESTADO*
   Ver el estado de tu último pedido

3️⃣ *CANCELAR*
   Cancelar tu pedido pendiente

4️⃣ *REGISTRO|Tu Nombre|Tu Dirección*
   Ej: REGISTRO|Juan Pérez|Calle Agua 123, Col. Centro

Escribe el comando que necesites 👆`
