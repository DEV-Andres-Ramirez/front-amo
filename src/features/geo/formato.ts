/**
 * Formato de valores del mapa según la unidad de la métrica (es-CO, COP sin
 * decimales, fracciones como porcentaje).
 */
import { ZONA } from "@/lib/fechas"
import {
  formatearCompacto,
  formatearCOP,
  formatearCOPCompacto,
  formatearNumero,
  formatearPorcentaje,
  LOCALE,
} from "@/lib/format"

import { DEFINICIONES_METRICAS, type MetricaGeo } from "./metricas"

export interface OpcionesFormatoGeo {
  /** "1,2 M" en lugar de "1.234.567" (leyendas, etiquetas estrechas). */
  readonly compacto?: boolean
  /** Valor por cada 100 mil habitantes. */
  readonly por100k?: boolean
}

export function formatearValorGeo(
  valor: number | null | undefined,
  metrica: MetricaGeo,
  { compacto = false, por100k = false }: OpcionesFormatoGeo = {}
): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) {
    return "Sin datos"
  }

  switch (DEFINICIONES_METRICAS[metrica].unidad) {
    case "cop":
      return compacto ? formatearCOPCompacto(valor) : formatearCOP(valor)
    case "porcentaje":
      return formatearPorcentaje(valor, 1)
    case "conteo":
    case "personas":
      if (compacto && valor >= 10_000) return formatearCompacto(valor)
      // Las tasas por 100 mil habitantes suelen ser pequeñas: decimales útiles.
      return formatearNumero(valor, por100k ? decimalesTasa(valor) : 0)
  }
}

/** Participación de una zona en el total ("12,1 %"). */
export function formatearParticipacion(fraccion: number): string {
  return formatearPorcentaje(fraccion, 1)
}

function decimalesTasa(valor: number): number {
  if (valor < 10) return 2
  return valor < 100 ? 1 : 0
}

/** Rótulo de unidad para acompañar cifras ("medios", "por 100 mil hab."). */
export function unidadGeo(metrica: MetricaGeo, por100k = false): string {
  if (por100k) return "por 100 mil hab."
  switch (metrica) {
    case "medios":
      return "medios"
    case "campanas":
      return "campañas"
    case "asignaciones":
      return "asignaciones"
    case "anunciantes":
      return "anunciantes"
    case "accesos":
      return "accesos"
    case "alcance":
    case "audiencia":
      return "personas"
    case "gmv":
    case "cumplimiento":
      return ""
  }
}

const formatoPeriodo = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONA,
  day: "numeric",
  month: "short",
  year: "numeric",
})

/** "1–30 sept 2026" · "15 ago – 30 sept 2026" (hora de Bogotá). */
export function formatearPeriodo(desde: Date, hasta: Date): string {
  return formatoPeriodo.formatRange(desde, hasta)
}
