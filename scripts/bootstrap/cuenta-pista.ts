/**
 * `pnpm exec tsx scripts/bootstrap/cuenta-pista.ts <nombre> [SUPERADMIN|ADMIN|ANUNCIANTE]`
 *
 * Cuenta de prueba aislada para un agente o pista de desarrollo, con TOTP
 * propio: verificar un factor cierra las demás sesiones del usuario, así que
 * cada proceso que navega la app autenticado necesita su propia cuenta.
 *
 * Escribe las credenciales (0600) en el archivo indicado por
 * `AMO_CUENTAS_PISTA_DIR` (por defecto `./.cuentas-pista/`, ignorado por git)
 * y no imprime contraseñas ni secretos. Idempotente.
 */
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { generarContrasena } from "./contrasena"
import {
  asegurarTotp,
  clienteComoSuperadmin,
  type CuentaE2E,
  prepararCuenta,
} from "./provision-e2e"
import { cargarEntorno } from "./supabase"

const ROLES = ["SUPERADMIN", "ADMIN", "ANUNCIANTE"] as const
type RolPista = (typeof ROLES)[number]

interface CredencialesPista {
  email: string
  password: string
  totpSecreto: string | null
  rol: RolPista
}

function leerExistente(ruta: string): CredencialesPista | null {
  try {
    return JSON.parse(readFileSync(ruta, "utf8")) as CredencialesPista
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  const [nombre, rolArg = "SUPERADMIN"] = process.argv.slice(2)
  if (!nombre || !/^[a-z0-9-]{2,30}$/.test(nombre)) {
    throw new Error("Uso: cuenta-pista.ts <nombre-en-minusculas> [rol]")
  }
  const rol = rolArg.toUpperCase() as RolPista
  if (!ROLES.includes(rol)) throw new Error(`Rol no soportado: ${rolArg}`)

  const directorio = process.env.AMO_CUENTAS_PISTA_DIR ?? ".cuentas-pista"
  mkdirSync(directorio, { recursive: true, mode: 0o700 })
  const ruta = join(directorio, `${nombre}.json`)
  const previo = leerExistente(ruta)

  const email = `e2e.pista-${nombre}@amo.test`
  const password = previo?.password ?? generarContrasena()
  const cuenta: CuentaE2E = {
    clave: `PISTA_${nombre}`,
    rol,
    nombre: `Pista ${nombre}`,
    emailPorDefecto: email,
    variableEmail: `AMO_PISTA_${nombre}_EMAIL`,
    variablePassword: `AMO_PISTA_${nombre}_PASSWORD`,
    debeCambiarPassword: false,
    conTotp: rol !== "ANUNCIANTE",
  }

  const entorno = cargarEntorno(".env.local")
  const servicio = await clienteComoSuperadmin(entorno)
  const usuarioId = await prepararCuenta(servicio, cuenta, password)
  const totpSecreto = cuenta.conTotp
    ? await asegurarTotp(
        entorno,
        servicio,
        usuarioId,
        { email, password },
        previo?.totpSecreto ?? undefined
      )
    : null

  const credenciales: CredencialesPista = { email, password, totpSecreto, rol }
  writeFileSync(ruta, JSON.stringify(credenciales, null, 2), { mode: 0o600 })
  chmodSync(ruta, 0o600)
  process.stderr.write(`✓ Cuenta de pista lista: ${email} → ${ruta}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(
    `✗ ${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exit(1)
})
