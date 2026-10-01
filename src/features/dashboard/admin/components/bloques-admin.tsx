import "server-only"

import { alertasSospechosas, totalSospechosos } from "@/features/accesos/queries"
import { tramoLineaTiempo } from "@/features/auditoria/queries"
import { PanelInsights } from "@/features/dashboard/insights/components/panel-insights"
import { generarInsights } from "@/features/dashboard/insights/motor"
import { NOMBRES_PLATAFORMA } from "@/features/dashboard/insights/textos"
import { tieneAlgunPermiso } from "@/lib/auth/dal"
import type { UsuarioSesion } from "@/lib/auth/tipos"
import {
  instantesDelRango,
  rangoDesdePreset,
  serializarFecha,
} from "@/lib/fechas"

import { TarjetasKpi } from "../../components/tarjetas-kpi"
import { indicePorKpi } from "../../kpi"
import {
  etiquetaComparacionCorta,
  granularidadPara,
  type PeriodoPanel,
} from "../../periodo"
import { configAnalitica } from "../../servidor"
import { tarjetasAdmin } from "../../tarjetas"
import {
  baseSalud,
  celdasCalor,
  combinarZonas,
  cpmPorPlataforma,
  embudoVacio,
  entradaInsightsAdmin,
  etapasEmbudo,
  type FuenteActividad,
  mediosEnRiesgoEntrada,
  ORDEN_PLATAFORMAS,
  rankingFormatos,
  segmentosPlataforma,
  segmentosSalud,
  tendenciaGmv,
  valoresMapa,
  vencidasDelPeriodo,
} from "../datos"
import {
  accesosSospechosos,
  actividadHeatmap,
  cumplimientoMedios,
  embudoAsignaciones,
  gmvVerificado90Dias,
  kpisAdmin,
  mediosEnRiesgo,
  metricasAtipicasPendientes,
  mezclaPlataformas,
  saludMedios,
  serieGmv,
  zonasGmv,
} from "../queries"
import { ActividadReciente } from "./actividad-reciente"
import { AlertasPanel, hrefAccesosSospechosos } from "./alertas-panel"
import { DepartamentosPanel } from "./departamentos-panel"
import {
  GraficoEmbudoPanel,
  GraficoFormatos,
  GraficoPlataformas,
  GraficoTendenciaGmv,
} from "./graficos-admin"
import { MapaCalorPanel } from "./mapa-calor-panel"
import { SaludMedios } from "./salud-medios"

/**
 * Bloques del panel general: cada uno es un Server Component asíncrono que
 * consulta lo suyo y se envuelve en `BloquePanel` (Suspense + límite de
 * error). Las consultas están memorizadas por solicitud, así el motor de
 * insights reutiliza las respuestas de los demás bloques.
 */

interface PropsPeriodo {
  periodo: PeriodoPanel
}

export async function BloqueKpisAdmin({ periodo }: PropsPeriodo) {
  const [filas, config] = await Promise.all([
    kpisAdmin(
      periodo.desde,
      periodo.hasta,
      periodo.desdeAnterior,
      periodo.hastaAnterior
    ),
    configAnalitica(),
  ])
  return (
    <TarjetasKpi
      etiqueta="Indicadores del periodo"
      filas={filas}
      tarjetas={tarjetasAdmin(indicePorKpi(filas))}
      nMinimo={config.nMinimo}
      etiquetaComparacion={etiquetaComparacionCorta(periodo.rango)}
    />
  )
}

export async function BloqueTendenciaGmv({ periodo }: PropsPeriodo) {
  const granularidad = granularidadPara(periodo.dias)
  const puntos = await serieGmv(periodo.desde, periodo.hasta, granularidad)
  return <GraficoTendenciaGmv datos={tendenciaGmv(puntos, granularidad)} />
}

export async function BloqueEmbudo({ periodo }: PropsPeriodo) {
  const etapas = etapasEmbudo(
    await embudoAsignaciones(periodo.desde, periodo.hasta)
  )
  return <GraficoEmbudoPanel etapas={etapas} vacio={embudoVacio(etapas)} />
}

export async function BloquePlataformas({ periodo }: PropsPeriodo) {
  const filas = await mezclaPlataformas(periodo.desde, periodo.hasta)
  const cpm = cpmPorPlataforma(filas)
  return (
    <GraficoPlataformas
      segmentos={segmentosPlataforma(filas)}
      cpm={ORDEN_PLATAFORMAS.map((plataforma) => ({
        nombre: NOMBRES_PLATAFORMA[plataforma],
        cpm: cpm.get(plataforma) ?? null,
        familia: plataforma === "TIKTOK" ? "reproducciones" : "impresiones",
      }))}
    />
  )
}

export async function BloqueFormatos({ periodo }: PropsPeriodo) {
  const filas = await mezclaPlataformas(periodo.desde, periodo.hasta)
  return <GraficoFormatos elementos={rankingFormatos(filas)} />
}

export async function BloqueDepartamentos({
  periodo,
  usuario,
}: PropsPeriodo & { usuario: UsuarioSesion }) {
  const [actual, anterior] = await Promise.all([
    zonasGmv(periodo.desde, periodo.hasta),
    zonasGmv(periodo.desdeAnterior, periodo.hastaAnterior),
  ])
  return (
    <DepartamentosPanel
      zonas={combinarZonas(actual, anterior)}
      valores={valoresMapa(actual)}
      periodo={{ desde: periodo.desde, hasta: periodo.hasta }}
      conEnlaces={tieneAlgunPermiso(usuario, ["analitica.mapa"])}
    />
  )
}

export async function BloqueSaludMedios({
  periodo,
  ahora,
}: PropsPeriodo & { ahora: Date }) {
  const [filas, enRiesgo] = await Promise.all([
    saludMedios(periodo.desde, periodo.hasta),
    mediosEnRiesgo(5),
  ])
  const segmentos = segmentosSalud(filas)
  return (
    <SaludMedios
      segmentos={segmentos}
      base={baseSalud(segmentos)}
      enRiesgo={enRiesgo}
      ahora={ahora}
    />
  )
}

export async function BloqueActividad({
  periodo,
  fuentes,
}: PropsPeriodo & { fuentes: readonly FuenteActividad[] }) {
  const celdas = await Promise.all(
    fuentes.map(async (fuente) => [
      fuente,
      celdasCalor(await actividadHeatmap(periodo.desde, periodo.hasta, fuente)),
    ] as const)
  )
  return <MapaCalorPanel fuentes={Object.fromEntries(celdas)} />
}

/** Un dato opcional del motor: si falla, la regla que lo usa se omite. */
async function opcional<T>(
  operacion: string,
  consulta: (() => Promise<T>) | false
): Promise<T | undefined> {
  if (!consulta) return undefined
  try {
    return await consulta()
  } catch (error) {
    const codigo = error instanceof Error ? error.name : "desconocido"
    console.error(`[inicio] ${operacion} falló (${codigo})`)
    return undefined
  }
}

export async function BloqueInsights({
  periodo,
  usuario,
  ahora,
}: PropsPeriodo & { usuario: UsuarioSesion; ahora: Date }) {
  const puede = (permiso: Parameters<typeof tieneAlgunPermiso>[1][number]) =>
    tieneAlgunPermiso(usuario, [permiso])
  const { desde, hasta, desdeAnterior, hastaAnterior } = periodo
  const instantes = instantesDelRango(periodo.rango)

  const [kpis, config] = await Promise.all([
    kpisAdmin(desde, hasta, desdeAnterior, hastaAnterior),
    configAnalitica(),
  ])
  const [
    zonasActual,
    zonasAnterior,
    mezclaActual,
    mezclaAnterior,
    cumplimiento,
    salud,
    riesgo,
    gmv90,
    atipicas,
    sospechosos,
  ] = await Promise.all([
    opcional("zonas", puede("analitica.global") && (() => zonasGmv(desde, hasta))),
    opcional(
      "zonas anteriores",
      puede("analitica.global") &&
        (() => zonasGmv(desdeAnterior, hastaAnterior))
    ),
    opcional("mezcla", () => mezclaPlataformas(desde, hasta)),
    opcional("mezcla anterior", () =>
      mezclaPlataformas(desdeAnterior, hastaAnterior)
    ),
    opcional(
      "cumplimiento",
      puede("reportes.ver") && (() => cumplimientoMedios(desde, hasta))
    ),
    opcional("salud", () => saludMedios(desde, hasta)),
    opcional("medios en riesgo", () => mediosEnRiesgo(5)),
    opcional("gmv 90 días", () => gmvVerificado90Dias(serializarFecha(ahora))),
    opcional(
      "métricas atípicas",
      puede("asignaciones.ver") && (() => metricasAtipicasPendientes())
    ),
    opcional(
      "accesos sospechosos",
      puede("accesos.ver") &&
        (() => accesosSospechosos(instantes.desde, instantes.hastaExclusivo))
    ),
  ])

  const insights = generarInsights(
    entradaInsightsAdmin({
      periodo: { desde, hasta },
      ahora,
      kpis,
      config,
      zonasGmv:
        zonasActual && zonasAnterior
          ? { actual: zonasActual, anterior: zonasAnterior }
          : undefined,
      mezcla:
        mezclaActual && mezclaAnterior
          ? { actual: mezclaActual, anterior: mezclaAnterior }
          : undefined,
      vencidas: cumplimiento ? vencidasDelPeriodo(cumplimiento) : undefined,
      mediosEnRiesgo: salud
        ? mediosEnRiesgoEntrada(salud, riesgo ?? [], gmv90 ?? null)
        : undefined,
      metricasAtipicas: atipicas,
      accesosSospechosos: sospechosos,
    })
  )
  return <PanelInsights insights={insights} />
}

/** Los cambios más recientes de la bitácora (últimos 30 días). */
export async function BloqueActividadReciente({
  usuario,
  ahora,
}: {
  usuario: UsuarioSesion
  ahora: Date
}) {
  const tramo = await tramoLineaTiempo(
      { q: "", accion: [], entidad: [], actor: [], origen: [], grupo: [] },
      rangoDesdePreset("ultimos30", ahora),
      null,
      usuario
    )
  return <ActividadReciente eventos={tramo.eventos.slice(0, 6)} ahora={ahora} />
}

export async function BloqueAlertas({
  periodo,
  usuario,
  ahora,
}: PropsPeriodo & { usuario: UsuarioSesion; ahora: Date }) {
  const conAccesos = tieneAlgunPermiso(usuario, ["accesos.ver"])
  const conAtipicas = tieneAlgunPermiso(usuario, ["asignaciones.ver"])
  const [total, recientes, atipicas] = await Promise.all([
    conAccesos ? totalSospechosos(periodo.rango) : 0,
    conAccesos ? alertasSospechosas(periodo.rango, usuario) : [],
    conAtipicas ? metricasAtipicasPendientes() : null,
  ])
  return (
    <AlertasPanel
      accesos={
        conAccesos
          ? {
              total,
              recientes,
              href: hrefAccesosSospechosos({
                desde: periodo.desde,
                hasta: periodo.hasta,
              }),
            }
          : null
      }
      atipicas={atipicas}
      ahora={ahora}
    />
  )
}
