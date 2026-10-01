import type { NextRequest } from "next/server"

import { leerParametrosGeo, type ParametrosGeo } from "@/features/geo/esquemas"
import { metricaPermitida } from "@/features/geo/metricas"
import { obtenerProveedorGeo } from "@/features/geo/proveedor-servidor"
import {
  type ErrorApiGeo,
  ErrorDatosGeo,
  type MotivoErrorGeo,
  type ProveedorMetricasGeo,
} from "@/features/geo/tipos"
import {
  evaluarAcceso,
  tieneAlgunPermiso,
  verificarVigencia,
} from "@/lib/auth/dal"
import type { ClavePermiso } from "@/lib/auth/permisos"
import type { UsuarioSesion } from "@/lib/auth/tipos"
import { desdeErrorZod } from "@/lib/result"

/**
 * GET /api/geo/metricas — datos del explorador geográfico.
 *
 *   ?nivel=nacional&metrica=medios&desde=2026-09-01&hasta=2026-09-30
 *   ?vista=puntos&nivel=internacional&metrica=accesos&…       (modo calor)
 *   ?vista=detalle&nivel=departamental&depto=05&zona=05001&metrica=gmv&…
 *
 * Autoriza con el DAL (sesión vigente + `analitica.mapa`, y `accesos.ver`
 * para la métrica de accesos) y responde JSON con estados HTTP reales (el
 * cliente es React Query, no una navegación). La BD vuelve a autorizar: la
 * RPC es `security invoker` y las tablas de los puntos aplican su RLS.
 *
 * El detalle se compone aquí, en una sola solicitud, mientras la BD no tenga
 * `detalle_zona_geo` (KPI, evolución y destacados en paralelo).
 */

/** Caché del navegador corta y privada (los datos dependen de los permisos). */
const CACHE_PRIVADA = "private, max-age=60"

const ESTADO_POR_MOTIVO: Readonly<Record<MotivoErrorGeo, number>> = {
  "no-disponible": 503,
  "no-autorizado": 403,
  "consulta-invalida": 422,
  fallo: 502,
}

function responderError(
  estado: number,
  error: ErrorApiGeo["error"]
): Response {
  return Response.json({ error } satisfies ErrorApiGeo, {
    status: estado,
    headers: { "Cache-Control": "no-store" },
  })
}

async function autorizar(): Promise<UsuarioSesion | Response> {
  const acceso = await evaluarAcceso()
  if (
    acceso.tipo !== "listo" ||
    (await verificarVigencia(acceso.claims)) !== "VIGENTE"
  ) {
    return responderError(401, {
      motivo: "sin-sesion",
      mensaje: "Tu sesión terminó. Vuelve a ingresar para ver el mapa.",
    })
  }
  if (!tieneAlgunPermiso(acceso.usuario, ["analitica.mapa"])) {
    return responderError(403, {
      motivo: "no-autorizado",
      mensaje: "No tienes permiso para usar el explorador geográfico.",
    })
  }
  return acceso.usuario
}

/** En desarrollo, cómo ver el mapa sin la RPC; nunca en producción. */
function pistaDesarrollo(motivo: MotivoErrorGeo): string | undefined {
  return motivo === "no-disponible" && process.env.NODE_ENV !== "production"
    ? "Para desarrollar sin la RPC, inicia el servidor con AMO_GEO_MOCK=1."
    : undefined
}

function consultar(
  proveedor: ProveedorMetricasGeo,
  parametros: ParametrosGeo,
  tienePermiso: (permiso: ClavePermiso) => boolean
) {
  switch (parametros.vista) {
    case "mapa":
      return proveedor.mapa(parametros.consulta)
    case "puntos":
      return proveedor.puntos(parametros.consulta)
    case "detalle":
      return proveedor.detalle({
        ...parametros.consulta,
        metricasKpi: parametros.consulta.metricasKpi.filter((metrica) =>
          metricaPermitida(metrica, tienePermiso)
        ),
        conMedios: tienePermiso("reportes.ver"),
      })
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const usuario = await autorizar()
    if (usuario instanceof Response) return usuario

    const parametros = leerParametrosGeo(request.nextUrl.searchParams)
    if (!parametros.ok) {
      const { error, erroresCampo } = desdeErrorZod(parametros.error)
      return responderError(400, {
        motivo: "consulta-invalida",
        mensaje: Object.values(erroresCampo ?? {})[0]?.[0] ?? error,
      })
    }

    const tienePermiso = (permiso: ClavePermiso) =>
      tieneAlgunPermiso(usuario, [permiso])
    if (!metricaPermitida(parametros.datos.consulta.metrica, tienePermiso)) {
      return responderError(403, {
        motivo: "no-autorizado",
        mensaje: "No tienes permiso para consultar esta métrica.",
      })
    }

    const cuerpo = await consultar(
      await obtenerProveedorGeo(),
      parametros.datos,
      tienePermiso
    )
    return Response.json(cuerpo, {
      headers: { "Cache-Control": CACHE_PRIVADA, Vary: "Cookie" },
    })
  } catch (error) {
    if (error instanceof ErrorDatosGeo) {
      return responderError(ESTADO_POR_MOTIVO[error.motivo], {
        motivo: error.motivo,
        mensaje: error.message,
        pista: pistaDesarrollo(error.motivo),
      })
    }
    // Sin PII: solo el tipo de error.
    console.error(
      JSON.stringify({
        nivel: "error",
        evento: "geo_metricas_inesperado",
        tipo: error instanceof Error ? error.name : typeof error,
      })
    )
    return responderError(500, {
      motivo: "fallo",
      mensaje: "No pudimos cargar el mapa. Intenta de nuevo en unos segundos.",
    })
  }
}
