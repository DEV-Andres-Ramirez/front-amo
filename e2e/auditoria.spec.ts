import { expect, type Page, test } from "@playwright/test"

import { generarContrasena } from "../scripts/bootstrap/contrasena"
import {
  asegurarTotp,
  clienteComoSuperadmin,
  codigoTotpEstable,
  type CuentaE2E,
  emailDe,
  prepararCuenta,
} from "../scripts/bootstrap/provision-e2e"
import type { ClienteSupabase } from "../scripts/bootstrap/supabase"
import { PASO_TOTP_SEGUNDOS } from "../scripts/bootstrap/totp"
import { credenciales, entorno, ingresar } from "./utilidades/cuentas"

/**
 * Auditoría (bitácora) y Accesos contra `pnpm build && pnpm start` y el
 * Supabase real.
 *
 * Usa un administrador EXCLUSIVO de esta suite (rol ADMIN con TOTP: tiene
 * `auditoria.*`, `accesos.*` y `datos_sensibles.ver`). Prepararlo deja en la
 * bitácora eventos sobre su propio perfil (el id de la entidad es el suyo), y
 * su ingreso deja filas en `accesos`: son los datos que la prueba busca.
 */

const AUDITOR: CuentaE2E = {
  clave: "AUDITORIA",
  rol: "ADMIN",
  nombre: "Auditoría E2E",
  emailPorDefecto: "e2e.auditoria@amo.test",
  variableEmail: "E2E_AUDITORIA_EMAIL",
  variablePassword: "E2E_AUDITORIA_PASSWORD",
  debeCambiarPassword: false,
  conTotp: true,
}

const PROYECTO_CON_CUENTAS = "escritorio"

interface CredencialesAuditor {
  id: string
  email: string
  password: string
  secreto: string
}

let ultimoPasoTotp = Math.floor(Date.now() / 1000 / PASO_TOTP_SEGUNDOS)

/** Código de un periodo TOTP posterior al último usado (Supabase no acepta repetirlo). */
async function codigoNuevo(secreto: string): Promise<string> {
  const pasoActual = () => Math.floor(Date.now() / 1000 / PASO_TOTP_SEGUNDOS)
  while (pasoActual() <= ultimoPasoTotp) {
    await new Promise((resolver) => setTimeout(resolver, 1000))
  }
  const codigo = await codigoTotpEstable(secreto)
  ultimoPasoTotp = pasoActual()
  return codigo
}

async function ingresarComoAuditor(
  page: Page,
  auditor: CredencialesAuditor
): Promise<void> {
  await ingresar(page, auditor)
  await expect(page).toHaveURL(/\/mfa\/verificar/)
  await page
    .getByLabel("Código de verificación")
    .fill(await codigoNuevo(auditor.secreto))
  await expect(page).toHaveURL(/\/inicio$/)
}

/** Espera a que el registro de la exportación llegue a la bitácora. */
async function exportacionesRegistradas(
  servicio: ClienteSupabase,
  actorId: string,
  entidad: "bitacora" | "accesos"
): Promise<number> {
  const { count, error } = await servicio
    .from("bitacora")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", actorId)
    .eq("accion", "EXPORTAR")
    .eq("entidad", entidad)
  if (error) throw new Error(`No se pudo leer la bitácora: ${error.message}`)
  return count ?? 0
}

const TITULO_EVENTO_PERFIL = /^(Editó|Creó|Cambió el estado de) un usuario$/

test.describe("auditoría y accesos", () => {
  test.describe.configure({ mode: "serial", timeout: 150_000 })

  let auditor: CredencialesAuditor
  let servicio: ClienteSupabase

  // Playwright exige desestructurar los fixtures aunque no se usen.
  test.beforeAll(async ({}, info) => {
    info.skip(
      info.project.name !== PROYECTO_CON_CUENTAS,
      "Cuenta compartida y datos reales: esta suite corre solo en el proyecto de escritorio."
    )
    info.setTimeout(90_000)
    servicio = await clienteComoSuperadmin(entorno)
    const email = emailDe(AUDITOR)
    const password = generarContrasena()
    const id = await prepararCuenta(servicio, AUDITOR, password)
    const secreto = await asegurarTotp(
      entorno,
      servicio,
      id,
      { email, password },
      undefined
    )
    ultimoPasoTotp = Math.floor(Date.now() / 1000 / PASO_TOTP_SEGUNDOS)
    auditor = { id, email, password, secreto }
  })

  test("bitácora: indicadores, búsqueda, visor de diferencias y enlace directo", async ({
    page,
  }) => {
    await ingresarComoAuditor(page, auditor)
    // La búsqueda cubre el id de la entidad: los eventos del perfil del auditor.
    await page.goto(`/administracion/auditoria?q=${auditor.id}`)
    await expect(
      page.getByRole("heading", { level: 1, name: "Auditoría" })
    ).toBeVisible()
    const resumen = page.getByRole("region", { name: "Resumen de la bitácora" })
    await expect(resumen.getByText("Eventos en el periodo")).toBeVisible()
    await expect(resumen.getByText("Eventos sensibles")).toBeVisible()

    await test.step("abrir un evento muestra actor, cambios y contexto", async () => {
      await page
        .getByRole("button", { name: TITULO_EVENTO_PERFIL })
        .first()
        .click()
      const panel = page.getByRole("dialog", { name: TITULO_EVENTO_PERFIL })
      await expect(panel).toBeVisible()
      await expect(panel.getByText(/^(Cambios|Datos creados)$/)).toBeVisible()
      await expect(panel.getByText("Contexto de la solicitud")).toBeVisible()
      await expect(
        panel.getByRole("button", { name: "Copiar enlace" })
      ).toBeVisible()
      await expect(page).toHaveURL(/[?&]evento=\d+/)
    })

    await test.step("el enlace directo reabre el mismo evento", async () => {
      const enlace = page.url()
      await page.keyboard.press("Escape")
      await expect(page.getByRole("dialog")).toBeHidden()
      await expect
        .poll(() => new URL(page.url()).searchParams.get("evento"))
        .toBeNull()
      await page.goto(enlace)
      await expect(
        page.getByRole("dialog", { name: TITULO_EVENTO_PERFIL })
      ).toBeVisible()
    })
  })

  test("línea de tiempo agrupada por día", async ({ page }) => {
    await ingresarComoAuditor(page, auditor)
    await page.goto(`/administracion/auditoria?q=${auditor.id}`)
    await page.getByRole("button", { name: "Línea de tiempo" }).click()
    await expect
      .poll(() => new URL(page.url()).searchParams.get("vista"))
      .toBe("linea")
    const linea = page.getByRole("region", {
      name: "Línea de tiempo de la bitácora",
    })
    await expect(
      linea.getByRole("heading", { level: 3, name: /^Hoy/ })
    ).toBeVisible()
    await linea
      .getByRole("button", { name: TITULO_EVENTO_PERFIL })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  test("exportar la bitácora genera el archivo y deja constancia", async ({
    page,
  }) => {
    const antes = await exportacionesRegistradas(
      servicio,
      auditor.id,
      "bitacora"
    )
    await ingresarComoAuditor(page, auditor)
    await page.goto(`/administracion/auditoria?q=${auditor.id}`)

    const descarga = page.waitForEvent("download")
    await page.getByRole("button", { name: "Exportar" }).click()
    await page.getByRole("menuitem", { name: "CSV (.csv)" }).click()
    expect((await descarga).suggestedFilename()).toMatch(
      /^bitacora-amo-\d{4}-\d{2}-\d{2}\.csv$/
    )
    await expect
      .poll(() => exportacionesRegistradas(servicio, auditor.id, "bitacora"))
      .toBeGreaterThan(antes)

    // La exportación se ve en la propia bitácora, filtrada por acción y actor.
    await page.goto(
      `/administracion/auditoria?accion=EXPORTAR&q=${encodeURIComponent(AUDITOR.nombre)}`
    )
    await expect(
      page.getByRole("button", { name: "Exportó la bitácora" }).first()
    ).toBeVisible()
  })

  test("accesos: el ingreso aparece con su resultado, filtros y exportación", async ({
    page,
  }) => {
    await ingresarComoAuditor(page, auditor)
    await page.goto("/administracion/accesos")
    await expect(
      page.getByRole("heading", { level: 1, name: "Accesos" })
    ).toBeVisible()
    await expect(
      page.getByRole("region", { name: "Resumen de accesos" })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Actividad por día y hora" })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Origen de los ingresos" })
    ).toBeVisible()

    await test.step("buscar a la persona muestra su ingreso exitoso", async () => {
      await page
        .getByRole("searchbox", { name: "Buscar persona o ciudad" })
        .fill(AUDITOR.nombre)
      await expect
        .poll(() => new URL(page.url()).searchParams.get("q"))
        .toBe(AUDITOR.nombre)
      const ingreso = page
        .getByRole("row")
        .filter({ hasText: AUDITOR.nombre })
        .filter({ hasText: "Ingreso" })
        .first()
      await expect(ingreso.getByText("Exitoso")).toBeVisible()
    })

    await test.step("el filtro de fallidos excluye los ingresos exitosos", async () => {
      await page.goto(
        `/administracion/accesos?resultado=FALLO&q=${encodeURIComponent(AUDITOR.nombre)}`
      )
      await expect(
        page.getByRole("heading", { name: "Registro de accesos" })
      ).toBeVisible()
      await expect(
        page.getByRole("row").filter({ hasText: "Exitoso" })
      ).toHaveCount(0)
    })

    await test.step("exportar a Excel deja constancia en la bitácora", async () => {
      const antes = await exportacionesRegistradas(
        servicio,
        auditor.id,
        "accesos"
      )
      const descarga = page.waitForEvent("download")
      await page.getByRole("button", { name: "Exportar" }).click()
      await page.getByRole("menuitem", { name: "Excel (.xlsx)" }).click()
      expect((await descarga).suggestedFilename()).toMatch(
        /^accesos-amo-\d{4}-\d{2}-\d{2}\.xlsx$/
      )
      await expect
        .poll(() => exportacionesRegistradas(servicio, auditor.id, "accesos"))
        .toBeGreaterThan(antes)
    })
  })

  test("sin permiso: un anunciante recibe 403 en auditoría y accesos", async ({
    page,
  }) => {
    await ingresar(page, credenciales("ANUNCIANTE"))
    await expect(page).toHaveURL(/\/inicio$/)
    for (const ruta of [
      "/administracion/auditoria",
      "/administracion/accesos",
    ]) {
      await page.goto(ruta)
      await expect(
        page.getByRole("heading", {
          name: "No tienes permiso para ver esta sección",
        })
      ).toBeVisible()
      // Nada de la bitácora ni del registro llegó al HTML.
      const html = await page.content()
      expect(html).not.toContain("Eventos en el periodo")
      expect(html).not.toContain("Registro de accesos")
    }
  })
})
