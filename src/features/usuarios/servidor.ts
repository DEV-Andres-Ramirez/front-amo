import "server-only"

import { obtenerClaims } from "@/lib/auth/dal"
import type { UsuarioSesion } from "@/lib/auth/tipos"
import { envCliente } from "@/lib/env"
import { fallo, type ResultadoFallo } from "@/lib/result"
import { crearClienteAdmin } from "@/lib/supabase/admin"
import { obtenerContextoSolicitud } from "@/lib/supabase/contexto"
import { argumentosRpc } from "@/lib/supabase/rpc"
import type { Json } from "@/types/database.types"

import {
  codigoNegocio,
  esCorreoExistente,
  type ErrorAuth,
  type ErrorBd,
  MENSAJE_INESPERADO,
  mensajeErrorAuth,
  mensajeErrorBd,
} from "./errores"

/**
 * Utilidades de servidor de las acciones de Usuarios (no son acciones: no
 * llevan `"use server"`). Toda escritura privilegiada va con la secret key y el
 * actor en `x-amo-actor`, y la BD revalida actor, sesión y permisos (§2.4.4).
 */

/** Origen público para los enlaces (nunca el `Host` de la solicitud). */
export const SITIO = envCliente.NEXT_PUBLIC_SITE_URL

export type ClienteAdmin = Awaited<ReturnType<typeof crearClienteAdmin>>

export interface ContextoActor {
  actorId: string
  /** `session_id` del JWT: los `*_srv` validan que la sesión siga viva. */
  sessionId: string
  admin: ClienteAdmin
}

/**
 * Actor, sesión y cliente admin para una acción ya autorizada por el DAL.
 * Los claims vienen cacheados de la misma solicitud (`requerirPermiso`).
 */
export async function contextoDelActor(
  actor: UsuarioSesion
): Promise<ContextoActor> {
  const claims = await obtenerClaims()
  if (!claims || claims.usuarioId !== actor.id) {
    throw new Error("La sesión del actor no está disponible.")
  }
  return {
    actorId: actor.id,
    sessionId: claims.sessionId,
    admin: await crearClienteAdmin({ actorId: actor.id }),
  }
}

/** Log de servidor sin datos personales: operación y código. */
export function informar(operacion: string, error: unknown): void {
  const codigo =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : error instanceof Error
        ? error.name
        : "desconocido"
  console.error(`[usuarios] ${operacion} falló (${codigo})`)
}

/** Las reglas de negocio (`AMO_*`) son esperables y no se registran; lo demás sí. */
export function informarSiInesperado(operacion: string, error: ErrorBd): void {
  if (!codigoNegocio(error)) informar(operacion, error)
}

/** Error de la BD → resultado para la interfaz. */
export function falloBd(operacion: string, error: ErrorBd): ResultadoFallo {
  informarSiInesperado(operacion, error)
  return fallo(mensajeErrorBd(error))
}

export function falloAuth(operacion: string, error: ErrorAuth): ResultadoFallo {
  const mensaje = mensajeErrorAuth(error)
  if (esCorreoExistente(error)) return fallo(mensaje, { email: [mensaje] })
  informar(operacion, error)
  return fallo(mensaje)
}

export function falloInesperado(
  operacion: string,
  error: unknown
): ResultadoFallo {
  informar(operacion, error)
  return fallo(MENSAJE_INESPERADO)
}

type AccionAutorizable =
  "EDITAR" | "SUSPENDER" | "INVITAR" | "GENERAR_ENLACE" | "CERRAR_SESIONES"

/**
 * `autorizar_gestion_usuario_srv` (§5.4): permiso, sesión viva y
 * anti-escalada sobre el objetivo, ANTES de llamar a la Admin API de Auth
 * (que no pasa por los triggers guardianes). `null` si está autorizado.
 */
export async function autorizarGestion(
  contexto: ContextoActor,
  objetivoId: string | null,
  accion: AccionAutorizable
): Promise<ErrorBd | null> {
  const { error } = await contexto.admin.rpc(
    "autorizar_gestion_usuario_srv",
    argumentosRpc<"autorizar_gestion_usuario_srv">({
      p_actor_id: contexto.actorId,
      p_session_id: contexto.sessionId,
      p_objetivo: objetivoId,
      p_accion: accion,
    })
  )
  return error
}

export type AccionBitacoraUsuarios =
  "INVITAR" | "GENERAR_ENLACE" | "EXPORTAR" | "OTRO"

/**
 * Evento de aplicación en la bitácora (`registrar_evento_srv`). NUNCA lleva
 * enlaces, tokens ni contraseñas: solo el tipo de operación. Un fallo al
 * registrar no deshace la acción; queda en el log del servidor.
 */
export async function registrarEventoUsuarios(
  contexto: ContextoActor,
  evento: {
    accion: AccionBitacoraUsuarios
    entidad: string
    entidadId: string | null
    metadatos: Record<string, Json>
  }
): Promise<void> {
  try {
    const solicitud = await obtenerContextoSolicitud()
    const { error } = await contexto.admin.rpc(
      "registrar_evento_srv",
      argumentosRpc<"registrar_evento_srv">({
        p_actor_id: contexto.actorId,
        p_accion: evento.accion,
        p_entidad: evento.entidad,
        p_entidad_id: evento.entidadId,
        p_metadatos: evento.metadatos,
        p_ip: solicitud.ip,
        p_pais: solicitud.pais,
        p_ciudad: solicitud.ciudad,
        p_ua: solicitud.userAgent,
      })
    )
    if (error) throw error
  } catch (error) {
    informar(`registrar_evento_srv(${evento.accion})`, error)
  }
}

/** Bloqueo en Auth mientras la cuenta está suspendida o desactivada (~100 años). */
export const BLOQUEO_INDEFINIDO = "876000h"
export const SIN_BLOQUEO = "none"
