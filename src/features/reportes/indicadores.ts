/**
 * Indicadores de cabecera de los reportes (tarjetas KPI, hoja "Indicadores"
 * del Excel e indicadores del PDF). Forma serializable: el servidor los arma
 * y el cliente los pinta o los exporta. Módulo puro.
 */
import type { DefinicionKpi } from "@/components/kpi/definiciones-kpi"
import { presentarDelta } from "@/components/kpi/delta"
import { propsDesdeFila } from "@/components/kpi/desde-fila"
import { formatearValorKpi } from "@/components/kpi/formato-kpi"
import type { FilaKpi, SentidoKpi, UnidadKpi } from "@/components/kpi/tipos"
import { formatearNumero } from "@/lib/format"

/** Ícono decorativo de la tarjeta (se resuelve con un mapa estático en el cliente). */
export type IconoIndicador =
  | "dinero"
  | "comision"
  | "porcentaje"
  | "negocios"
  | "alcance"
  | "medios"
  | "campanas"
  | "anunciantes"
  | "usuarios"
  | "ingresos"
  | "fallos"
  | "alerta"
  | "escudo"
  | "mapa"
  | "factura"
  | "recaudo"
  | "reloj"
  | "pago"

export interface IndicadorReporte {
  clave: string
  titulo: string
  valor: number | null
  unidad: UnidadKpi
  valorAnterior: number | null
  variacion: number | null
  sentido: SentidoKpi
  /** Muestra del valor (tasas): con menos de `nMinimo` no se compara. */
  n: number | null
  nMinimo: number | null
  serie: (number | null)[] | null
  definicion: DefinicionKpi | null
  icono: IconoIndicador | null
}

/** Tarjeta desde una fila `kpi_fila` (nombre, sentido y definición del diccionario). */
export function indicadorDesdeFila(
  fila: FilaKpi,
  nMinimo: number,
  icono: IconoIndicador | null = null
): IndicadorReporte {
  const props = propsDesdeFila(fila, nMinimo)
  return {
    clave: fila.kpi,
    titulo: props.titulo,
    valor: props.valor,
    unidad: props.unidad ?? "conteo",
    valorAnterior: props.valorAnterior ?? null,
    variacion: props.variacion ?? null,
    sentido: props.sentido ?? "neutro",
    n: props.n ?? null,
    nMinimo: props.nMinimo ?? null,
    serie: props.serie ? [...props.serie] : null,
    definicion: props.definicion ?? null,
    icono,
  }
}

/** (actual − anterior) / anterior; `null` sin base (anterior 0 o ausente). */
export function variacionRelativa(
  actual: number | null,
  anterior: number | null
): number | null {
  if (actual === null || anterior === null || anterior === 0) return null
  if (!Number.isFinite(actual) || !Number.isFinite(anterior)) return null
  return (actual - anterior) / Math.abs(anterior)
}

export interface EntradaIndicador {
  clave: string
  titulo: string
  actual: number | null
  anterior?: number | null
  unidad: UnidadKpi
  sentido: SentidoKpi
  definicion?: DefinicionKpi | null
  n?: number | null
  nMinimo?: number | null
  icono?: IconoIndicador | null
  serie?: (number | null)[] | null
}

/**
 * Indicador calculado en la app (sumas o razones de las filas del reporte)
 * con su comparativo. Una tasa con muestra menor al mínimo no se informa
 * (docs/kpis.md §0.4): su valor queda en `null` y la tarjeta lo explica.
 */
export function indicador(entrada: EntradaIndicador): IndicadorReporte {
  const muestraInsuficiente =
    entrada.n != null && entrada.nMinimo != null && entrada.n < entrada.nMinimo
  const actual = muestraInsuficiente ? null : entrada.actual
  const anterior = entrada.anterior ?? null
  return {
    clave: entrada.clave,
    titulo: entrada.titulo,
    valor: actual,
    unidad: entrada.unidad,
    valorAnterior: anterior,
    variacion: entrada.unidad === "%" ? null : variacionRelativa(actual, anterior),
    sentido: entrada.sentido,
    n: entrada.n ?? null,
    nMinimo: entrada.nMinimo ?? null,
    serie: entrada.serie ?? null,
    definicion: entrada.definicion ?? null,
    icono: entrada.icono ?? null,
  }
}

/** Cociente de sumas (nunca promedio de razones, docs/kpis.md §0.4). */
export function razon(numerador: number, denominador: number): number | null {
  return denominador > 0 ? numerador / denominador : null
}

export function sumar<T>(
  filas: readonly T[],
  valor: (fila: T) => number | null
): number {
  return filas.reduce((total, fila) => total + (valor(fila) ?? 0), 0)
}

/** "$ 1.234.567", "12,5 %", "Muestra insuficiente (n = 7)" o "—". */
export function textoValorIndicador(ind: IndicadorReporte): string {
  if (ind.valor !== null && Number.isFinite(ind.valor)) {
    return formatearValorKpi(ind.valor, ind.unidad)
  }
  if (ind.n != null && ind.nMinimo != null && ind.n < ind.nMinimo) {
    return `Muestra insuficiente (n = ${formatearNumero(ind.n)})`
  }
  return "—"
}

export function textoAnteriorIndicador(ind: IndicadorReporte): string {
  return ind.valorAnterior !== null && Number.isFinite(ind.valorAnterior)
    ? formatearValorKpi(ind.valorAnterior, ind.unidad)
    : "—"
}

/** "+12,5 %", "−2,1 pp", "Nuevo" o "—" (mismo criterio que la tarjeta). */
export function textoVariacionIndicador(ind: IndicadorReporte): string {
  if (ind.valor === null) return "—"
  return presentarDelta({
    valor: ind.valor,
    valorAnterior: ind.valorAnterior,
    variacion: ind.variacion,
    unidad: ind.unidad,
    sentido: ind.sentido,
  }).texto
}

/** Detalle bajo la cifra del PDF: comparativo y muestra pequeña. */
export function detalleIndicador(
  ind: IndicadorReporte,
  conComparativo: boolean
): string | undefined {
  const partes: string[] = []
  if (conComparativo && ind.valor !== null) {
    const variacion = textoVariacionIndicador(ind)
    if (variacion !== "—") partes.push(`${variacion} vs. anterior`)
  }
  if (
    ind.valor !== null &&
    ind.n != null &&
    ind.nMinimo != null &&
    ind.n < ind.nMinimo
  ) {
    partes.push(`n = ${formatearNumero(ind.n)}`)
  }
  return partes.length > 0 ? partes.join(" · ") : undefined
}
