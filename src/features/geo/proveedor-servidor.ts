import "server-only"

import { crearProveedorSimulado } from "./proveedor-simulado"
import { crearProveedorSupabase } from "./proveedor-supabase"
import type { ProveedorMetricasGeo } from "./tipos"

type Entorno = Readonly<Record<string, string | undefined>>

/**
 * Datos simulados solo con `AMO_GEO_MOCK=1` en desarrollo: nunca en un build
 * de producción (`next start`, Vercel production), aunque la variable exista.
 */
export function usarDatosSimulados(entorno: Entorno = process.env): boolean {
  return (
    entorno.AMO_GEO_MOCK === "1" &&
    entorno.NODE_ENV !== "production" &&
    entorno.VERCEL_ENV !== "production"
  )
}

/** Latencia simulada para ver los estados de carga (`AMO_GEO_MOCK_LATENCIA_MS`). */
function latenciaSimulada(entorno: Entorno): number {
  const valor = Number(entorno.AMO_GEO_MOCK_LATENCIA_MS ?? 0)
  return Number.isFinite(valor) ? Math.min(Math.max(valor, 0), 5000) : 0
}

export function obtenerProveedorGeo(
  entorno: Entorno = process.env
): ProveedorMetricasGeo {
  return usarDatosSimulados(entorno)
    ? crearProveedorSimulado({ latenciaMs: latenciaSimulada(entorno) })
    : crearProveedorSupabase()
}
