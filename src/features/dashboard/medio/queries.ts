import "server-only"

import { cache } from "react"

import type { FilaKpi } from "@/components/kpi/tipos"
import { numero } from "@/features/dashboard/insights/adaptadores"

import { filasKpi } from "../kpi"
import { clientePanel, fallar } from "../servidor"
import {
  type AccionPendiente,
  type AsignacionEnCurso,
  ESTADOS_EN_CURSO,
  type PuntoGanancias,
} from "./datos"

/**
 * Consultas del panel del medio. El medio no lee `asignaciones` ni
 * `asignacion_montos` en la tabla base (§3.6): sus RPC son definer y filtran
 * por `mi_medio_id()`. Su ficha y los niveles sí se leen por RLS.
 */

const n = (valor: number | string | null | undefined) => numero(valor) ?? 0

export const kpisMedio = cache(
  async (
    desde: string,
    hasta: string,
    desdeAnterior: string,
    hastaAnterior: string
  ): Promise<FilaKpi[]> => {
    const supabase = await clientePanel()
    const { data, error } = await supabase.rpc("kpis_medio", {
      p_desde: desde,
      p_hasta: hasta,
      p_desde_ant: desdeAnterior,
      p_hasta_ant: hastaAnterior,
    })
    if (error) fallar("consultar tus ganancias", error)
    return filasKpi(data)
  }
)

export const serieGananciasMedio = cache(
  async (
    desde: string,
    hasta: string,
    granularidad: "semana" | "mes"
  ): Promise<PuntoGanancias[]> => {
    const supabase = await clientePanel()
    const { data, error } = await supabase.rpc("serie_ganancias_medio", {
      p_desde: desde,
      p_hasta: hasta,
      p_granularidad: granularidad,
    })
    if (error) fallar("consultar tu historial de ganancias", error)
    return data.map((fila) => ({
      periodo: fila.periodo,
      ganado: n(fila.ganado),
      pagado: n(fila.pagado),
      asignaciones: n(fila.asignaciones),
    }))
  }
)

export const proximasAcciones = cache(
  async (limite: number): Promise<AccionPendiente[]> => {
    const supabase = await clientePanel()
    const { data, error } = await supabase.rpc("proximas_acciones_medio", {
      p_limite: limite,
    })
    if (error) fallar("consultar tus próximas acciones", error)
    return data.map((fila) => ({
      asignacionId: fila.asignacion_id,
      ofertaTitulo: fila.oferta_titulo,
      accion: fila.accion,
      venceAt: fila.vence_at,
    }))
  }
)

export const asignacionesEnCurso = cache(
  async (limite: number): Promise<AsignacionEnCurso[]> => {
    const supabase = await clientePanel()
    const { data, error } = await supabase.rpc("mis_asignaciones_medio", {
      p_estados: [...ESTADOS_EN_CURSO],
      p_limite: limite,
    })
    if (error) fallar("consultar tus negocios en curso", error)
    return data.map((fila) => ({
      id: fila.id,
      estado: fila.estado,
      plataforma: fila.plataforma,
      montoMedio: numero(fila.monto_medio),
      aceptadaAt: fila.aceptada_at,
      fechaLimitePublicacion: fila.fecha_limite_publicacion,
    }))
  }
)

export interface FichaMedio {
  nombre: string
  nivel: number
  nombreNivel: string | null
  topeAnual: number | null
  porcentajeAlerta: number
  porcentajeBloqueo: number
  tasaCumplimiento: number | null
  nCumplimiento: number
  calificacion: number | null
}

const UMBRALES_POR_DEFECTO = { alerta: 0.8, bloqueo: 0.95 }

/** Ficha propia y umbrales de su nivel (`null` si la cuenta no tiene medio visible). */
export const fichaMedio = cache(
  async (medioId: string): Promise<FichaMedio | null> => {
    const supabase = await clientePanel()
    const { data: medio, error } = await supabase
      .from("medios")
      .select(
        "nombre, nivel_verificacion, tasa_cumplimiento, n_cumplimiento, calificacion_promedio"
      )
      .eq("id", medioId)
      .maybeSingle()
    if (error) fallar("consultar la ficha de tu medio", error)
    if (!medio) return null

    const { data: nivel } = await supabase
      .from("niveles_verificacion")
      .select("nombre, tope_anual, porcentaje_alerta, porcentaje_bloqueo")
      .eq("nivel", medio.nivel_verificacion)
      .maybeSingle()
    return {
      nombre: medio.nombre,
      nivel: medio.nivel_verificacion,
      nombreNivel: nivel?.nombre ?? null,
      topeAnual: numero(nivel?.tope_anual),
      porcentajeAlerta:
        numero(nivel?.porcentaje_alerta) ?? UMBRALES_POR_DEFECTO.alerta,
      porcentajeBloqueo:
        numero(nivel?.porcentaje_bloqueo) ?? UMBRALES_POR_DEFECTO.bloqueo,
      tasaCumplimiento: numero(medio.tasa_cumplimiento),
      nCumplimiento: medio.n_cumplimiento,
      calificacion: numero(medio.calificacion_promedio),
    }
  }
)
