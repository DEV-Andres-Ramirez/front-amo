import "server-only"

import { argumentosRpc } from "@/lib/supabase/rpc"
import { formatearNumero, formatearPorcentaje } from "@/lib/format"

import { crearLimitador, type Limitador } from "./concurrencia"
import {
  DEFINICIONES_METRICAS,
  type MetricaGeo,
  metricaDisponibleEn,
} from "./metricas"
import { CODIGO_COLOMBIA } from "./niveles"
import {
  type ClienteGeo,
  type ConsultaRpcGeo,
  geoMetricas,
  traducirError,
} from "./rpc-geo"
import { cubetasSerie } from "./serie"
import {
  type ConsultaDetalleGeo,
  ErrorDatosGeo,
  type FilaMetricaGeo,
  type KpiZona,
  type MotivoSinSerie,
  type RespuestaDetalleGeo,
  type SerieZona,
  type TopZona,
} from "./tipos"

/**
 * Detalle de una zona compuesto en el servidor (una sola solicitud del
 * cliente) mientras la BD no tenga `detalle_zona_geo`: KPI de todas las
 * métricas del nivel, evolución de la métrica activa (una lectura de
 * `geo_metricas` por cubeta), subzonas destacadas y los medios con más
 * asignaciones (`reporte_cumplimiento_medios`). Todo con el cliente del
 * usuario y con un tope de lecturas en vuelo.
 */

/** Lecturas simultáneas a PostgREST por detalle. */
const LECTURAS_EN_VUELO = 8
const TOP = 5

/**
 * Consulta a la RPC que trae la zona con el menor trabajo posible: un
 * departamento se pide filtrado (una fila); municipios y países, con su nivel.
 */
function ambitoDeZona(consulta: ConsultaDetalleGeo): Omit<ConsultaRpcGeo, "metrica"> {
  const { nivel, desde, hasta } = consulta
  if (nivel === "nacional") return { nivel, desde, hasta, departamento: consulta.zona }
  return { nivel, desde, hasta, departamento: consulta.departamento }
}

function filaDeZona(filas: readonly FilaMetricaGeo[], zona: string) {
  return filas.find((fila) => fila.codigo === zona)
}

type Lectura<T> = () => Promise<T>

/** Ejecuta un grupo de lecturas con el limitador compartido. */
function leer<T>(limitar: Limitador, lecturas: readonly Lectura<T>[]) {
  return Promise.allSettled(lecturas.map((lectura) => limitar(lectura)))
}

// ── KPI ──────────────────────────────────────────────────────────────────────

function lecturasKpi(
  supabase: ClienteGeo,
  consulta: ConsultaDetalleGeo
): Lectura<FilaMetricaGeo[]>[] {
  const ambito = ambitoDeZona(consulta)
  return consulta.metricasKpi.map(
    (metrica) => () => geoMetricas(supabase, { ...ambito, metrica })
  )
}

function kpisDe(
  consulta: ConsultaDetalleGeo,
  resultados: readonly PromiseSettledResult<FilaMetricaGeo[]>[]
): KpiZona[] {
  return consulta.metricasKpi.map((metrica, indice) => {
    const resultado = resultados[indice]
    const fila =
      resultado?.status === "fulfilled"
        ? filaDeZona(resultado.value, consulta.zona)
        : undefined
    return { metrica, valor: fila?.valor ?? null, n: fila?.n ?? null }
  })
}

/**
 * Un error de la métrica activa (permiso, RPC ausente) es el error del
 * detalle; el de una métrica secundaria solo deja su tarjeta sin valor.
 */
function errorPrincipal(
  consulta: ConsultaDetalleGeo,
  resultados: readonly PromiseSettledResult<FilaMetricaGeo[]>[]
): ErrorDatosGeo | null {
  const indice = consulta.metricasKpi.indexOf(consulta.metrica)
  const resultado = indice >= 0 ? resultados[indice] : undefined
  if (resultado?.status !== "rejected") return null
  return resultado.reason instanceof ErrorDatosGeo
    ? resultado.reason
    : new ErrorDatosGeo("fallo", "No se pudo consultar el detalle de la zona.")
}

// ── Serie ────────────────────────────────────────────────────────────────────

/** Fotos actuales sin ancla temporal: su valor no cambia con el periodo. */
const SIN_EVOLUCION: ReadonlySet<MetricaGeo> = new Set(["audiencia"])

function planSerie(consulta: ConsultaDetalleGeo) {
  return SIN_EVOLUCION.has(consulta.metrica)
    ? null
    : cubetasSerie(consulta.desde, consulta.hasta)
}

function lecturasSerie(
  supabase: ClienteGeo,
  consulta: ConsultaDetalleGeo
): Lectura<FilaMetricaGeo[]>[] {
  const plan = planSerie(consulta)
  if (!plan) return []
  const ambito = ambitoDeZona(consulta)
  return plan.cubetas.map(
    (cubeta) => () =>
      geoMetricas(supabase, {
        ...ambito,
        metrica: consulta.metrica,
        desde: cubeta.desde,
        hasta: cubeta.hasta,
      })
  )
}

function serieDe(
  consulta: ConsultaDetalleGeo,
  resultados: readonly PromiseSettledResult<FilaMetricaGeo[]>[]
): { serie: SerieZona | null; sinSerie: MotivoSinSerie | null } {
  const plan = planSerie(consulta)
  if (!plan) return { serie: null, sinSerie: "foto-actual" }
  if (resultados.some((r) => r.status === "rejected")) {
    return { serie: null, sinSerie: "fallo" }
  }
  const puntos = plan.cubetas.map((cubeta, indice) => {
    const resultado = resultados[indice]
    const fila =
      resultado?.status === "fulfilled"
        ? filaDeZona(resultado.value, consulta.zona)
        : undefined
    return { ...cubeta, valor: fila?.valor ?? (DEFINICIONES_METRICAS[consulta.metrica].aditiva ? 0 : null) }
  })
  const conValor = puntos.some((punto) => punto.valor !== null && punto.valor !== 0)
  return conValor
    ? { serie: { granularidad: plan.granularidad, puntos }, sinSerie: null }
    : { serie: null, sinSerie: "sin-datos" }
}

// ── Subzonas destacadas ──────────────────────────────────────────────────────

function subconsulta(consulta: ConsultaDetalleGeo): ConsultaRpcGeo | null {
  const base = { metrica: consulta.metrica, desde: consulta.desde, hasta: consulta.hasta }
  if (consulta.nivel === "nacional") {
    return { ...base, nivel: "departamental", departamento: consulta.zona }
  }
  if (consulta.nivel === "internacional" && consulta.zona === CODIGO_COLOMBIA) {
    return { ...base, nivel: "nacional", departamento: null }
  }
  return null
}

function lecturasTop(
  supabase: ClienteGeo,
  consulta: ConsultaDetalleGeo
): Lectura<FilaMetricaGeo[]>[] {
  const sub = subconsulta(consulta)
  if (!sub || !metricaDisponibleEn(consulta.metrica, sub.nivel)) return []
  return [() => geoMetricas(supabase, sub)]
}

function tituloTop(prefijo: string, metrica: MetricaGeo): string {
  const { aditiva, tituloCorto } = DEFINICIONES_METRICAS[metrica]
  return `${prefijo} con ${aditiva ? "más" : "mayor"} ${tituloCorto.toLowerCase()}`
}

function topDe(
  consulta: ConsultaDetalleGeo,
  resultados: readonly PromiseSettledResult<FilaMetricaGeo[]>[]
): TopZona | null {
  const sub = subconsulta(consulta)
  const resultado = resultados[0]
  // El top es complementario: su fallo no tumba el detalle.
  if (!sub || resultado?.status !== "fulfilled") return null
  const { aditiva } = DEFINICIONES_METRICAS[consulta.metrica]
  const filas = resultado.value
    .filter((fila) => fila.valor !== null && (!aditiva || fila.valor > 0))
    .sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0))
    .slice(0, TOP)
  if (filas.length === 0) return null
  return {
    titulo: tituloTop(sub.nivel === "nacional" ? "Departamentos" : "Municipios", consulta.metrica),
    metrica: consulta.metrica,
    filas: filas.map((fila) => ({
      codigo: fila.codigo,
      nombre: fila.nombre,
      valor: fila.valor,
      detalle: aditiva ? null : `n = ${formatearNumero(fila.n ?? 0)}`,
    })),
  }
}

// ── Medios destacados ────────────────────────────────────────────────────────

interface FilaMedioRpc {
  medio_id: string
  medio: string
  comprometidas: number
  tasa_cumplimiento: number | null
}

/** Departamento de la zona para la RPC; `undefined` si la zona no está en Colombia. */
function departamentoDeZona(consulta: ConsultaDetalleGeo): string | null | undefined {
  switch (consulta.nivel) {
    case "internacional":
      return consulta.zona === CODIGO_COLOMBIA ? null : undefined
    case "nacional":
      return consulta.zona
    case "departamental":
      return consulta.departamento
  }
}

async function leerMediosDeZona(
  supabase: ClienteGeo,
  consulta: ConsultaDetalleGeo,
  departamento: string | null
): Promise<FilaMedioRpc[]> {
  const [reporte, delMunicipio] = await Promise.all([
    supabase.rpc(
      "reporte_cumplimiento_medios",
      argumentosRpc<"reporte_cumplimiento_medios">({
        p_desde: consulta.desde,
        p_hasta: consulta.hasta,
        p_departamento: departamento,
      })
    ),
    // La RPC agrupa por departamento: en un municipio se cruzan sus medios.
    consulta.nivel === "departamental"
      ? supabase.from("medios").select("id").eq("municipio_codigo", consulta.zona)
      : null,
  ])
  if (reporte.error) throw traducirError(reporte.error)
  if (delMunicipio?.error) throw traducirError(delMunicipio.error)
  const ids = delMunicipio ? new Set(delMunicipio.data.map(({ id }) => id)) : null
  return (reporte.data as FilaMedioRpc[]).filter(
    (fila) => fila.comprometidas > 0 && (!ids || ids.has(fila.medio_id))
  )
}

function lecturasMedios(
  supabase: ClienteGeo,
  consulta: ConsultaDetalleGeo
): Lectura<FilaMedioRpc[]>[] {
  const departamento = departamentoDeZona(consulta)
  if (!consulta.conMedios || departamento === undefined) return []
  return [() => leerMediosDeZona(supabase, consulta, departamento)]
}

function mediosDe(
  resultados: readonly PromiseSettledResult<FilaMedioRpc[]>[]
): TopZona | null {
  const resultado = resultados[0]
  if (resultado?.status !== "fulfilled" || resultado.value.length === 0) return null
  return {
    titulo: "Medios con más asignaciones",
    descripcion: "Asignaciones con entrega en el periodo y su cumplimiento.",
    metrica: "asignaciones",
    filas: resultado.value.slice(0, TOP).map((fila) => ({
      codigo: fila.medio_id,
      nombre: fila.medio,
      valor: fila.comprometidas,
      detalle:
        fila.tasa_cumplimiento === null
          ? null
          : `${formatearPorcentaje(Number(fila.tasa_cumplimiento), 0)} a tiempo`,
    })),
  }
}

// ── Composición ──────────────────────────────────────────────────────────────

export async function componerDetalle(
  supabase: ClienteGeo,
  consulta: ConsultaDetalleGeo
): Promise<RespuestaDetalleGeo> {
  const limitar = crearLimitador(LECTURAS_EN_VUELO)
  const [kpis, serie, top, medios] = await Promise.all([
    leer(limitar, lecturasKpi(supabase, consulta)),
    leer(limitar, lecturasSerie(supabase, consulta)),
    leer(limitar, lecturasTop(supabase, consulta)),
    leer(limitar, lecturasMedios(supabase, consulta)),
  ])
  const error = errorPrincipal(consulta, kpis)
  if (error) throw error
  return {
    consulta,
    kpis: kpisDe(consulta, kpis),
    ...serieDe(consulta, serie),
    top: topDe(consulta, top),
    medios: mediosDe(medios),
    origen: "base-de-datos",
  }
}
