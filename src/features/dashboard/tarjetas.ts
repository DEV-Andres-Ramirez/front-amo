/**
 * Qué muestra cada tarjeta KPI de los paneles: el KPI principal (de
 * `kpi_fila`), su icono y una línea secundaria que le da contexto (GMV
 * comprometido junto al verificado, take rate junto a la comisión…). Las
 * cifras secundarias llegan ya formateadas en es-CO. Módulo puro.
 */
import type { FilaKpi } from "@/components/kpi/tipos"
import {
  formatearCompacto,
  formatearCOPCompacto,
  formatearNumero,
  formatearPorcentaje,
} from "@/lib/format"

export type NombreIconoKpi =
  | "alcance"
  | "anunciantes"
  | "campanas"
  | "clics"
  | "comision"
  | "costo"
  | "cumplimiento"
  | "dinero"
  | "engagement"
  | "impresiones"
  | "inversion"
  | "llenado"
  | "medios"
  | "negocios"
  | "pago"
  | "porcentaje"
  | "reproducciones"
  | "usuarios"

export interface DatoSecundario {
  etiqueta: string
  /** Cifra ya formateada (es-CO). */
  valor: string
  /** `aviso` resalta un dato que pide atención (medios en riesgo…). */
  tono?: "neutro" | "aviso"
}

export interface DefinicionTarjeta {
  kpi: string
  icono: NombreIconoKpi
  /** Título propio (si no, el del diccionario de KPI). */
  titulo?: string
  secundario?: DatoSecundario
}

type Indice = ReadonlyMap<string, FilaKpi>

const SIN_DATO = "—"

function valor(indice: Indice, clave: string): number | null {
  return indice.get(clave)?.valor ?? null
}

function horas(valorHoras: number | null): string {
  return valorHoras === null ? SIN_DATO : `${formatearNumero(valorHoras, 1)} h`
}

/** El ticket promedio exige 5 anunciantes (docs/kpis.md §1.16): con menos, avisa. */
export const MINIMO_ANUNCIANTES_TICKET = 5

function ticket(indice: Indice): DatoSecundario {
  const anunciantes = valor(indice, "anunciantes_activos") ?? 0
  const promedio = valor(indice, "ticket_promedio")
  const pocos = anunciantes > 0 && anunciantes < MINIMO_ANUNCIANTES_TICKET
  return {
    etiqueta: pocos ? "Ticket promedio (muestra pequeña)" : "Ticket promedio",
    valor: formatearCOPCompacto(promedio),
    tono: pocos ? "aviso" : "neutro",
  }
}

/** Alcance medio por negocio verificado (contexto del alcance acumulado). */
function alcancePorNegocio(indice: Indice): string {
  const alcance = valor(indice, "alcance_total")
  const negocios = valor(indice, "negocios_cerrados")
  return alcance !== null && negocios
    ? formatearCompacto(alcance / negocios)
    : SIN_DATO
}

/** Las 8 tarjetas del panel general (docs/kpis.md §1). */
export function tarjetasAdmin(indice: Indice): DefinicionTarjeta[] {
  const enRiesgo = valor(indice, "medios_en_riesgo") ?? 0
  return [
    {
      kpi: "gmv_verificado",
      icono: "dinero",
      secundario: {
        etiqueta: "Comprometido",
        valor: formatearCOPCompacto(valor(indice, "gmv_comprometido")),
      },
    },
    {
      kpi: "comision",
      icono: "comision",
      secundario: {
        etiqueta: "Take rate",
        valor: formatearPorcentaje(valor(indice, "take_rate"), 1),
      },
    },
    {
      kpi: "negocios_cerrados",
      icono: "negocios",
      secundario: {
        etiqueta: "Ofertas publicadas",
        valor: formatearNumero(valor(indice, "ofertas_publicadas")),
      },
    },
    {
      kpi: "tasa_llenado",
      icono: "llenado",
      secundario: {
        etiqueta: "Tiempo medio de llenado",
        valor: horas(valor(indice, "tiempo_medio_llenado_h")),
      },
    },
    {
      kpi: "tasa_cumplimiento",
      icono: "cumplimiento",
      secundario: {
        etiqueta: "Tasa de aceptación",
        valor: formatearPorcentaje(valor(indice, "tasa_aceptacion"), 1),
      },
    },
    {
      kpi: "alcance_total",
      icono: "alcance",
      secundario: {
        etiqueta: "Por negocio verificado",
        valor: alcancePorNegocio(indice),
      },
    },
    {
      kpi: "medios_activos",
      icono: "medios",
      secundario: {
        etiqueta: "Nuevos · en riesgo",
        valor: `${formatearNumero(valor(indice, "medios_nuevos") ?? 0)} · ${formatearNumero(enRiesgo)}`,
        tono: enRiesgo > 0 ? "aviso" : "neutro",
      },
    },
    { kpi: "anunciantes_activos", icono: "anunciantes", secundario: ticket(indice) },
  ]
}

/** Costo por persona → por mil personas (docs/kpis.md §2: la UI muestra ambos). */
function porMil(costoPorPersona: number | null): string {
  return costoPorPersona === null
    ? SIN_DATO
    : formatearCOPCompacto(costoPorPersona * 1000)
}

/** Las 8 tarjetas del panel del anunciante (docs/kpis.md §3.1). */
export function tarjetasAnunciante(indice: Indice): DefinicionTarjeta[] {
  return [
    {
      kpi: "inversion_verificada",
      icono: "inversion",
      titulo: "Inversión",
      secundario: {
        etiqueta: "Comprometida",
        valor: formatearCOPCompacto(valor(indice, "inversion_comprometida")),
      },
    },
    {
      kpi: "alcance_total",
      icono: "alcance",
      titulo: "Alcance",
      secundario: {
        etiqueta: "Medios que aceptaron",
        valor: formatearNumero(valor(indice, "medios_alcanzados")),
      },
    },
    {
      kpi: "impresiones",
      icono: "impresiones",
      secundario: {
        etiqueta: "Reproducciones",
        valor: formatearCompacto(valor(indice, "reproducciones")),
      },
    },
    {
      kpi: "interacciones",
      icono: "engagement",
      secundario: {
        etiqueta: "Clics en el enlace",
        valor: formatearCompacto(valor(indice, "clics")),
      },
    },
    {
      kpi: "cpm_efectivo",
      icono: "costo",
      secundario: {
        etiqueta: "Por mil personas alcanzadas",
        valor: porMil(valor(indice, "costo_por_alcance")),
      },
    },
    {
      kpi: "costo_por_interaccion",
      icono: "pago",
      secundario: {
        etiqueta: "Negocios medidos",
        valor: formatearNumero(indice.get("costo_por_interaccion")?.n ?? 0),
      },
    },
    {
      kpi: "engagement",
      icono: "porcentaje",
      secundario: {
        etiqueta: "Cumplimiento de los medios",
        valor: formatearPorcentaje(valor(indice, "tasa_cumplimiento"), 1),
      },
    },
    {
      kpi: "campanas_activas",
      icono: "campanas",
      secundario: {
        etiqueta: "Ofertas publicadas · llenado",
        valor: `${formatearNumero(valor(indice, "ofertas_publicadas") ?? 0)} · ${formatearPorcentaje(valor(indice, "tasa_llenado"), 0)}`,
      },
    },
  ]
}
