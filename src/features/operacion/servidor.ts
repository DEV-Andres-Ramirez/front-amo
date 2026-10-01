import "server-only"

import { obtenerClaims } from "@/lib/auth/dal"
import type { UsuarioSesion } from "@/lib/auth/tipos"
import { crearClienteAdmin } from "@/lib/supabase/admin"
import { obtenerContextoSolicitud } from "@/lib/supabase/contexto"
import { argumentosRpc } from "@/lib/supabase/rpc"
import type { Json } from "@/types/database.types"

/**
 * Utilidades de servidor de las acciones de operación (no son acciones: no
 * llevan `"use server"`). Las lecturas privilegiadas van con la secret key y
 * el actor en `x-amo-actor`; la BD revalida actor, sesión y permiso.
 */

export type ClienteAdmin = Awaited<ReturnType<typeof crearClienteAdmin>>

export interface ContextoActor {
  actorId: string
  /** `session_id` del JWT: los `*_srv` validan que la sesión siga viva. */
  sessionId: string
  admin: ClienteAdmin
}

/** Actor, sesión y cliente admin para una acción ya autorizada por el DAL. */
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
  console.error(`[operacion] ${operacion} falló (${codigo})`)
}

/**
 * Evento de aplicación en la bitácora (`registrar_evento_srv`). Devuelve si
 * quedó registrado: las acciones que lo exigen no entregan datos sin él.
 */
export async function registrarEvento(
  contexto: Pick<ContextoActor, "actorId" | "admin">,
  evento: {
    accion: "EXPORTAR" | "URL_FIRMADA"
    entidad: string
    entidadId: string | null
    metadatos: Record<string, Json>
  }
): Promise<boolean> {
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
    return true
  } catch (error) {
    informar(`registrar_evento_srv(${evento.accion})`, error)
    return false
  }
}
