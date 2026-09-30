import AxeBuilder from "@axe-core/playwright"
import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  type Route,
  test,
} from "@playwright/test"

import { leerParametrosGeo } from "../src/features/geo/esquemas"
import { crearProveedorSimulado } from "../src/features/geo/proveedor-simulado"
import { generarContrasena } from "../scripts/bootstrap/contrasena"
import {
  asegurarTotp,
  clienteComoSuperadmin,
  codigoTotpEstable,
  type CuentaE2E,
  emailDe,
  prepararCuenta,
} from "../scripts/bootstrap/provision-e2e"
import { PASO_TOTP_SEGUNDOS } from "../scripts/bootstrap/totp"
import { entorno, ingresar } from "./utilidades/cuentas"

/**
 * Explorador geográfico contra `pnpm build && pnpm start`.
 *
 * Los datos de `GET /api/geo/metricas` se interceptan con el proveedor
 * simulado (el mismo de `AMO_GEO_MOCK=1`, determinista): en producción el
 * servidor nunca simula y la RPC `geo_metricas` puede no tener datos demo.
 * La autorización real (DAL, permisos) la cubre `route.test.ts`.
 *
 * Usa un ADMIN exclusivo con TOTP; ingresa una vez y reutiliza la sesión en
 * contextos de escritorio y de móvil (Mapbox se dibuja con SwiftShader).
 */

const EXPLORADOR: CuentaE2E = {
  clave: "MAPA",
  rol: "ADMIN",
  nombre: "Explorador E2E",
  emailPorDefecto: "e2e.mapa@amo.test",
  variableEmail: "E2E_MAPA_EMAIL",
  variablePassword: "E2E_MAPA_PASSWORD",
  debeCambiarPassword: false,
  conTotp: true,
}

const PROYECTO_CON_CUENTAS = "escritorio"
const RUTA = "/analitica/mapa"
const CLAVE_COACHMARK = "amo.mapa.coachmark.v1"

const proveedor = crearProveedorSimulado()

/** Responde la API con el proveedor simulado (o con el error indicado). */
async function interceptarApi(
  contexto: BrowserContext | Page,
  error?: { estado: number; mensaje: string }
): Promise<void> {
  await contexto.route("**/api/geo/metricas?**", async (ruta: Route) => {
    if (error) {
      await ruta.fulfill({
        status: error.estado,
        json: { error: { motivo: "no-disponible", mensaje: error.mensaje } },
      })
      return
    }
    const lectura = leerParametrosGeo(new URL(ruta.request().url()).searchParams)
    if (!lectura.ok) {
      await ruta.fulfill({
        status: 400,
        json: { error: { motivo: "consulta-invalida", mensaje: "Consulta inválida" } },
      })
      return
    }
    const { vista, consulta } = lectura.datos
    const cuerpo =
      vista === "detalle"
        ? await proveedor.detalle(consulta)
        : await proveedor.mapa(consulta)
    await ruta.fulfill({ json: cuerpo })
  })
}

async function nuevoContexto(
  navegador: Browser,
  estado: string,
  opciones: Parameters<Browser["newContext"]>[0] = {}
): Promise<{ contexto: BrowserContext; page: Page }> {
  const contexto = await navegador.newContext({
    storageState: estado,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    colorScheme: "dark",
    ...opciones,
  })
  // El coachmark se prueba aparte: aquí ya se "vio".
  await contexto.addInitScript((clave) => {
    try {
      localStorage.setItem(clave, "1")
    } catch {}
  }, CLAVE_COACHMARK)
  await interceptarApi(contexto)
  return { contexto, page: await contexto.newPage() }
}

function ranking(page: Page) {
  return page.getByRole("list", { name: /^Ranking por/ }).last()
}

function filaRanking(page: Page, nombre: string | RegExp) {
  return ranking(page).getByRole("button", {
    name: typeof nombre === "string" ? new RegExp(`^\\d+ ${nombre}`) : nombre,
  })
}

async function abrirExplorador(page: Page, ruta = RUTA): Promise<void> {
  await page.goto(ruta)
  await expect(
    page.getByRole("heading", { level: 1, name: "Explorador geográfico" })
  ).toBeAttached()
  await expect(ranking(page)).toBeVisible()
}

/** Miga de la posición actual ("Mundo", "Colombia", "Antioquia"). */
const nivelActual = (page: Page) =>
  page
    .getByRole("navigation", { name: "Nivel del mapa" })
    .first()
    .locator('[aria-current="location"]')

const parametro = (page: Page, clave: string) =>
  new URL(page.url()).searchParams.get(clave)

test.describe("explorador geográfico", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 })

  let estadoSesion: string

  test.beforeAll(async ({ browser }, info) => {
    info.skip(
      info.project.name !== PROYECTO_CON_CUENTAS,
      "Una sola cuenta con TOTP: la suite corre en escritorio y abre sus propios contextos móviles."
    )
    info.setTimeout(120_000)
    const servicio = await clienteComoSuperadmin(entorno)
    const email = emailDe(EXPLORADOR)
    const password = generarContrasena()
    const usuarioId = await prepararCuenta(servicio, EXPLORADOR, password)
    const secreto = await asegurarTotp(
      entorno,
      servicio,
      usuarioId,
      { email, password },
      undefined
    )
    // Enrolar consume el periodo actual: se espera al siguiente.
    const paso = Math.floor(Date.now() / 1000 / PASO_TOTP_SEGUNDOS)
    while (Math.floor(Date.now() / 1000 / PASO_TOTP_SEGUNDOS) <= paso) {
      await new Promise((resolver) => setTimeout(resolver, 1000))
    }

    const contexto = await browser.newContext()
    const page = await contexto.newPage()
    await ingresar(page, { email, password })
    await expect(page).toHaveURL(/\/mfa\/verificar/)
    await page
      .getByLabel("Código de verificación")
      .fill(await codigoTotpEstable(secreto))
    await expect(page).toHaveURL(/\/inicio$/)
    estadoSesion = info.outputPath("sesion-mapa.json")
    await contexto.storageState({ path: estadoSesion })
    await contexto.close()
  })

  test("nacional: ranking, detalle con «Explorar» y nivel departamental en la URL", async ({
    browser,
  }) => {
    const { contexto, page } = await nuevoContexto(browser, estadoSesion, {
      viewport: { width: 1440, height: 900 },
    })
    await abrirExplorador(page)

    await expect(nivelActual(page)).toHaveText("Colombia")
    await expect(ranking(page).getByRole("listitem")).toHaveCount(33)
    await expect(page.locator(".mapboxgl-canvas")).toBeVisible()

    await filaRanking(page, "Antioquia").click()
    const detalle = page.getByRole("complementary", { name: "Antioquia" })
    await expect(detalle).toBeVisible()
    await expect(detalle.getByText("Medios verificados", { exact: true })).toBeVisible()
    await expect(detalle.getByText(/^Puesto \d+ de 33 departamentos/)).toBeVisible()

    await detalle.getByRole("button", { name: "Explorar Antioquia" }).click()
    await expect.poll(() => parametro(page, "nivel")).toBe("departamental")
    expect(parametro(page, "depto")).toBe("05")
    await expect(nivelActual(page)).toHaveText("Antioquia")
    await expect(filaRanking(page, "Medellín")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Ranking de municipios" })).toBeVisible()
    await contexto.close()
  })

  test("Atrás deshace el último nivel y Esc cierra el detalle y luego sube", async ({
    browser,
  }) => {
    const { contexto, page } = await nuevoContexto(browser, estadoSesion, {
      viewport: { width: 1440, height: 900 },
    })
    await abrirExplorador(page)
    await filaRanking(page, "Valle del Cauca").click()
    await page
      .getByRole("complementary", { name: "Valle del Cauca" })
      .getByRole("button", { name: "Explorar Valle del Cauca" })
      .click()
    await expect.poll(() => parametro(page, "depto")).toBe("76")

    await page.goBack()
    await expect.poll(() => parametro(page, "depto")).toBeNull()
    await expect(filaRanking(page, "Antioquia")).toBeVisible()

    await filaRanking(page, "Antioquia").click()
    await expect(page.getByRole("complementary", { name: "Antioquia" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("complementary", { name: "Antioquia" })).toBeHidden()
    await page.keyboard.press("Escape")
    await expect.poll(() => parametro(page, "nivel")).toBe("internacional")
    await expect(page.getByRole("heading", { name: "Ranking de países" })).toBeVisible()

    await expect(nivelActual(page)).toHaveText("Mundo")
    await page.getByRole("button", { name: "Explorar Colombia" }).click()
    await expect.poll(() => parametro(page, "nivel")).toBeNull()
    await contexto.close()
  })

  test("teclado en el ranking: flechas, Enter selecciona y → explora; Bogotá no baja", async ({
    browser,
  }) => {
    const { contexto, page } = await nuevoContexto(browser, estadoSesion, {
      viewport: { width: 1440, height: 900 },
    })
    await abrirExplorador(page)

    const primera = ranking(page).getByRole("button").first()
    await primera.focus()
    await page.keyboard.press("ArrowDown")
    await expect(filaRanking(page, "Bogotá, D.C.")).toBeFocused()
    await page.keyboard.press("Enter")
    const bogota = page.getByRole("complementary", { name: "Bogotá, D.C." })
    await expect(bogota).toBeVisible()
    await expect(bogota.getByText(/Bogotá es un solo municipio/)).toBeVisible()
    await expect(bogota.getByRole("button", { name: /^Explorar/ })).toHaveCount(0)

    // → sobre Bogotá no cambia de nivel; sobre Antioquia sí.
    await filaRanking(page, "Bogotá, D.C.").focus()
    await page.keyboard.press("ArrowRight")
    expect(parametro(page, "nivel")).toBeNull()
    await filaRanking(page, "Antioquia").focus()
    await page.keyboard.press("ArrowRight")
    await expect.poll(() => parametro(page, "depto")).toBe("05")
    await contexto.close()
  })

  test("métrica, tasa por 100 mil y modo calor se reflejan en la URL", async ({
    browser,
  }) => {
    const { contexto, page } = await nuevoContexto(browser, estadoSesion, {
      viewport: { width: 1440, height: 900 },
    })
    await abrirExplorador(page)

    await page.getByRole("combobox", { name: "Métrica del mapa" }).click()
    await page.getByRole("option", { name: "GMV comprometido" }).click()
    await expect.poll(() => parametro(page, "metrica")).toBe("gmv")
    await expect(ranking(page)).toHaveAccessibleName(/GMV comprometido/i)

    await page.getByRole("button", { name: "Por 100 mil hab." }).click()
    await expect.poll(() => parametro(page, "por100k")).toBe("true")
    await expect(page.getByText(/por 100 mil hab\./).first()).toBeVisible()

    // El calor solo existe para métricas con puntos reales.
    await expect(page.getByRole("button", { name: "Calor" })).toHaveCount(0)
    await page.getByRole("combobox", { name: "Métrica del mapa" }).click()
    await page.getByRole("option", { name: "Accesos a la plataforma" }).click()
    await page.getByRole("button", { name: "Calor" }).click()
    await expect.poll(() => parametro(page, "calor")).toBe("true")
    await expect(page.getByText(/Densidad · Accesos/)).toBeVisible()
    await contexto.close()
  })

  test("exporta un PNG con nombre descriptivo", async ({ browser }) => {
    const { contexto, page } = await nuevoContexto(browser, estadoSesion, {
      viewport: { width: 1440, height: 900 },
      acceptDownloads: true,
    })
    await abrirExplorador(page)
    const boton = page.getByRole("button", { name: "Descargar imagen del mapa" })
    await expect(boton).toBeEnabled({ timeout: 30_000 })
    const descarga = page.waitForEvent("download")
    await boton.click()
    expect((await descarga).suggestedFilename()).toMatch(
      /^amo-mapa-medios-colombia-\d{4}-\d{2}-\d{2}\.png$/
    )
    await contexto.close()
  })

  test("móvil: el toque abre la hoja inferior y «Explorar» baja de nivel", async ({
    browser,
  }) => {
    const { contexto, page } = await nuevoContexto(browser, estadoSesion, {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    })
    await page.goto(RUTA)
    await page.getByRole("button", { name: "Ranking", exact: true }).click()
    await filaRanking(page, "Antioquia").click()

    const hoja = page.getByRole("dialog", { name: "Antioquia" })
    await expect(hoja).toBeVisible()
    await hoja.getByRole("button", { name: "Explorar Antioquia" }).click()
    await expect.poll(() => parametro(page, "depto")).toBe("05")
    await expect(hoja).toBeHidden()

    const ancho = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(ancho).toBeLessThanOrEqual(390)
    await contexto.close()
  })

  test("el coachmark aparece una sola vez", async ({ browser }) => {
    const contexto = await browser.newContext({
      storageState: estadoSesion,
      viewport: { width: 1440, height: 900 },
    })
    await interceptarApi(contexto)
    const page = await contexto.newPage()
    await abrirExplorador(page)
    const coachmark = page.getByRole("dialog", { name: "Cómo usar el mapa" })
    await expect(coachmark).toBeVisible({ timeout: 30_000 })
    await coachmark.getByRole("button", { name: "Entendido" }).click()
    await expect(coachmark).toBeHidden()
    await page.reload()
    await expect(ranking(page)).toBeVisible()
    await page.waitForTimeout(1500)
    await expect(coachmark).toHaveCount(0)
    await contexto.close()
  })

  test("un fallo de la API se muestra aislado, con reintento", async ({ browser }) => {
    const { contexto, page } = await nuevoContexto(browser, estadoSesion, {
      viewport: { width: 1440, height: 900 },
    })
    await contexto.unroute("**/api/geo/metricas?**")
    await interceptarApi(page, {
      estado: 503,
      mensaje: "El explorador todavía no tiene datos.",
    })
    await page.goto(RUTA)
    const aviso = page.getByRole("alert").filter({ hasText: "No pudimos cargar los datos del mapa" })
    await expect(aviso).toBeVisible()
    await expect(aviso.getByRole("button", { name: "Reintentar" })).toBeVisible()
    // El resto de la app sigue en pie.
    await expect(page.getByRole("link", { name: "Inicio" }).first()).toBeVisible()
    await contexto.close()
  })

  test("sin infracciones graves de accesibilidad (paneles del explorador)", async ({
    browser,
  }) => {
    const { contexto, page } = await nuevoContexto(browser, estadoSesion, {
      viewport: { width: 1440, height: 900 },
    })
    await abrirExplorador(page)
    await filaRanking(page, "Antioquia").click()
    const { violations } = await new AxeBuilder({ page })
      .include("main")
      // El lienzo WebGL y los controles propios de Mapbox no son nuestros.
      .exclude(".mapboxgl-canvas-container")
      .exclude(".mapboxgl-control-container")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze()
    const graves = violations.filter((violacion) =>
      ["serious", "critical"].includes(violacion.impact ?? "")
    )
    expect(graves).toEqual([])
    await contexto.close()
  })
})
