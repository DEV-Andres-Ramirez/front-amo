// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ErrorDatosGeo } from "./tipos"

type Resultado = { data: unknown; error: unknown }

const bd = vi.hoisted(() => ({
  rpc: null as unknown as (nombre: string, args: Record<string, unknown>) => Promise<Resultado>,
  tablas: {} as Record<string, Resultado>,
}))

/** Consulta encadenable de PostgREST que resuelve con el resultado de la tabla. */
function consultaFalsa(resultado: Resultado) {
  const cadena: Record<string, unknown> = {}
  for (const metodo of ["select", "eq", "gte", "lt", "not", "is", "limit"]) {
    cadena[metodo] = () => cadena
  }
  cadena.then = (resolver: (valor: Resultado) => unknown) => resolver(resultado)
  return cadena
}

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/server", () => ({
  crearClienteServidor: async () => ({
    rpc: (nombre: string, args: Record<string, unknown>) => bd.rpc(nombre, args),
    from: (tabla: string) =>
      consultaFalsa(bd.tablas[tabla] ?? { data: [], error: null }),
  }),
}))

const { crearProveedorSupabase } = await import("./proveedor-supabase")

const NACIONAL = {
  nivel: "nacional",
  metrica: "medios",
  desde: "2026-09-01",
  hasta: "2026-09-30",
  departamento: null,
} as const

const conError = (code: string, message = "x", details: string | null = null) =>
  async (): Promise<Resultado> => ({ data: null, error: { code, message, details } })

describe("proveedor Supabase del explorador", () => {
  beforeEach(() => {
    bd.tablas = {}
    bd.rpc = async () => ({ data: [], error: null })
  })

  it("llama a geo_metricas con el nivel de la RPC y valida las filas", async () => {
    const llamadas: Record<string, unknown>[] = []
    bd.rpc = async (_nombre, args) => {
      llamadas.push(args)
      return {
        // numeric de Postgres llega como texto; los códigos de char(n), con relleno.
        data: [
          { codigo: "05 ", codigo_geometria: null, nombre: "Antioquia", valor: "123", n: 123, poblacion: "6900000", valor_por_100k: null },
        ],
        error: null,
      }
    }
    const respuesta = await crearProveedorSupabase().mapa(NACIONAL)
    expect(llamadas[0]).toMatchObject({ p_nivel: "departamento", p_metrica: "medios", p_departamento: null })
    expect(respuesta.origen).toBe("base-de-datos")
    expect(respuesta.filas).toEqual([
      { codigo: "05", codigoGeometria: "05", nombre: "Antioquia", valor: 123, n: 123, poblacion: 6_900_000, valorPor100k: null },
    ])
  })

  it("un municipio sin polígono propio se dibuja con el que lo representa", async () => {
    bd.rpc = async () => ({
      data: [{ codigo: "13490", nombre: "Norosí", valor: 2, n: 2, poblacion: null, valor_por_100k: null }],
      error: null,
    })
    const { filas } = await crearProveedorSupabase().mapa({
      ...NACIONAL,
      nivel: "departamental",
      departamento: "13",
    })
    expect(filas[0].codigoGeometria).toBe("13600")
  })

  it("traduce los errores de la BD a motivos con estado HTTP", async () => {
    const proveedor = crearProveedorSupabase()
    const motivo = async () =>
      proveedor.mapa(NACIONAL).catch((error: unknown) => {
        expect(error).toBeInstanceOf(ErrorDatosGeo)
        return (error as ErrorDatosGeo).motivo
      })

    bd.rpc = conError("PGRST202")
    expect(await motivo()).toBe("no-disponible")
    bd.rpc = conError("P0001", "AMO_NO_AUTORIZADO")
    expect(await motivo()).toBe("no-autorizado")
    bd.rpc = conError("P0001", "AMO_METRICA_NIVEL_INVALIDO", "La métrica no existe para este nivel.")
    await expect(proveedor.mapa(NACIONAL)).rejects.toThrow("La métrica no existe para este nivel.")
    bd.rpc = conError("57014", "canceling statement due to statement timeout")
    // El detalle técnico de Postgres no llega a la interfaz: solo su código.
    await expect(proveedor.mapa(NACIONAL)).rejects.toThrow(
      "No se pudieron consultar las métricas geográficas (57014)."
    )
    expect(await motivo()).toBe("fallo")
  })

  it("los puntos de medios se dispersan en su cabecera; si la tabla falla, el mapa sigue sin calor", async () => {
    bd.tablas.medios = {
      data: [{ municipio_codigo: "05001" }, { municipio_codigo: "05001" }],
      error: null,
    }
    const { puntos } = await crearProveedorSupabase().mapa(NACIONAL)
    expect(puntos).not.toBeNull()
    expect(puntos?.reduce((total, [, , peso]) => total + peso, 0)).toBeCloseTo(2)
    for (const [lon, lat] of puntos ?? []) {
      expect(Math.abs(lon - -75.58)).toBeLessThan(0.1)
      expect(Math.abs(lat - 6.25)).toBeLessThan(0.1)
    }

    bd.tablas.medios = { data: null, error: { code: "42P01", message: "x" } }
    const sinTabla = await crearProveedorSupabase().mapa(NACIONAL)
    expect(sinTabla.puntos).toBeNull()
  })

  it("en el detalle, una métrica fallida queda sin valor; sin la RPC, todo el detalle es «no disponible»", async () => {
    bd.rpc = async (_nombre, args) =>
      args.p_metrica === "cumplimiento"
        ? { data: null, error: { code: "P0001", message: "AMO_METRICA_NIVEL_INVALIDO" } }
        : { data: [{ codigo: "05", nombre: "Antioquia", valor: 7, n: 7 }], error: null }
    const detalle = await crearProveedorSupabase().detalle({
      ...NACIONAL,
      zona: "05",
      metricasKpi: ["medios", "cumplimiento"],
    })
    expect(detalle.kpis).toEqual([
      { metrica: "medios", valor: 7, n: 7 },
      { metrica: "cumplimiento", valor: null, n: null },
    ])
    expect(detalle.serie).toBeNull()

    bd.rpc = conError("PGRST202")
    await expect(
      crearProveedorSupabase().detalle({ ...NACIONAL, zona: "05", metricasKpi: ["medios"] })
    ).rejects.toMatchObject({ motivo: "no-disponible" })
  })
})
