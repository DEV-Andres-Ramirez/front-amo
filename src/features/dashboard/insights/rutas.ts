/**
 * Enlaces de las acciones sugeridas. Conservan el periodo consultado
 * (`desde`/`hasta`, el formato que lee `parsearRango`) y el filtro del grupo.
 *
 * Supuestos de parámetros a confirmar con las pistas dueñas de cada pantalla:
 * mapa (`metrica`, `departamento`, `plataforma`), reportes
 * (`cumplimiento-medios`, `desempeno-campanas` con `departamento`/`plataforma`),
 * medios (`segmento=en_riesgo`), asignaciones (`alerta=metricas`) y accesos
 * (`motivo=PAIS_INUSUAL`).
 */
import type { Route } from "next"

import type { EntradaInsights } from "./tipos"

type Parametros = Record<string, string | null | undefined>

export function construirHref(
  ruta: `/${string}`,
  parametros: Parametros,
  periodo?: EntradaInsights["periodo"]
): Route {
  const busqueda = new URLSearchParams()
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor) busqueda.set(clave, valor)
  }
  if (periodo) {
    busqueda.set("desde", periodo.desde)
    busqueda.set("hasta", periodo.hasta)
  }
  const consulta = busqueda.toString()
  return (consulta ? `${ruta}?${consulta}` : ruta) as Route
}

export const RUTAS_INSIGHTS = {
  mapa: "/analitica/mapa",
  reporteCumplimiento: "/reportes/cumplimiento-medios",
  reporteDesempeno: "/reportes/desempeno-campanas",
  medios: "/operacion/medios",
  asignaciones: "/operacion/asignaciones",
  accesos: "/administracion/accesos",
} as const satisfies Record<string, `/${string}`>

/** Métrica del explorador geográfico equivalente a cada KPI de la regla 1. */
export const METRICA_MAPA: Readonly<Record<string, string>> = {
  gmv_verificado: "gmv",
  gmv_comprometido: "gmv",
  negocios_cerrados: "asignaciones",
  alcance_total: "alcance",
}
