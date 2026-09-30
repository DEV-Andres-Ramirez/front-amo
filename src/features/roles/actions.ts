"use server"

/**
 * Server Actions de Roles y permisos. Patrón de cada acción:
 *
 * 1. `requerirPermiso("roles.gestionar")` (DAL): sesión al día + permiso.
 * 2. zod: el MISMO esquema que el formulario del cliente.
 * 3. Reglas que la interfaz ya aplicó (rol de sistema, rol propio,
 *    anti-escalada), de nuevo en el servidor para responder con un mensaje claro.
 * 4. Escritura con el cliente del USUARIO (JWT + cabecera de contexto
 *    confiable): la BD vuelve a exigir `roles.gestionar`, sesión viva y AAL2
 *    (RLS), y sus triggers aplican las guardas y auditan con el actor real.
 * 5. `refresh()` para que la página muestre el cambio en la misma respuesta.
 *
 * Los errores esperados se devuelven como `ResultadoAccion` (nunca se lanzan).
 */
import "server-only"

import { refresh } from "next/cache"

import { requerirPermiso } from "@/lib/auth/dal"
import { MENSAJE_INESPERADO } from "@/features/usuarios/errores"
import { PERMISOS } from "@/lib/auth/permisos"
import {
  desdeErrorZod,
  exito,
  fallo,
  type ResultadoAccion,
  type ResultadoFallo,
} from "@/lib/result"
import { crearClienteServidor } from "@/lib/supabase/server"

import { permisosValidos } from "./catalogo"
import {
  type ErrorBdRol,
  esErrorEsperado,
  interpretarErrorRol,
} from "./errores"
import { fueraDeAlcance, permisosClonables } from "./reglas"
import {
  type EntradaCrearRol,
  type EntradaEditarRol,
  type EntradaEliminarRol,
  type EntradaPermisosRol,
  esquemaCrearRol,
  esquemaEditarRol,
  esquemaEliminarRol,
  esquemaPermisosRol,
  mfaObligatoria,
} from "./schemas"

// ── Utilidades internas (no exportadas: no son acciones) ─────────────────────

type ClienteUsuario = Awaited<ReturnType<typeof crearClienteServidor>>

const ROL_INEXISTENTE = "El rol ya no existe o no tienes acceso a él."
const ROL_SISTEMA =
  "Los permisos de los roles de sistema solo cambian con una actualización de la plataforma."

/** Log de servidor sin datos personales: operación y código. */
function informar(operacion: string, error: unknown): void {
  const codigo =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : error instanceof Error
        ? error.name
        : "desconocido"
  console.error(`[roles] ${operacion} falló (${codigo})`)
}

function falloBd(operacion: string, error: ErrorBdRol): ResultadoFallo {
  if (!esErrorEsperado(error)) informar(operacion, error)
  const { mensaje, campo } = interpretarErrorRol(error)
  return campo ? fallo(mensaje, { [campo]: [mensaje] }) : fallo(mensaje)
}

function falloInesperado(operacion: string, error: unknown): ResultadoFallo {
  informar(operacion, error)
  return fallo(MENSAJE_INESPERADO)
}

async function leerRol(supabase: ClienteUsuario, id: string) {
  const { data, error } = await supabase
    .from("roles")
    .select("id, nombre, tipo, es_sistema, rol_permisos ( permiso_clave )")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data
}

function listaDeDescripciones(claves: readonly (keyof typeof PERMISOS)[]) {
  return claves.map((clave) => `«${PERMISOS[clave].descripcion}»`).join(", ")
}

// ── Acciones ─────────────────────────────────────────────────────────────────

export type RolCreado = { id: string; copiados: number; omitidos: number }

/**
 * Crea un rol personalizado. Con `clonarDesde` copia los permisos del rol de
 * origen que el actor tiene (anti-escalada); si la copia falla, el rol recién
 * creado se borra para no dejarlo a medias.
 */
export async function crearRol(
  entrada: EntradaCrearRol
): Promise<ResultadoAccion<RolCreado>> {
  const actor = await requerirPermiso("roles.gestionar")
  const validacion = esquemaCrearRol.safeParse(entrada)
  if (!validacion.success) return desdeErrorZod(validacion.error)
  const datos = validacion.data

  try {
    const supabase = await crearClienteServidor()
    const origen = datos.clonarDesde
      ? await leerRol(supabase, datos.clonarDesde)
      : null
    if (datos.clonarDesde && !origen) {
      return fallo("El rol de origen ya no existe.", {
        clonarDesde: ["El rol de origen ya no existe."],
      })
    }

    const { data: creado, error } = await supabase
      .from("roles")
      .insert({
        clave: datos.clave,
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        tipo: datos.tipo,
        requiere_mfa: datos.requiereMfa,
        color: datos.color,
      })
      .select("id")
      .single()
    if (error) return falloBd("crear rol", error)

    const { copiables, omitidos } = permisosClonables(
      permisosValidos(origen?.rol_permisos.map((p) => p.permiso_clave) ?? []),
      actor
    )
    if (copiables.length > 0) {
      const { error: errorCopia } = await supabase.from("rol_permisos").insert(
        copiables.map((clave) => ({
          rol_id: creado.id,
          permiso_clave: clave,
        }))
      )
      if (errorCopia) {
        const { error: errorDeshacer } = await supabase
          .from("roles")
          .delete()
          .eq("id", creado.id)
        if (errorDeshacer) informar("deshacer rol sin permisos", errorDeshacer)
        return falloBd("copiar permisos", errorCopia)
      }
    }

    refresh()
    return exito({
      id: creado.id,
      copiados: copiables.length,
      omitidos: omitidos.length,
    })
  } catch (error) {
    return falloInesperado("crearRol", error)
  }
}

/**
 * Nombre, descripción, color y verificación en dos pasos. De un rol de
 * sistema solo se cambian la descripción y el color (D20); la clave y el tipo
 * son permanentes.
 */
export async function editarRol(
  entrada: EntradaEditarRol
): Promise<ResultadoAccion> {
  await requerirPermiso("roles.gestionar")
  const validacion = esquemaEditarRol.safeParse(entrada)
  if (!validacion.success) return desdeErrorZod(validacion.error)
  const datos = validacion.data

  try {
    const supabase = await crearClienteServidor()
    const rol = await leerRol(supabase, datos.rolId)
    if (!rol) return fallo(ROL_INEXISTENTE)

    const cambios = rol.es_sistema
      ? { descripcion: datos.descripcion, color: datos.color }
      : {
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          color: datos.color,
          requiere_mfa: mfaObligatoria(rol.tipo) || datos.requiereMfa,
        }
    const { data, error } = await supabase
      .from("roles")
      .update(cambios)
      .eq("id", datos.rolId)
      .select("id")
    if (error) return falloBd("editar rol", error)
    if (data.length === 0) return fallo(ROL_INEXISTENTE)

    refresh()
    return exito()
  } catch (error) {
    return falloInesperado("editarRol", error)
  }
}

export type PermisosGuardados = { agregados: number; quitados: number }

/**
 * Aplica el diff de la matriz: primero retira y luego otorga (si lo segundo
 * fallara, el rol queda con menos acceso, nunca con más). Cada fila pasa por
 * `fn_guardar_rol_permisos` (rol de sistema, rol propio, anti-escalada) y se
 * audita con el actor.
 */
export async function guardarPermisosRol(
  entrada: EntradaPermisosRol
): Promise<ResultadoAccion<PermisosGuardados>> {
  const actor = await requerirPermiso("roles.gestionar")
  const validacion = esquemaPermisosRol.safeParse(entrada)
  if (!validacion.success) return desdeErrorZod(validacion.error)
  const { rolId, agregar, quitar } = validacion.data

  if (rolId === actor.rol.id) {
    return fallo("No puedes cambiar los permisos de tu propio rol.")
  }
  const fuera = fueraDeAlcance(actor, [...agregar, ...quitar])
  if (fuera.length > 0) {
    return fallo(
      `No puedes otorgar ni retirar permisos que tú no tienes: ${listaDeDescripciones(fuera)}.`
    )
  }

  try {
    const supabase = await crearClienteServidor()
    const rol = await leerRol(supabase, rolId)
    if (!rol) return fallo(ROL_INEXISTENTE)
    if (rol.es_sistema) return fallo(ROL_SISTEMA)

    if (quitar.length > 0) {
      const { error } = await supabase
        .from("rol_permisos")
        .delete()
        .eq("rol_id", rolId)
        .in("permiso_clave", quitar)
      if (error) return falloBd("retirar permisos", error)
    }
    if (agregar.length > 0) {
      // Idempotente: si otra persona ya lo otorgó, no es un error.
      const { error } = await supabase.from("rol_permisos").upsert(
        agregar.map((clave) => ({ rol_id: rolId, permiso_clave: clave })),
        { onConflict: "rol_id,permiso_clave", ignoreDuplicates: true }
      )
      if (error) {
        if (quitar.length > 0) refresh()
        const resultado = falloBd("otorgar permisos", error)
        return quitar.length > 0
          ? fallo(
              `Se retiraron los permisos quitados, pero no se pudieron otorgar los nuevos. ${resultado.error}`
            )
          : resultado
      }
    }

    refresh()
    return exito({ agregados: agregar.length, quitados: quitar.length })
  } catch (error) {
    return falloInesperado("guardarPermisosRol", error)
  }
}

/**
 * Elimina un rol personalizado sin cuentas asignadas. La confirmación exige
 * escribir su nombre; la FK de `perfiles` impide borrarlo si alguien lo usa.
 * No refresca: la interfaz vuelve al listado.
 */
export async function eliminarRol(
  entrada: EntradaEliminarRol
): Promise<ResultadoAccion> {
  const actor = await requerirPermiso("roles.gestionar")
  const validacion = esquemaEliminarRol.safeParse(entrada)
  if (!validacion.success) return desdeErrorZod(validacion.error)
  const { rolId, confirmacion } = validacion.data
  if (rolId === actor.rol.id) return fallo("No puedes eliminar tu propio rol.")

  try {
    const supabase = await crearClienteServidor()
    const rol = await leerRol(supabase, rolId)
    if (!rol) return fallo(ROL_INEXISTENTE)
    if (rol.es_sistema)
      return fallo("Los roles de sistema no se pueden eliminar.")
    if (confirmacion !== rol.nombre) {
      return fallo("El nombre no coincide.", {
        confirmacion: ["El nombre no coincide."],
      })
    }

    const { data, error } = await supabase
      .from("roles")
      .delete()
      .eq("id", rolId)
      .select("id")
    if (error) return falloBd("eliminar rol", error)
    if (data.length === 0) return fallo(ROL_INEXISTENTE)
    return exito()
  } catch (error) {
    return falloInesperado("eliminarRol", error)
  }
}
