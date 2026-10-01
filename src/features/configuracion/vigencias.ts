/**
 * Vigencias de tarifas, comisiones, retenciones y versiones legales (módulo
 * puro). Todo instante se interpreta en la hora de Bogotá; los rangos son
 * semiabiertos `[desde, hasta)` como en la BD (`tstzrange`/`daterange '[)'`).
 */
import { TZDate, tz } from "@date-fns/tz"
import { addDays, addMonths, startOfDay, startOfMonth, subDays } from "date-fns"

import { parsearFecha, serializarFecha, ZONA } from "@/lib/fechas"

const enBogota = { in: tz(ZONA) }
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/

export type EstadoVigencia = "PROGRAMADA" | "VIGENTE" | "FINALIZADA"

export const ETIQUETAS_VIGENCIA: Readonly<Record<EstadoVigencia, string>> = {
  PROGRAMADA: "Programada",
  VIGENTE: "Vigente",
  FINALIZADA: "Finalizada",
}

function instante(valor: string | Date): number {
  return (valor instanceof Date ? valor : new Date(valor)).getTime()
}

/** Estado de un rango de instantes `[desde, hasta)` respecto de `ahora`. */
export function estadoVigencia(
  desde: string,
  hasta: string | null,
  ahora: Date = new Date()
): EstadoVigencia {
  const t = ahora.getTime()
  if (instante(desde) > t) return "PROGRAMADA"
  if (hasta !== null && instante(hasta) <= t) return "FINALIZADA"
  return "VIGENTE"
}

/** Estado de un rango de días `[desde, hasta)` ('YYYY-MM-DD') respecto de hoy en Bogotá. */
export function estadoVigenciaDias(
  desde: string,
  hasta: string | null,
  ahora: Date = new Date()
): EstadoVigencia {
  const hoy = serializarFecha(ahora)
  if (desde > hoy) return "PROGRAMADA"
  if (hasta !== null && hasta <= hoy) return "FINALIZADA"
  return "VIGENTE"
}

/** 'YYYY-MM-DD' + 'HH:mm' en Bogotá → instante; `null` si alguno no es válido. */
export function instanteBogota(dia: string, hora = "00:00"): Date | null {
  const fecha = parsearFecha(dia)
  const coincidencia = HORA.exec(hora.trim())
  if (!fecha || !coincidencia) return null
  const local = new TZDate(fecha.getTime(), ZONA)
  local.setHours(Number(coincidencia[1]), Number(coincidencia[2]), 0, 0)
  return new Date(local.getTime())
}

const formatoHora = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** Instante → día y hora en Bogotá (para precargar un formulario). */
export function diaYHora(valor: string | Date): { dia: string; hora: string } {
  const fecha = valor instanceof Date ? valor : new Date(valor)
  return { dia: serializarFecha(fecha), hora: formatoHora.format(fecha) }
}

/** 00:00 (Bogotá) del día siguiente: fin exclusivo de un "hasta el día X inclusive". */
export function finExclusivoDelDia(dia: string): Date | null {
  const fecha = parsearFecha(dia)
  return fecha ? new Date(addDays(fecha, 1, enBogota).getTime()) : null
}

/** Fin exclusivo → último día incluido ('YYYY-MM-DD'), para mostrarlo y editarlo. */
export function ultimoDiaIncluido(hastaExclusivo: string | Date): string {
  const fecha = new Date(instante(hastaExclusivo) - 1)
  return serializarFecha(fecha)
}

/** Día exclusivo de una columna `date` ('YYYY-MM-DD') → último día incluido. */
export function diaAnterior(dia: string): string | null {
  const fecha = parsearFecha(dia)
  return fecha ? serializarFecha(subDays(fecha, 1, enBogota)) : null
}

/** Día siguiente de un 'YYYY-MM-DD' (para guardar un "hasta inclusive" en una columna `date`). */
export function diaSiguiente(dia: string): string | null {
  const fecha = parsearFecha(dia)
  return fecha ? serializarFecha(addDays(fecha, 1, enBogota)) : null
}

export type PresetInicio = "manana" | "lunes" | "mes"

export const ETIQUETAS_PRESET_INICIO: Readonly<Record<PresetInicio, string>> = {
  manana: "Mañana, 00:00",
  lunes: "Próximo lunes",
  mes: "1.º del próximo mes",
}

/** Inicios típicos de una nueva vigencia, a las 00:00 de Bogotá. */
export function inicioPreset(
  preset: PresetInicio,
  ahora: Date = new Date()
): Date {
  const hoy = startOfDay(ahora, enBogota)
  switch (preset) {
    case "manana":
      return new Date(addDays(hoy, 1, enBogota).getTime())
    case "lunes": {
      const dia = new TZDate(hoy.getTime(), ZONA).getDay()
      const faltan = ((8 - dia) % 7) || 7
      return new Date(addDays(hoy, faltan, enBogota).getTime())
    }
    case "mes":
      return new Date(
        startOfMonth(addMonths(hoy, 1, enBogota), enBogota).getTime()
      )
  }
}

/** Hoy en Bogotá como 'YYYY-MM-DD'. */
export function hoyBogota(ahora: Date = new Date()): string {
  return serializarFecha(ahora)
}
