import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { instantesDelRango, parsearFecha, rangoPersonalizado } from "@/lib/fechas"
import { obtenerMunicipio } from "@/lib/geo/catalogo"
import { crearClienteServidor } from "@/lib/supabase/server"

import { fundirPuntos, puntosAlrededor } from "./azar"
import {
  DEFINICIONES_METRICAS,
  type MetricaGeo,
  metricaDisponibleEn,
  NIVEL_RPC,
  type NivelGeo,
} from "./metricas"
import { CODIGO_COLOMBIA } from "./niveles"
import { centrosSinPoligono } from "./sin-poligono"
import {
  type ConsultaDetalleGeo,
  type ConsultaMapaGeo,
  ErrorDatosGeo,
  type FilaMetricaGeo,
  type KpiZona,
  type ProveedorMetricasGeo,
  type PuntoGeo,
  type RespuestaDetalleGeo,
  type RespuestaMapaGeo,
  type TopZona,
} from "./tipos"

/**
 * Proveedor de producción: RPC `geo_metricas` (docs/modelo-datos.md §5.9,
 * `security invoker`: la RLS y `private.tiene_permiso('analitica.mapa')`
 * deciden) con el cliente del USUARIO. Mientras la migración 9 no exista,
 * responde "no disponible" con un mensaje claro en lugar de fallar.
 *
 * La RPC aún no está en `database.types.ts`: solo esa llamada va sin tipos
 * y cada fila se valida con zod (al regenerar los tipos puede tiparse). Las
 * tablas `accesos` y `medios` sí usan el cliente tipado.
 */

const FUNCION_INEXISTENTE = new Set(["PGRST202", "42883"])
const SIN_PERMISO = new Set(["42501"])

const MENSAJE_NO_DISPONIBLE =
  "El explorador todavía no tiene datos: falta la función de analítica geo_metricas en la base de datos (migración 9)."

/** Tope de filas para el mapa de calor (más no cambia su forma). */
const LIMITE_PUNTOS = 20_000

interface ErrorPostgrest {
  code?: string | null
  message?: string | null
  details?: string | null
}

function traducirError(error: ErrorPostgrest): ErrorDatosGeo {
  if (FUNCION_INEXISTENTE.has(error.code ?? "")) {
    return new ErrorDatosGeo("no-disponible", MENSAJE_NO_DISPONIBLE)
  }
  if (
    error.message === "AMO_NO_AUTORIZADO" ||
    SIN_PERMISO.has(error.code ?? "")
  ) {
    return new ErrorDatosGeo(
      "no-autorizado",
      "No tienes permiso para consultar esta métrica."
    )
  }
  if (error.message === "AMO_METRICA_NIVEL_INVALIDO") {
    return new ErrorDatosGeo(
      "consulta-invalida",
      error.details?.trim() ||
        "Esta métrica todavía no está disponible para este nivel del mapa."
    )
  }
  return new ErrorDatosGeo(
    "fallo",
    `No se pudieron consultar las métricas geográficas (${error.code ?? "sin código"}).`
  )
}

const numeroNulo = z
  .union([z.number(), z.string()])
  .nullable()
  .optional()
  .transform((valor) => {
    if (valor === null || valor === undefined) return null
    const numero = Number(valor)
    return Number.isFinite(numero) ? numero : null
  })

const esquemaFila = z.object({
  codigo: z.string().transform((valor) => valor.trim()),
  codigo_geometria: z.string().nullable().optional(),
  nombre: z.string(),
  valor: numeroNulo,
  n: numeroNulo,
  poblacion: numeroNulo,
  valor_por_100k: numeroNulo,
})

function aFila(
  fila: z.output<typeof esquemaFila>,
  nivel: NivelGeo
): FilaMetricaGeo {
  const geometria =
    fila.codigo_geometria?.trim() ||
    (nivel === "departamental"
      ? obtenerMunicipio(fila.codigo)?.codigoGeometria
      : undefined) ||
    fila.codigo
  return {
    codigo: fila.codigo,
    codigoGeometria: geometria,
    nombre: fila.nombre,
    valor: fila.valor,
    n: fila.n,
    poblacion: fila.poblacion,
    valorPor100k: fila.valor_por_100k,
  }
}

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>

async function geoMetricas(
  supabase: Cliente,
  consulta: ConsultaMapaGeo
): Promise<FilaMetricaGeo[]> {
  const sinTipos = supabase as unknown as SupabaseClient
  const { data, error } = await sinTipos.rpc("geo_metricas", {
    p_nivel: NIVEL_RPC[consulta.nivel],
    p_metrica: consulta.metrica,
    p_desde: consulta.desde,
    p_hasta: consulta.hasta,
    p_departamento: consulta.departamento,
  })
  if (error) throw traducirError(error)
  return z
    .array(esquemaFila)
    .parse(data ?? [])
    .map((fila) => aFila(fila, consulta.nivel))
}

// ── Puntos reales para el mapa de calor ──────────────────────────────────────

function rangoIso(consulta: ConsultaMapaGeo) {
  const desde = parsearFecha(consulta.desde)
  const hasta = parsearFecha(consulta.hasta)
  return desde && hasta
    ? instantesDelRango(rangoPersonalizado(desde, hasta))
    : null
}

/** Accesos exitosos con coordenadas (ya redondeadas a ≈ 1 km al registrarlos). */
async function puntosAccesos(
  supabase: Cliente,
  consulta: ConsultaMapaGeo
): Promise<PuntoGeo[] | null> {
  const rango = rangoIso(consulta)
  if (!rango) return null
  let peticion = supabase
    .from("accesos")
    .select("lat, lon")
    .eq("evento", "LOGIN_EXITOSO")
    .gte("created_at", rango.desde)
    .lt("created_at", rango.hastaExclusivo)
    .not("lat", "is", null)
    .not("lon", "is", null)
    .limit(LIMITE_PUNTOS)
  if (consulta.nivel === "nacional") {
    peticion = peticion.eq("pais_iso2", CODIGO_COLOMBIA)
  }
  if (consulta.nivel === "departamental" && consulta.departamento) {
    peticion = peticion.eq("departamento_codigo", consulta.departamento)
  }
  const { data, error } = await peticion
  if (error) return null
  return fundirPuntos(
    data.flatMap(({ lat, lon }) =>
      lat === null || lon === null ? [] : [[lon, lat, 1] as const]
    )
  )
}

/** Medios verificados en la cabecera de su municipio, dispersos ≈ 5 km. */
async function puntosMedios(
  supabase: Cliente,
  consulta: ConsultaMapaGeo
): Promise<PuntoGeo[] | null> {
  let peticion = supabase
    .from("medios")
    .select("municipio_codigo")
    .eq("estado", "VERIFICADO")
    .is("deleted_at", null)
    .limit(LIMITE_PUNTOS)
  if (consulta.nivel === "departamental" && consulta.departamento) {
    peticion = peticion.eq("departamento_codigo", consulta.departamento)
  }
  const { data, error } = await peticion
  // Sin la tabla (migración 6) o con un fallo, el mapa sigue sin capa de calor.
  if (error) return null
  const conteos = new Map<string, number>()
  for (const { municipio_codigo: codigo } of data) {
    conteos.set(codigo, (conteos.get(codigo) ?? 0) + 1)
  }
  return [...conteos].flatMap(([codigo, total]) => {
    const municipio = obtenerMunicipio(codigo)
    return municipio
      ? puntosAlrededor(municipio.centroide, total, `medios|${codigo}`, 0.05)
      : []
  })
}

async function puntosDe(
  supabase: Cliente,
  consulta: ConsultaMapaGeo
): Promise<PuntoGeo[] | null> {
  switch (consulta.metrica) {
    case "accesos":
      return puntosAccesos(supabase, consulta)
    case "medios":
      return consulta.nivel === "internacional"
        ? null
        : puntosMedios(supabase, consulta)
    default:
      return null
  }
}

// ── Detalle ──────────────────────────────────────────────────────────────────

async function kpisDeZona(
  supabase: Cliente,
  consulta: ConsultaDetalleGeo
): Promise<KpiZona[]> {
  const resultados = await Promise.allSettled(
    consulta.metricasKpi.map((metrica) =>
      geoMetricas(supabase, { ...consulta, metrica })
    )
  )
  const noDisponible = resultados.find(
    (r) =>
      r.status === "rejected" &&
      r.reason instanceof ErrorDatosGeo &&
      r.reason.motivo === "no-disponible"
  )
  if (noDisponible?.status === "rejected") throw noDisponible.reason

  return consulta.metricasKpi.map((metrica, indice) => {
    const resultado = resultados[indice]
    const fila =
      resultado.status === "fulfilled"
        ? resultado.value.find((f) => f.codigo === consulta.zona)
        : undefined
    return { metrica, valor: fila?.valor ?? null, n: fila?.n ?? null }
  })
}

function tituloTop(prefijo: string, metrica: MetricaGeo): string {
  const { aditiva, tituloCorto } = DEFINICIONES_METRICAS[metrica]
  return `${prefijo} con ${aditiva ? "más" : "mayor"} ${tituloCorto.toLowerCase()}`
}

/** Las cinco subzonas con mayor valor (municipios de un departamento o departamentos de Colombia). */
async function topSubzonas(
  supabase: Cliente,
  consulta: ConsultaDetalleGeo
): Promise<TopZona | null> {
  const subconsulta: ConsultaMapaGeo | null =
    consulta.nivel === "nacional"
      ? { ...consulta, nivel: "departamental", departamento: consulta.zona }
      : consulta.nivel === "internacional" && consulta.zona === CODIGO_COLOMBIA
        ? { ...consulta, nivel: "nacional", departamento: null }
        : null
  if (!subconsulta || !metricaDisponibleEn(consulta.metrica, subconsulta.nivel)) {
    return null
  }
  try {
    const filas = (await geoMetricas(supabase, subconsulta))
      .filter((f) => f.valor !== null)
      .sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0))
      .slice(0, 5)
    if (filas.length === 0) return null
    return {
      titulo: tituloTop(
        subconsulta.nivel === "nacional" ? "Departamentos" : "Municipios",
        consulta.metrica
      ),
      metrica: consulta.metrica,
      filas: filas.map((f) => ({
        codigo: f.codigo,
        nombre: f.nombre,
        valor: f.valor,
        detalle: DEFINICIONES_METRICAS[consulta.metrica].aditiva
          ? null
          : `n = ${f.n ?? 0}`,
      })),
    }
  } catch {
    // El top es complementario: su falla no tumba el detalle.
    return null
  }
}

export function crearProveedorSupabase(): ProveedorMetricasGeo {
  return {
    async mapa(consulta): Promise<RespuestaMapaGeo> {
      const supabase = await crearClienteServidor()
      const [filas, puntos] = await Promise.all([
        geoMetricas(supabase, consulta),
        puntosDe(supabase, consulta).catch(() => null),
      ])
      return {
        consulta,
        filas,
        puntos,
        sinPoligono: centrosSinPoligono(consulta.nivel, filas),
        origen: "base-de-datos",
      }
    },

    async detalle(consulta): Promise<RespuestaDetalleGeo> {
      const supabase = await crearClienteServidor()
      const [kpis, top] = await Promise.all([
        kpisDeZona(supabase, consulta),
        topSubzonas(supabase, consulta),
      ])
      return {
        consulta,
        kpis,
        // Pendiente en la BD: una RPC de serie por zona (p. ej. `geo_serie_zona`).
        serie: null,
        top,
        origen: "base-de-datos",
      }
    },
  }
}
