/**
 * Esqueleto tributario (módulo puro): consumo de una resolución de
 * numeración DIAN, vigencias por día y orden de las tablas.
 */
import type { ResolucionDian, Retencion, ReteicaMunicipal } from "./tipos"
import { type EstadoVigencia, estadoVigenciaDias } from "./vigencias"

/** Avisar cuando quede menos de esta fracción del rango o de estos días de vigencia. */
export const UMBRAL_CONSUMO = 0.9
export const DIAS_AVISO_VENCIMIENTO = 30

export interface ConsumoResolucion {
  total: number
  usados: number
  disponibles: number
  /** Fracción consumida (0–1). */
  fraccion: number
  /** Próximo número que se emitiría, con prefijo. */
  siguiente: string | null
}

export function consumoResolucion(
  resolucion: Pick<
    ResolucionDian,
    "rangoDesde" | "rangoHasta" | "consecutivoActual" | "prefijo"
  >
): ConsumoResolucion {
  const total = resolucion.rangoHasta - resolucion.rangoDesde + 1
  const usados = Math.max(
    0,
    resolucion.consecutivoActual - resolucion.rangoDesde + 1
  )
  const disponibles = Math.max(0, total - usados)
  const proximo = resolucion.consecutivoActual + 1
  return {
    total,
    usados,
    disponibles,
    fraccion: total > 0 ? usados / total : 1,
    siguiente:
      proximo <= resolucion.rangoHasta
        ? `${resolucion.prefijo}${proximo}`
        : null,
  }
}

export type AlertaResolucion = "agotada" | "casi-agotada" | "por-vencer" | "vencida"

/** Alertas de una resolución activa: rango agotado o cerca, vigencia vencida o cerca. */
export function alertasResolucion(
  resolucion: ResolucionDian,
  ahora: Date = new Date()
): AlertaResolucion[] {
  const alertas: AlertaResolucion[] = []
  const consumo = consumoResolucion(resolucion)
  if (consumo.disponibles === 0) alertas.push("agotada")
  else if (consumo.fraccion >= UMBRAL_CONSUMO) alertas.push("casi-agotada")
  if (resolucion.vigenteHasta) {
    const fin = new Date(`${resolucion.vigenteHasta}T23:59:59-05:00`).getTime()
    const restante = fin - ahora.getTime()
    if (restante < 0) alertas.push("vencida")
    else if (restante < DIAS_AVISO_VENCIMIENTO * 86_400_000) {
      alertas.push("por-vencer")
    }
  }
  return alertas
}

/**
 * Estado de una fila con vigencia por días. Las columnas `date` de
 * retenciones y ReteICA guardan el fin exclusivo `[desde, hasta)`.
 */
export function estadoFilaTributaria(
  fila: Pick<Retencion | ReteicaMunicipal, "vigenteDesde" | "vigenteHasta">,
  ahora: Date = new Date()
): EstadoVigencia {
  return estadoVigenciaDias(fila.vigenteDesde, fila.vigenteHasta, ahora)
}

const ORDEN_ESTADO: Readonly<Record<EstadoVigencia, number>> = {
  VIGENTE: 0,
  PROGRAMADA: 1,
  FINALIZADA: 2,
}

/** Vigentes primero, luego programadas y al final las finalizadas (más recientes antes). */
export function ordenarPorVigencia<
  T extends { vigenteDesde: string; vigenteHasta: string | null },
>(filas: readonly T[], ahora: Date = new Date()): T[] {
  return [...filas].sort(
    (a, b) =>
      ORDEN_ESTADO[estadoVigenciaDias(a.vigenteDesde, a.vigenteHasta, ahora)] -
        ORDEN_ESTADO[
          estadoVigenciaDias(b.vigenteDesde, b.vigenteHasta, ahora)
        ] || b.vigenteDesde.localeCompare(a.vigenteDesde)
  )
}
