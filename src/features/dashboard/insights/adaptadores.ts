/**
 * Adaptadores de las filas de las RPC de analítica (docs/modelo-datos.md §5.9)
 * a la entrada del motor. Las formas se declaran aquí según la especificación
 * porque la migración 9 (analítica) aún no genera sus tipos; cuando exista,
 * se reemplazan por `Database["public"]["Functions"][…]["Returns"]`.
 * PostgREST entrega `numeric` como número o como texto: todo pasa por `numero`.
 */
import type {
  FilaDesglose,
  FilaMezcla,
  MediosEnRiesgo,
  Plataforma,
} from "./tipos"

type Numerico = number | string | null | undefined

/** `mezcla_plataformas(p_desde, p_hasta)`. */
export interface FilaMezclaRpc {
  plataforma: Plataforma
  formato_clave: string
  formato_nombre: string
  asignaciones: Numerico
  gmv: Numerico
  alcance?: Numerico
  participacion_gmv?: Numerico
  cpm_efectivo: Numerico
}

/** `top_zonas(p_nivel, p_metrica, p_desde, p_hasta, p_limite)`. */
export interface FilaTopZonasRpc {
  codigo: string
  nombre: string
  valor: Numerico
  valor_anterior: Numerico
  participacion?: Numerico
  variacion?: Numerico
  rank?: Numerico
}

/** `salud_medios(p_desde, p_hasta)`. */
export interface FilaSaludMediosRpc {
  segmento: string
  cantidad: Numerico
  gmv_en_juego: Numerico
  porcentaje?: Numerico
}

/** `medios_en_riesgo(p_limite)`. */
export interface FilaMedioEnRiesgoRpc {
  medio_id: string
  nombre: string
  departamento: string | null
  gmv_90d: Numerico
}

/** Número finito o `null` (texto numérico incluido). */
export function numero(valor: Numerico): number | null {
  if (valor === null || valor === undefined || valor === "") return null
  const convertido = typeof valor === "number" ? valor : Number(valor)
  return Number.isFinite(convertido) ? convertido : null
}

export function mezclaDesdeRpc(filas: readonly FilaMezclaRpc[]): FilaMezcla[] {
  return filas.map((fila) => ({
    plataforma: fila.plataforma,
    formatoClave: fila.formato_clave,
    formatoNombre: fila.formato_nombre,
    asignaciones: numero(fila.asignaciones) ?? 0,
    gmv: numero(fila.gmv) ?? 0,
    cpmEfectivo: numero(fila.cpm_efectivo),
  }))
}

/** Desglose por zona o plataforma para la causa de la regla 1. */
export function desgloseDesdeTopZonas(
  filas: readonly FilaTopZonasRpc[]
): FilaDesglose[] {
  return filas.map((fila) => ({
    clave: fila.codigo,
    nombre: fila.nombre,
    valor: numero(fila.valor) ?? 0,
    valorAnterior: numero(fila.valor_anterior) ?? 0,
  }))
}

export const SEGMENTO_EN_RIESGO = "en_riesgo"

/**
 * Regla 3: cantidad y GMV en juego del segmento `en_riesgo`, los medios de
 * mayor GMV y el GMV verificado de 90 días que da la proporción (si se tiene).
 */
export function mediosEnRiesgoDesdeRpc(
  salud: readonly FilaSaludMediosRpc[],
  medios: readonly FilaMedioEnRiesgoRpc[],
  gmvVerificado90d: number | null = null
): MediosEnRiesgo | undefined {
  const segmento = salud.find((fila) => fila.segmento === SEGMENTO_EN_RIESGO)
  if (!segmento) return undefined
  return {
    cantidad: numero(segmento.cantidad) ?? 0,
    gmvEnJuego: numero(segmento.gmv_en_juego) ?? 0,
    gmvVerificado90d,
    top: medios.map((medio) => ({
      id: medio.medio_id,
      nombre: medio.nombre,
      departamento: medio.departamento,
      gmv90d: numero(medio.gmv_90d) ?? 0,
    })),
  }
}
