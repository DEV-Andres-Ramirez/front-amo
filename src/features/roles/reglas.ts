/**
 * Qué puede hacer el actor con un rol y con cada permiso. Refleja las guardas
 * de la BD (`fn_guardar_roles`, `fn_guardar_rol_permisos`, §5.4) para ofrecer
 * solo lo permitido y explicar por qué; la BD las garantiza igual. Módulo puro.
 */
import type { ClavePermiso } from "@/lib/auth/permisos"

import type { ActorRoles, RolListado } from "./tipos"

type ActorPermisos = Pick<ActorRoles, "permisos">

/** Anti-escalada: nadie otorga ni retira un permiso que no tiene. */
export function puedeOtorgar(
  actor: ActorPermisos,
  clave: ClavePermiso
): boolean {
  return actor.permisos.includes(clave)
}

/** Permisos de la lista que el actor no tiene (no puede otorgarlos ni retirarlos). */
export function fueraDeAlcance(
  actor: ActorPermisos,
  claves: readonly ClavePermiso[]
): ClavePermiso[] {
  return claves.filter((clave) => !puedeOtorgar(actor, clave))
}

/** Al duplicar o crear "desde" un rol: qué se copia y qué se omite por anti-escalada. */
export function permisosClonables(
  origen: readonly ClavePermiso[],
  actor: ActorPermisos
): { copiables: ClavePermiso[]; omitidos: ClavePermiso[] } {
  return {
    copiables: origen.filter((clave) => puedeOtorgar(actor, clave)),
    omitidos: fueraDeAlcance(actor, origen),
  }
}

export type MotivoSoloLectura =
  "superadmin" | "sistema" | "sin-permiso" | "propio"

type RolIdentificado = Pick<RolListado, "id" | "clave" | "esSistema">

/** Por qué la matriz de permisos del rol no se puede editar; `null` si se puede. */
export function motivoSoloLectura(
  rol: RolIdentificado,
  actor: Pick<ActorRoles, "rolId" | "puedeGestionar">
): MotivoSoloLectura | null {
  if (rol.clave === "SUPERADMIN") return "superadmin"
  if (rol.esSistema) return "sistema"
  if (!actor.puedeGestionar) return "sin-permiso"
  if (rol.id === actor.rolId) return "propio"
  return null
}

export type AccionesRol = {
  /** Editar datos: todos en un rol personalizado; en uno de sistema, solo descripción y color. */
  editar: boolean
  soloApariencia: boolean
  duplicar: boolean
  eliminar: boolean
  /** Si no se puede eliminar un rol personalizado, el porqué (para el tooltip). */
  motivoNoEliminar: string | null
}

function motivoParaNoEliminar(
  rol: RolListado,
  actor: ActorRoles
): string | null {
  if (rol.id === actor.rolId) return "Es tu propio rol."
  if (rol.asignados && rol.asignados > 0) {
    return rol.asignados === 1
      ? "Tiene 1 usuario asignado: reasígnalo a otro rol antes de eliminarlo."
      : `Tiene ${rol.asignados} usuarios asignados: reasígnalos a otro rol antes de eliminarlo.`
  }
  if (fueraDeAlcance(actor, rol.permisos).length > 0) {
    return "Incluye permisos que tú no tienes: no puedes retirarlos."
  }
  return null
}

export function accionesDisponibles(
  rol: RolListado,
  actor: ActorRoles
): AccionesRol {
  const gestiona = actor.puedeGestionar
  const motivo = rol.esSistema ? null : motivoParaNoEliminar(rol, actor)
  return {
    editar: gestiona,
    soloApariencia: rol.esSistema,
    duplicar: gestiona,
    eliminar: gestiona && !rol.esSistema && motivo === null,
    motivoNoEliminar: gestiona && !rol.esSistema ? motivo : null,
  }
}
