export type HorarioDia = { inicio: string; fin: string } | null

export type HorarioSemana = {
  lunes:     HorarioDia
  martes:    HorarioDia
  miercoles: HorarioDia
  jueves:    HorarioDia
  viernes:   HorarioDia
  sabado:    HorarioDia
  domingo:   HorarioDia
}

export const NOMBRES_DIAS: Record<keyof HorarioSemana, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
}

export const ORDEN_DIAS: (keyof HorarioSemana)[] = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
]

// getUTCDay(): 0=domingo, 1=lunes, … 6=sábado
const DIA_JS: (keyof HorarioSemana)[] = [
  'domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado',
]

// México UTC-6 (sin DST en la mayoría de estados desde 2023)
function ahoraLocal(): { diaSemana: number; horas: number; minutos: number } {
  const ms = Date.now() - 6 * 60 * 60 * 1000
  const d  = new Date(ms)
  return { diaSemana: d.getUTCDay(), horas: d.getUTCHours(), minutos: d.getUTCMinutes() }
}

export function estaAbierto(horario: HorarioSemana): boolean {
  const { diaSemana, horas, minutos } = ahoraLocal()
  const h = horario[DIA_JS[diaSemana]]
  if (!h) return false
  const [hIni, mIni] = h.inicio.split(':').map(Number)
  const [hFin, mFin] = h.fin.split(':').map(Number)
  const ahora = horas * 60 + minutos
  return ahora >= hIni * 60 + mIni && ahora < hFin * 60 + mFin
}

export function horarioDeHoy(horario: HorarioSemana): HorarioDia {
  const { diaSemana } = ahoraLocal()
  return horario[DIA_JS[diaSemana]] ?? null
}

export function textoHorarioSemana(horario: HorarioSemana): string {
  return ORDEN_DIAS
    .map(d => `${NOMBRES_DIAS[d]}: ${horario[d] ? `${horario[d]!.inicio}–${horario[d]!.fin}` : 'Cerrado'}`)
    .join('\n')
}

export const HORARIO_DEFAULT: HorarioSemana = {
  lunes:     { inicio: '08:00', fin: '18:00' },
  martes:    { inicio: '08:00', fin: '18:00' },
  miercoles: { inicio: '08:00', fin: '18:00' },
  jueves:    { inicio: '08:00', fin: '18:00' },
  viernes:   { inicio: '08:00', fin: '18:00' },
  sabado:    { inicio: '08:00', fin: '14:00' },
  domingo:   null,
}
