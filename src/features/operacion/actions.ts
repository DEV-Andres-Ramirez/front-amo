"use server"

/**
 * Server Actions de Operación (consulta). Cada una autoriza con el DAL, valida
 * con zod y deja que la BD vuelva a decidir: la RLS del usuario para leer y
 * los `*_srv` (actor + sesión + permiso) para lo privilegiado. Los errores
 * esperados se devuelven como `ResultadoAccion`; nunca se lanzan.
 */
import "server-only"

import { mensajeErrorBd } from "@/features/usuarios/errores"
import { requerirPermiso, tieneAlgunPermiso } from "@/lib/auth/dal"
import type { ClavePermiso } from "@/lib/auth/permisos"
import { desdeErrorZod, exito, fallo, type ResultadoAccion } from "@/lib/result"
import { crearClienteServidor } from "@/lib/supabase/server"

import { type DatoRevelado, grupoPrivado, presentarRevelados } from "./privados"
import {
  type EntidadExportable,
  type EntradaEvidencias,
  type EntradaExportacion,
  type EntradaRevelar,
  esquemaEvidencias,
  esquemaExportacion,
  esquemaRevelar,
} from "./schemas"
import { contextoDelActor, informar, registrarEvento } from "./servidor"

const MENSAJE_INESPERADO =
  "No pudimos completar la operación. Intenta de nuevo en unos minutos."

// ── Datos privados ───────────────────────────────────────────────────────────

export interface DatosRevelados {
  titulo: string
  datos: DatoRevelado[]
}

/**
 * Revela un grupo de datos `_privado` de un medio o anunciante. Exige
 * `datos_sensibles.ver` y poder ver la ficha; `revelar_privado_srv` vuelve a
 * validarlo y deja `REVELAR_DATO` en la bitácora con los campos pedidos.
 */
export async function revelarDatosPrivados(
  entrada: EntradaRevelar
): Promise<ResultadoAccion<DatosRevelados>> {
  const actor = await requerirPermiso("datos_sensibles.ver")
  const validacion = esquemaRevelar.safeParse(entrada)
  if (!validacion.success) return desdeErrorZod(validacion.error)
  const { entidad, id, grupo } = validacion.data
  const permisoFicha = entidad === "medio" ? "medios.ver" : "anunciantes.ver"
  if (!tieneAlgunPermiso(actor, [permisoFicha])) {
    return fallo("No tienes permiso para ver esta ficha.")
  }
  const definicion = grupoPrivado(entidad, grupo)
  if (!definicion) return fallo("Ese grupo de datos no existe.")

  try {
    const contexto = await contextoDelActor(actor)
    const { data, error } = await contexto.admin.rpc("revelar_privado_srv", {
      p_tabla: definicion.tabla,
      p_id: id,
      p_actor_id: contexto.actorId,
      p_session_id: contexto.sessionId,
      p_campos: definicion.campos.map((campo) => campo.campo),
    })
    if (error) {
      if (!error.message?.startsWith("AMO_")) informar("revelarDatosPrivados", error)
      return fallo(mensajeErrorBd(error))
    }
    return exito({
      titulo: definicion.titulo,
      datos: presentarRevelados(definicion, data),
    })
  } catch (error) {
    informar("revelarDatosPrivados", error)
    return fallo(MENSAJE_INESPERADO)
  }
}

// ── Evidencias (URL firmadas de corta duración) ──────────────────────────────

/** `archivos.vigencia_url_firmada_segundos` (§8). */
const VIGENCIA_URL_SEGUNDOS = 300
const BUCKET_EVIDENCIAS = "evidencias"
/** Capturas compartidas de los datos demo: solo se firman con la secret key (§10). */
const PREFIJO_MUESTRAS = "muestras/"

export interface ImagenEvidencia {
  /** Miniatura (o la captura si no hay miniatura). */
  miniatura: string | null
  captura: string | null
}

export interface ImagenesEvidencia {
  publicaciones: Record<string, ImagenEvidencia>
  metricas: Record<string, ImagenEvidencia>
}

interface FilaImagen {
  id: string
  captura_path: string
  miniatura_path: string | null
}

type Firmador = (rutas: string[]) => Promise<Map<string, string>>

function firmadorCon(
  almacen: ReturnType<
    Awaited<ReturnType<typeof crearClienteServidor>>["storage"]["from"]
  >
): Firmador {
  return async (rutas) => {
    if (rutas.length === 0) return new Map()
    const { data, error } = await almacen.createSignedUrls(
      rutas,
      VIGENCIA_URL_SEGUNDOS
    )
    if (error) throw error
    return new Map(
      data.flatMap((firmada) =>
        firmada.path && firmada.signedUrl && !firmada.error
          ? [[firmada.path, firmada.signedUrl] as const]
          : []
      )
    )
  }
}

function rutasDe(filas: readonly FilaImagen[]): string[] {
  return filas.flatMap((fila) =>
    fila.miniatura_path ? [fila.captura_path, fila.miniatura_path] : [fila.captura_path]
  )
}

function imagenesPorFila(
  filas: readonly FilaImagen[],
  firmadas: ReadonlyMap<string, string>
): Record<string, ImagenEvidencia> {
  return Object.fromEntries(
    filas.map((fila) => {
      const captura = firmadas.get(fila.captura_path) ?? null
      const miniatura = fila.miniatura_path
        ? (firmadas.get(fila.miniatura_path) ?? captura)
        : captura
      return [fila.id, { miniatura, captura }]
    })
  )
}

/**
 * Firma las capturas de evidencia y métricas de una asignación (300 s). Las
 * rutas salen de las filas que el USUARIO puede leer (RLS), nunca del cliente:
 * - `asignacion/<id>/…`: se firman con el cliente del usuario (regla 1, §8).
 * - `muestras/…` (datos demo): con la secret key tras leer la fila, dejando
 *   `URL_FIRMADA` en la bitácora (regla 2). Sin ese registro no se entregan.
 */
export async function firmarEvidencias(
  entrada: EntradaEvidencias
): Promise<ResultadoAccion<ImagenesEvidencia>> {
  const actor = await requerirPermiso("asignaciones.ver")
  const validacion = esquemaEvidencias.safeParse(entrada)
  if (!validacion.success) return desdeErrorZod(validacion.error)
  const { asignacionId } = validacion.data

  try {
    const supabase = await crearClienteServidor()
    const [publicaciones, metricas] = await Promise.all([
      supabase
        .from("publicaciones")
        .select("id, captura_path, miniatura_path")
        .eq("asignacion_id", asignacionId),
      supabase
        .from("metricas")
        .select("id, captura_path, miniatura_path")
        .eq("asignacion_id", asignacionId),
    ])
    if (publicaciones.error) throw publicaciones.error
    if (metricas.error) throw metricas.error

    const rutas = [
      ...new Set([...rutasDe(publicaciones.data), ...rutasDe(metricas.data)]),
    ]
    const prefijoPropio = `asignacion/${asignacionId}/`
    const propias = rutas.filter((ruta) => ruta.startsWith(prefijoPropio))
    const muestras = rutas.filter((ruta) => ruta.startsWith(PREFIJO_MUESTRAS))

    const firmadas = await firmadorCon(supabase.storage.from(BUCKET_EVIDENCIAS))(
      propias
    )
    if (muestras.length > 0) {
      const contexto = await contextoDelActor(actor)
      const registrado = await registrarEvento(contexto, {
        accion: "URL_FIRMADA",
        entidad: "asignaciones",
        entidadId: asignacionId,
        metadatos: {
          bucket: BUCKET_EVIDENCIAS,
          rutas: muestras,
          expira_s: VIGENCIA_URL_SEGUNDOS,
        },
      })
      if (registrado) {
        const deMuestras = await firmadorCon(
          contexto.admin.storage.from(BUCKET_EVIDENCIAS)
        )(muestras)
        for (const [ruta, url] of deMuestras) firmadas.set(ruta, url)
      }
    }

    return exito({
      publicaciones: imagenesPorFila(publicaciones.data, firmadas),
      metricas: imagenesPorFila(metricas.data, firmadas),
    })
  } catch (error) {
    informar("firmarEvidencias", error)
    return fallo("No pudimos cargar las capturas. Intenta de nuevo.")
  }
}

// ── Exportaciones ────────────────────────────────────────────────────────────

const PERMISO_EXPORTACION: Readonly<Record<EntidadExportable, ClavePermiso>> = {
  medios: "medios.ver",
  anunciantes: "anunciantes.ver",
  campanas: "campanas.ver",
  asignaciones: "asignaciones.ver",
}

/** Deja `EXPORTAR` en la bitácora tras generar un CSV/Excel de un listado. */
export async function registrarExportacionOperacion(
  entrada: EntradaExportacion
): Promise<ResultadoAccion> {
  const actor = await requerirPermiso(Object.values(PERMISO_EXPORTACION))
  const validacion = esquemaExportacion.safeParse(entrada)
  if (!validacion.success) return desdeErrorZod(validacion.error)
  const { entidad, formato, filas } = validacion.data
  if (!tieneAlgunPermiso(actor, [PERMISO_EXPORTACION[entidad]])) {
    return fallo("No tienes permiso para consultar este listado.")
  }

  try {
    const contexto = await contextoDelActor(actor)
    const registrado = await registrarEvento(contexto, {
      accion: "EXPORTAR",
      entidad,
      entidadId: null,
      metadatos: { formato, filas },
    })
    return registrado
      ? exito()
      : fallo("No se pudo registrar la exportación en la bitácora.")
  } catch (error) {
    informar("registrarExportacionOperacion", error)
    return fallo(MENSAJE_INESPERADO)
  }
}
