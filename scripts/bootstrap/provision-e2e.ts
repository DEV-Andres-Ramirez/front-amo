/**
 * Cuentas de prueba E2E (las usan `scripts/bootstrap/usuarios-e2e.ts` y
 * `e2e/*.spec.ts`). Son perfiles `es_demo` en correos `@amo.test` (dominio
 * reservado: nunca recibe correo). Los cambios de rol y estado se atribuyen al
 * superadministrador (`x-amo-actor` con contexto confiable): los triggers
 * guardianes no permiten gestionar perfiles sin un actor identificado.
 */
import {
  actualizarPerfil,
  buscarUsuarioPorEmail,
  type ClienteSupabase,
  crearClientePublico,
  crearClienteServicio,
  type EntornoBootstrap,
  ErrorBootstrap,
  idDeRol,
  rutaConfirmacion,
} from "./supabase"
import { codigoTotp, segundosRestantesTotp } from "./totp"

/**
 * Organización ficticia de los anunciantes E2E: un perfil ANUNCIANTE activo
 * exige `anunciante_id`. La tabla `anunciantes` llega en la migración 6, que
 * debe sembrar este id (es_demo) antes de crear la FK de `perfiles.anunciante_id`.
 */
export const ANUNCIANTE_E2E_ID = "e2e00000-0000-4000-8000-00000000a001"

export interface CuentaE2E {
  clave: string
  rol: "SUPERADMIN" | "ADMIN" | "ANUNCIANTE"
  nombre: string
  emailPorDefecto: string
  /** Variables de `.env.local` con el correo y la contraseña. */
  variableEmail: string
  variablePassword: string
  debeCambiarPassword: boolean
  conTotp: boolean
}

export const CUENTAS_E2E: readonly CuentaE2E[] = [
  {
    clave: "ADMIN",
    rol: "ADMIN",
    nombre: "Administración E2E",
    emailPorDefecto: "e2e.admin@amo.test",
    variableEmail: "E2E_ADMIN_EMAIL",
    variablePassword: "E2E_ADMIN_PASSWORD",
    debeCambiarPassword: false,
    conTotp: true,
  },
  {
    clave: "ANUNCIANTE",
    rol: "ANUNCIANTE",
    nombre: "Anunciante E2E",
    emailPorDefecto: "e2e.anunciante@amo.test",
    variableEmail: "E2E_ANUNCIANTE_EMAIL",
    variablePassword: "E2E_ANUNCIANTE_PASSWORD",
    debeCambiarPassword: false,
    conTotp: false,
  },
  {
    clave: "CAMBIO",
    rol: "ANUNCIANTE",
    nombre: "Cambio Obligatorio E2E",
    emailPorDefecto: "e2e.cambio@amo.test",
    variableEmail: "E2E_CAMBIO_EMAIL",
    variablePassword: "E2E_CAMBIO_PASSWORD",
    debeCambiarPassword: true,
    conTotp: false,
  },
]

export const VARIABLE_TOTP_ADMIN = "E2E_ADMIN_TOTP_SECRET"

export function cuentaE2E(clave: CuentaE2E["clave"]): CuentaE2E {
  const cuenta = CUENTAS_E2E.find((candidata) => candidata.clave === clave)
  if (!cuenta) throw new ErrorBootstrap(`Cuenta E2E desconocida: ${clave}`)
  return cuenta
}

export function emailDe(cuenta: CuentaE2E): string {
  return process.env[cuenta.variableEmail] ?? cuenta.emailPorDefecto
}

/** Cliente `service_role` que actúa como el superadministrador activo. */
export async function clienteComoSuperadmin(
  entorno: EntornoBootstrap
): Promise<ClienteSupabase> {
  const email = entorno.superadminEmail
  if (!email) throw new ErrorBootstrap("Define SUPERADMIN_EMAIL en .env.local.")
  const servicio = crearClienteServicio(entorno)
  const superadmin = await buscarUsuarioPorEmail(servicio, email)
  const rolSuper = await idDeRol(servicio, "SUPERADMIN")
  const { data: perfil } = superadmin
    ? await servicio
        .from("perfiles")
        .select("rol_id, estado")
        .eq("id", superadmin.id)
        .single()
    : { data: null }
  if (
    !superadmin ||
    perfil?.rol_id !== rolSuper ||
    perfil.estado !== "ACTIVO"
  ) {
    throw new ErrorBootstrap(
      "No hay un superadministrador activo: ejecuta primero `pnpm bootstrap:superadmin`."
    )
  }
  return crearClienteServicio(entorno, superadmin.id)
}

/** Crea la cuenta o le fija la contraseña; devuelve su id. */
async function asegurarUsuario(
  servicio: ClienteSupabase,
  cuenta: CuentaE2E,
  password: string
): Promise<string> {
  const email = emailDe(cuenta)
  const atributos = {
    password,
    email_confirm: true,
    app_metadata: { rol: cuenta.rol },
  }
  const existente = await buscarUsuarioPorEmail(servicio, email)
  const { data, error } = existente
    ? await servicio.auth.admin.updateUserById(existente.id, atributos)
    : await servicio.auth.admin.createUser({ email, ...atributos })
  if (error) {
    throw new ErrorBootstrap(`No se pudo preparar ${email}: ${error.message}`)
  }
  return data.user.id
}

async function asegurarPerfil(
  servicio: ClienteSupabase,
  usuarioId: string,
  cuenta: CuentaE2E
): Promise<void> {
  await actualizarPerfil(servicio, usuarioId, {
    nombre: cuenta.nombre,
    rol_id: await idDeRol(servicio, cuenta.rol),
    anunciante_id: cuenta.rol === "ANUNCIANTE" ? ANUNCIANTE_E2E_ID : null,
    estado: "ACTIVO",
    activado_at: new Date().toISOString(),
    debe_cambiar_password: cuenta.debeCambiarPassword,
    es_demo: true,
  })
}

/** Deja la cuenta como la esperan las pruebas: contraseña, rol, estado y cambio obligatorio. */
export async function prepararCuenta(
  servicio: ClienteSupabase,
  cuenta: CuentaE2E,
  password: string
): Promise<string> {
  const usuarioId = await asegurarUsuario(servicio, cuenta, password)
  await asegurarPerfil(servicio, usuarioId, cuenta)
  return usuarioId
}

async function tieneTotpVerificado(
  servicio: ClienteSupabase,
  usuarioId: string
): Promise<boolean> {
  const { data, error } = await servicio.auth.admin.mfa.listFactors({
    userId: usuarioId,
  })
  if (error) {
    throw new ErrorBootstrap(
      `No se pudieron leer los factores: ${error.message}`
    )
  }
  return data.factors.some(
    (factor) => factor.factor_type === "totp" && factor.status === "verified"
  )
}

async function borrarFactores(
  servicio: ClienteSupabase,
  usuarioId: string
): Promise<void> {
  const { data, error } = await servicio.auth.admin.mfa.listFactors({
    userId: usuarioId,
  })
  if (error) {
    throw new ErrorBootstrap(
      `No se pudieron leer los factores: ${error.message}`
    )
  }
  for (const factor of data.factors) {
    const { error: errorBorrado } = await servicio.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: usuarioId,
    })
    if (errorBorrado) {
      throw new ErrorBootstrap(
        `No se pudo borrar un factor: ${errorBorrado.message}`
      )
    }
  }
}

/** Espera al siguiente código si al vigente le quedan pocos segundos. */
export async function codigoTotpEstable(secreto: string): Promise<string> {
  if (segundosRestantesTotp() < 4) {
    await new Promise((resolver) =>
      setTimeout(resolver, segundosRestantesTotp() * 1000 + 250)
    )
  }
  return codigoTotp(secreto)
}

/**
 * Enrola y verifica un TOTP como lo haría el usuario (ingreso con contraseña
 * + `mfa.enroll` + `challengeAndVerify`) y devuelve la clave base32.
 */
async function enrolarTotp(
  entorno: EntornoBootstrap,
  email: string,
  password: string
): Promise<string> {
  const publico = crearClientePublico(entorno)
  const ingreso = await publico.auth.signInWithPassword({ email, password })
  if (ingreso.error) {
    throw new ErrorBootstrap(`No se pudo ingresar: ${ingreso.error.message}`)
  }

  const { data, error } = await publico.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "AMO E2E",
    issuer: "AMO",
  })
  if (error) {
    throw new ErrorBootstrap(`No se pudo enrolar el TOTP: ${error.message}`)
  }

  const verificacion = await publico.auth.mfa.challengeAndVerify({
    factorId: data.id,
    code: await codigoTotpEstable(data.totp.secret),
  })
  if (verificacion.error) {
    throw new ErrorBootstrap(
      `No se pudo verificar el TOTP: ${verificacion.error.message}`
    )
  }
  await publico.auth.signOut({ scope: "local" })
  return data.totp.secret
}

/**
 * Garantiza un TOTP verificado cuya clave conocemos. Si la clave ya está en el
 * entorno y el factor existe, no hace nada; si falta alguna de las dos, borra
 * los factores y enrola uno nuevo (devuelve la clave nueva).
 */
export async function asegurarTotp(
  entorno: EntornoBootstrap,
  servicio: ClienteSupabase,
  usuarioId: string,
  credenciales: { email: string; password: string },
  secretoConocido: string | undefined
): Promise<string> {
  if (secretoConocido && (await tieneTotpVerificado(servicio, usuarioId))) {
    return secretoConocido
  }
  if (secretoConocido) {
    throw new ErrorBootstrap(
      `${VARIABLE_TOTP_ADMIN} está en .env.local pero la cuenta no tiene ese factor: borra la línea y vuelve a ejecutar.`
    )
  }
  await borrarFactores(servicio, usuarioId)
  return enrolarTotp(entorno, credenciales.email, credenciales.password)
}

/**
 * Devuelve una cuenta al estado inicial de las pruebas (contraseña de
 * `.env.local`, rol, estado y cambio obligatorio) tras una prueba que la modifica.
 */
export async function restablecerCuenta(
  entorno: EntornoBootstrap,
  clave: CuentaE2E["clave"]
): Promise<void> {
  const cuenta = cuentaE2E(clave)
  const password = process.env[cuenta.variablePassword]
  if (!password) {
    throw new ErrorBootstrap(
      `Falta ${cuenta.variablePassword}: ejecuta \`pnpm exec tsx scripts/bootstrap/usuarios-e2e.ts\`.`
    )
  }
  await prepararCuenta(await clienteComoSuperadmin(entorno), cuenta, password)
}

/** Administrador invitado para probar el primer ingreso completo. */
export const EMAIL_INVITADO_E2E = "e2e.invitado@amo.test"
export const NOMBRE_INVITADO_E2E = "Invitada E2E"

/**
 * Invitación nueva como la haría un administrador: borra la cuenta anterior
 * (si existe), genera el enlace `invite`, asigna el rol ADMIN y deja el
 * perfil INVITADO. Devuelve la ruta `/auth/confirm?…` (sin el origen).
 */
export async function prepararInvitacionE2E(
  entorno: EntornoBootstrap
): Promise<string> {
  const servicio = await clienteComoSuperadmin(entorno)
  const anterior = await buscarUsuarioPorEmail(servicio, EMAIL_INVITADO_E2E)
  if (anterior) {
    const { error } = await servicio.auth.admin.deleteUser(anterior.id)
    if (error) {
      throw new ErrorBootstrap(
        `No se pudo borrar la invitación anterior: ${error.message}`
      )
    }
  }

  const { data, error } = await servicio.auth.admin.generateLink({
    type: "invite",
    email: EMAIL_INVITADO_E2E,
  })
  if (error) throw new ErrorBootstrap(`No se pudo invitar: ${error.message}`)
  const { error: errorMetadatos } = await servicio.auth.admin.updateUserById(
    data.user.id,
    { app_metadata: { rol: "ADMIN" } }
  )
  if (errorMetadatos) {
    throw new ErrorBootstrap(
      `No se pudo fijar app_metadata: ${errorMetadatos.message}`
    )
  }
  await actualizarPerfil(servicio, data.user.id, {
    nombre: NOMBRE_INVITADO_E2E,
    rol_id: await idDeRol(servicio, "ADMIN"),
    es_demo: true,
  })
  return rutaConfirmacion(data.properties.hashed_token, "invite")
}
