import "server-only"

import { cache } from "react"

import { perfilesVisibles } from "@/features/auditoria/servidor"
import { tieneAlgunPermiso } from "@/lib/auth/dal"
import type { UsuarioSesion } from "@/lib/auth/tipos"
import { crearClienteAdmin } from "@/lib/supabase/admin"
import { obtenerContextoSolicitud } from "@/lib/supabase/contexto"
import { argumentosRpc } from "@/lib/supabase/rpc"
import { crearClienteServidor } from "@/lib/supabase/server"
import type { Json } from "@/types/database.types"

import { esSlugReporte, type SlugReporte } from "./catalogo"

/**
 * Utilidades de servidor de los reportes (no son acciones): errores de
 * consulta, parámetros de analítica, opciones de los filtros y la bitácora de
 * exportaciones. Las lecturas usan el cliente del USUARIO: la RLS y las RPC
 * vuelven a exigir sus permisos.
 */

export interface ErrorConsulta {
  code?: string | null
  message?: string | null
}

/** Un error de lectura se lanza: lo recoge el límite de error del reporte. */
export function fallar(operacion: string, error: ErrorConsulta): never {
  throw new Error(
    `No se pudo ${operacion} (${error.code ?? "sin código"}${error.message?.startsWith("AMO_") ? ` ${error.message}` : ""}).`
  )
}

/** Log de servidor sin datos personales. */
export function informar(operacion: string, error: unknown): void {
  const codigo =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : error instanceof Error
        ? error.name
        : "desconocido"
  console.error(`[reportes] ${operacion} falló (${codigo})`)
}

type Respuesta<T> = PromiseLike<{ data: T | null; error: ErrorConsulta | null }>

/** Espera una consulta y devuelve sus filas, o lanza con la operación en el mensaje. */
export async function leer<T>(operacion: string, consulta: Respuesta<T>): Promise<T> {
  const { data, error } = await consulta
  if (error) fallar(operacion, error)
  if (data === null) throw new Error(`No se pudo ${operacion} (sin datos).`)
  return data
}

/** Número finito o `null` (PostgREST puede entregar `numeric` como texto). */
export function numeroONulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null
  const numero = typeof valor === "number" ? valor : Number(valor)
  return Number.isFinite(numero) ? numero : null
}

export function numero(valor: unknown): number {
  return numeroONulo(valor) ?? 0
}

const N_MINIMO_POR_DEFECTO = 20

/**
 * `analitica.n_minimo_tasas` (docs/modelo-datos.md §7). Quien no puede leer
 * la configuración recibe el valor por defecto: es el mismo que usa la BD.
 */
export const nMinimoTasas = cache(async (): Promise<number> => {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from("configuracion")
    .select("valor")
    .eq("clave", "analitica.n_minimo_tasas")
    .maybeSingle()
  const valor = numeroONulo(data?.valor)
  return valor !== null && valor >= 1 ? Math.round(valor) : N_MINIMO_POR_DEFECTO
})

// ── Opciones de los filtros ──────────────────────────────────────────────────

export interface OpcionCatalogo {
  id: string
  nombre: string
}

const LIMITE_ANUNCIANTES = 1000

/** Anunciantes para el filtro (requiere `anunciantes.ver`; sin él, lista vacía). */
export const opcionesAnunciantes = cache(
  async (usuario: UsuarioSesion): Promise<OpcionCatalogo[]> => {
    if (!tieneAlgunPermiso(usuario, ["anunciantes.ver"])) return []
    const supabase = await crearClienteServidor()
    const filas = await leer(
      "listar los anunciantes",
      supabase
        .from("anunciantes")
        .select("id, nombre_comercial")
        .is("deleted_at", null)
        .order("nombre_comercial")
        .limit(LIMITE_ANUNCIANTES)
    )
    return filas.map((fila) => ({ id: fila.id, nombre: fila.nombre_comercial }))
  }
)

export const opcionesSectores = cache(async (): Promise<OpcionCatalogo[]> => {
  const supabase = await crearClienteServidor()
  const filas = await leer(
    "listar los sectores",
    supabase
      .from("sectores")
      .select("id, nombre")
      .is("deleted_at", null)
      .order("orden")
      .order("nombre")
  )
  return filas.map((fila) => ({ id: fila.id, nombre: fila.nombre }))
})

// ── Bitácora de exportaciones ────────────────────────────────────────────────

export const ENTIDAD_REPORTES = "reportes"

/**
 * `EXPORTAR` en la bitácora (entidad `reportes`, id = el reporte) con el
 * formato, las filas y los filtros. Se registra ANTES de entregar los datos:
 * la exportación queda auditada aunque el navegador no genere el archivo.
 */
export async function registrarExportacionReporte(
  actor: UsuarioSesion,
  reporte: SlugReporte,
  metadatos: Record<string, Json>
): Promise<boolean> {
  try {
    const [admin, solicitud] = await Promise.all([
      crearClienteAdmin({ actorId: actor.id }),
      obtenerContextoSolicitud(),
    ])
    const { error } = await admin.rpc(
      "registrar_evento_srv",
      argumentosRpc<"registrar_evento_srv">({
        p_actor_id: actor.id,
        p_accion: "EXPORTAR",
        p_entidad: ENTIDAD_REPORTES,
        p_entidad_id: reporte,
        p_metadatos: metadatos,
        p_ip: solicitud.ip,
        p_pais: solicitud.pais,
        p_ciudad: solicitud.ciudad,
        p_ua: solicitud.userAgent,
      })
    )
    if (error) throw error
    return true
  } catch (error) {
    informar(`registrar_evento_srv(EXPORTAR ${reporte})`, error)
    return false
  }
}

export interface UltimaExportacion {
  at: string
  formato: string | null
  /** Nombre de quien exportó; `null` si es la propia persona o no es visible. */
  por: string | null
  propia: boolean
}

const EXPORTACIONES_REVISADAS = 200

function formatoDe(metadatos: Json): string | null {
  if (metadatos && typeof metadatos === "object" && !Array.isArray(metadatos)) {
    const formato = metadatos.formato
    return typeof formato === "string" ? formato : null
  }
  return null
}

/** Con `auditoria.ver`: la última exportación de cada reporte, de cualquier persona. */
async function ultimasDelEquipo(
  usuario: UsuarioSesion
): Promise<Partial<Record<SlugReporte, UltimaExportacion>>> {
  const supabase = await crearClienteServidor()
  const filas = await leer(
    "leer las exportaciones de reportes",
    supabase
      .from("bitacora")
      .select("entidad_id, created_at, actor_id, metadatos")
      .eq("accion", "EXPORTAR")
      .eq("entidad", ENTIDAD_REPORTES)
      .order("id", { ascending: false })
      .limit(EXPORTACIONES_REVISADAS)
  )
  const primeras = new Map<SlugReporte, (typeof filas)[number]>()
  for (const fila of filas) {
    const slug = fila.entidad_id
    if (slug && esSlugReporte(slug) && !primeras.has(slug)) primeras.set(slug, fila)
  }
  const actores = [...primeras.values()].flatMap((f) => (f.actor_id ? [f.actor_id] : []))
  const perfiles = await perfilesVisibles(actores)
  return Object.fromEntries(
    [...primeras].map(([slug, fila]) => {
      const propia = fila.actor_id === usuario.id
      const perfil = fila.actor_id ? perfiles.get(fila.actor_id) : undefined
      return [
        slug,
        {
          at: fila.created_at,
          formato: formatoDe(fila.metadatos),
          por: propia ? null : (perfil?.nombre ?? null),
          propia,
        },
      ]
    })
  )
}

/** Sin `auditoria.ver`: la última exportación propia (actividad reciente). */
async function ultimasPropias(): Promise<
  Partial<Record<SlugReporte, UltimaExportacion>>
> {
  const supabase = await crearClienteServidor()
  const filas = await leer(
    "leer tu actividad",
    supabase.rpc("mi_actividad", { p_limite: EXPORTACIONES_REVISADAS })
  )
  const resultado: Partial<Record<SlugReporte, UltimaExportacion>> = {}
  for (const fila of filas) {
    const slug = fila.entidad_id
    if (
      fila.accion === "EXPORTAR" &&
      fila.entidad === ENTIDAD_REPORTES &&
      slug &&
      esSlugReporte(slug) &&
      !resultado[slug]
    ) {
      resultado[slug] = { at: fila.created_at, formato: null, por: null, propia: true }
    }
  }
  return resultado
}

/** Última exportación por reporte para el centro de reportes. Un fallo no rompe la página. */
export async function ultimasExportaciones(
  usuario: UsuarioSesion
): Promise<Partial<Record<SlugReporte, UltimaExportacion>>> {
  try {
    return tieneAlgunPermiso(usuario, ["auditoria.ver"])
      ? await ultimasDelEquipo(usuario)
      : await ultimasPropias()
  } catch (error) {
    informar("ultimasExportaciones", error)
    return {}
  }
}
