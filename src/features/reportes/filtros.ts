/**
 * Filtros de los reportes en la URL (nuqs). Módulo puro: la página los lee en
 * el servidor con `cargarFiltros(searchParams)`, la barra de filtros los
 * escribe en el cliente y la exportación los valida con los MISMOS parsers.
 *
 *   /reportes/finanzas?periodo=esteTrimestre&agrupacion=sector
 *   /reportes/cumplimiento-medios?desde=2026-09-01&hasta=2026-09-30&departamento=05
 *   /reportes/cartera?corte=2026-08-31
 *
 * El periodo usa el contrato compartido con Auditoría y Accesos (`periodo`,
 * `desde`, `hasta`); así los enlaces de los insights abren el reporte filtrado.
 */
import { tz } from "@date-fns/tz"
import { subMonths } from "date-fns"
import {
  createLoader,
  createParser,
  type inferParserType,
  parseAsStringLiteral,
} from "nuqs/server"
import { z } from "zod"

import {
  etiquetaComparacion,
  etiquetaRango,
  parsersPeriodo,
  rangoDeValores,
} from "@/features/auditoria/periodo"
import { departamentoPorCodigo } from "@/features/geo/departamentos"
import { parseAsCodigoDepartamento, parseAsDia } from "@/features/geo/estado-url"
import {
  inicioDelDia,
  parsearFecha,
  periodoAnterior,
  PRESETS_RANGO,
  type RangoFechas,
  serializarFecha,
  ZONA,
} from "@/lib/fechas"
import { formatearFecha } from "@/lib/format"
import type { FiltroDocumento } from "@/lib/export/marca"

import type { ReporteCatalogo } from "./catalogo"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const parseAsUuid = createParser<string>({
  parse: (valor) => (UUID.test(valor) ? valor.toLowerCase() : null),
  serialize: (valor) => valor,
})

export const AGRUPACIONES = ["anunciante", "sector", "mes"] as const
export type Agrupacion = (typeof AGRUPACIONES)[number]

export const ETIQUETAS_AGRUPACION: Readonly<Record<Agrupacion, string>> = {
  anunciante: "Anunciante",
  sector: "Sector",
  mes: "Mes",
}

export const parsersFiltros = {
  ...parsersPeriodo,
  departamento: parseAsCodigoDepartamento,
  anunciante: parseAsUuid,
  sector: parseAsUuid,
  agrupacion: parseAsStringLiteral(AGRUPACIONES).withDefault("anunciante"),
  corte: parseAsDia,
}

export type ValoresFiltros = inferParserType<typeof parsersFiltros>

const cargarValores = createLoader(parsersFiltros)

/** Filtros ya resueltos (fechas de Bogotá) con los que consultan los reportes. */
export interface FiltrosReporte {
  rango: RangoFechas
  /** Periodo de comparación alineado (docs/kpis.md §0.1). */
  anterior: RangoFechas
  departamento: string | null
  anunciante: string | null
  sector: string | null
  agrupacion: Agrupacion
  /** Fecha de corte de la cartera (por defecto, hoy). */
  corte: Date
  /** Mismo día del mes anterior: comparativo de la cartera. */
  corteAnterior: Date
}

const enBogota = { in: tz(ZONA) }

/** Mismo día del mes anterior (o el último día, si ese mes es más corto). */
export function mesAntes(fecha: Date): Date {
  return inicioDelDia(subMonths(fecha, 1, enBogota))
}

/** Un corte en el futuro no tiene sentido: se limita a hoy. */
export function resolverCorte(texto: string | null, ahora: Date): Date {
  const hoy = inicioDelDia(ahora)
  const elegido = parsearFecha(texto)
  return elegido && elegido.getTime() <= hoy.getTime() ? elegido : hoy
}

export function filtrosDesdeValores(
  valores: ValoresFiltros,
  ahora: Date = new Date()
): FiltrosReporte {
  const rango = rangoDeValores(valores, ahora)
  const corte = resolverCorte(valores.corte, ahora)
  return {
    rango,
    anterior: periodoAnterior(rango),
    departamento: valores.departamento,
    anunciante: valores.anunciante,
    sector: valores.sector,
    agrupacion: valores.agrupacion,
    corte,
    corteAnterior: mesAntes(corte),
  }
}

/** Servidor: `await cargarFiltros(props.searchParams)`. */
export async function cargarFiltros(
  searchParams: Promise<Record<string, string | string[] | undefined>>
): Promise<{ valores: ValoresFiltros; filtros: FiltrosReporte }> {
  const valores = await cargarValores(searchParams)
  return { valores, filtros: filtrosDesdeValores(valores) }
}

/**
 * Entrada de las Server Actions: los textos de la URL. Se validan con los
 * mismos parsers de la página (un valor inválido se descarta, como en la URL).
 */
export const esquemaValoresFiltros = z.object({
  periodo: z.enum(PRESETS_RANGO).nullable(),
  desde: z.string().max(10).nullable(),
  hasta: z.string().max(10).nullable(),
  departamento: z.string().max(2).nullable(),
  anunciante: z.string().max(36).nullable(),
  sector: z.string().max(36).nullable(),
  agrupacion: z.enum(AGRUPACIONES).nullable(),
  corte: z.string().max(10).nullable(),
})

export type EntradaFiltros = z.infer<typeof esquemaValoresFiltros>

export function valoresDesdeEntrada(entrada: EntradaFiltros): ValoresFiltros {
  const texto: Record<string, string> = {}
  for (const [clave, valor] of Object.entries(entrada)) {
    if (typeof valor === "string" && valor !== "") texto[clave] = valor
  }
  return cargarValores(texto)
}

/** Lo que la barra de filtros envía a la exportación (mismo contrato que la URL). */
export function entradaDesdeValores(valores: ValoresFiltros): EntradaFiltros {
  return {
    periodo: valores.periodo,
    desde: valores.desde,
    hasta: valores.hasta,
    departamento: valores.departamento,
    anunciante: valores.anunciante,
    sector: valores.sector,
    agrupacion: valores.agrupacion,
    corte: valores.corte,
  }
}

/** Argumentos de fecha de las RPC ('YYYY-MM-DD'). */
export function argumentosPeriodo(rango: RangoFechas): {
  p_desde: string
  p_hasta: string
} {
  return {
    p_desde: serializarFecha(rango.desde),
    p_hasta: serializarFecha(rango.hasta),
  }
}

export function argumentosComparacion(filtros: FiltrosReporte): {
  p_desde: string
  p_hasta: string
  p_desde_ant: string
  p_hasta_ant: string
} {
  return {
    ...argumentosPeriodo(filtros.rango),
    p_desde_ant: serializarFecha(filtros.anterior.desde),
    p_hasta_ant: serializarFecha(filtros.anterior.hasta),
  }
}

const formatoRango = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA,
  day: "numeric",
  month: "short",
  year: "numeric",
})

/** "1–30 sept 2026" (siempre con fechas, también para los presets). */
export function fechasDelRango(rango: RangoFechas): string {
  return formatoRango.formatRange(rango.desde, rango.hasta)
}

/** Texto del comparativo: "frente al mes anterior (1–31 ago 2026)". */
export function textoComparacion(filtros: FiltrosReporte): string {
  return `${etiquetaComparacion(filtros.rango)} (${fechasDelRango(filtros.anterior)})`
}

export interface NombresFiltros {
  anunciante?: string | null
  sector?: string | null
}

/**
 * Filtros aplicados, en palabras, para la portada de los documentos y el
 * resumen bajo el encabezado. Solo los que el reporte entiende.
 */
export function describirFiltros(
  reporte: Pick<ReporteCatalogo, "filtros" | "comparativo">,
  filtros: FiltrosReporte,
  nombres: NombresFiltros = {}
): FiltroDocumento[] {
  const lista: FiltroDocumento[] = []
  const usa = (filtro: ReporteCatalogo["filtros"][number]) =>
    reporte.filtros.includes(filtro)

  if (usa("periodo")) {
    const etiqueta = etiquetaRango(filtros.rango)
    const fechas = fechasDelRango(filtros.rango)
    lista.push({
      etiqueta: "Periodo",
      valor: etiqueta === fechas ? fechas : `${etiqueta} (${fechas})`,
    })
    if (reporte.comparativo) {
      lista.push({
        etiqueta: "Comparado con",
        valor: fechasDelRango(filtros.anterior),
      })
    }
  }
  if (usa("corte")) {
    lista.push({
      etiqueta: "Fecha de corte",
      valor: formatearFecha(filtros.corte, "largo"),
    })
    if (reporte.comparativo) {
      lista.push({
        etiqueta: "Comparado con el corte del",
        valor: formatearFecha(filtros.corteAnterior, "largo"),
      })
    }
  }
  if (usa("departamento")) {
    lista.push({
      etiqueta: "Departamento",
      valor:
        departamentoPorCodigo(filtros.departamento)?.nombre ?? "Todo el país",
    })
  }
  if (usa("anunciante") && filtros.anunciante) {
    lista.push({
      etiqueta: "Anunciante",
      valor: nombres.anunciante ?? "Anunciante seleccionado",
    })
  }
  if (usa("sector") && filtros.sector) {
    lista.push({
      etiqueta: "Sector",
      valor: nombres.sector ?? "Sector seleccionado",
    })
  }
  if (usa("agrupacion")) {
    lista.push({
      etiqueta: "Detalle por",
      valor: ETIQUETAS_AGRUPACION[filtros.agrupacion],
    })
  }
  return lista
}
