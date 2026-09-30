import { defineConfig, devices } from "@playwright/test"

const URL_BASE = "http://localhost:3000"

// SwiftShader permite renderizar WebGL (Mapbox) en navegadores headless sin GPU.
const OPCIONES_LANZAMIENTO = {
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: URL_BASE,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    colorScheme: "dark",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "escritorio",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: OPCIONES_LANZAMIENTO,
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 834, height: 1112 },
        hasTouch: true,
        launchOptions: OPCIONES_LANZAMIENTO,
      },
    },
    {
      name: "movil",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
        launchOptions: OPCIONES_LANZAMIENTO,
      },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    // robots.txt siempre responde 200; "/" redirige y depende de la sesión.
    url: `${URL_BASE}/robots.txt`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
  },
})
