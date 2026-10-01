// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import { formatearPorcentaje } from "@/lib/format"

import { ErrorDatosGeo } from "./tipos"

type Resultado = { data: unknown; error: unknown; count?: number | null }

interface LecturaTabla {
  tabla: string
  columnas: string
  cabecera: boolean
  filtros: [string, string, unknown][]
  rango: [number, number] | null
}

const bd = vi.hoisted(() => ({
  rpc: null as unknown as (nombre: string, args: Record<string, unknown>) => Promise<Resultado>,
  /** Respuesta de cada lectura de tabla (conteo o página). */
  tabla: null as unknown as (lectura: LecturaTabla) => Resultado,
  lecturas: [] as LecturaTabla[],
}))

/** Consulta encadenable de PostgREST que registra filtros y rango. */
function consultaFalsa(tabla: string, columnas: string, opciones?: { head?: boolean }) {
  const lectura: LecturaTabla = {
    tabla,
    columnas,
    cabecera: opciones?.head ?? false,
    filtros: [],
    rango: null,
  }
  const cadena: Record<string, unknown> = {
    filter: (c: string, op: string, v: unknown) => (lectura.filtros.push([c, op, v]), cadena),
    eq: (c: string, v: unknown) => (lectura.filtros.push([c, "eq", v]), cadena),
    not: (c: string, op: string, v: unknown) => (lectura.filtros.push([c, `not.${op}`, v]), cadena),
    or: () => cadena,
    order: () => cadena,
    range: (desde: number, hasta: number) => ((lectura.rango = [desde, hasta]), cadena),
    then: (resolver: (valor: Resultado) => unknown) => {
      bd.lecturas.push(lectura)
      return resolver(bd.tabla(lectura))
    },
  }
  return cadena
}

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/server", () => ({
  crearClienteServidor: async () => ({
    rpc: (nombre: string, args: Record<string, unknown>) => bd.rpc(nombre, args),
    from: (tabla: string) => ({
      select: (columnas: string, opciones?: { head?: boolean }) =>
        consultaFalsa(tabla, columnas, opciones),
    }),
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

const filtro = (lectura: LecturaTabla, columna: string) =>
  lectura.filtros.find(([c]) => c === columna)

describe("proveedor Supabase del explorador", () => {
  beforeEach(() => {
    bd.lecturas = []
    bd.rpc = async () => ({ data: [], error: null })
    bd.tabla = () => ({ data: [], error: null, count: 0 })
  })

  describe("mapa", () => {
    it("llama a geo_metricas con el nivel de la RPC y normaliza las filas", async () => {
      const llamadas: Record<string, unknown>[] = []
      bd.rpc = async (_nombre, args) => {
        llamadas.push(args)
        return {
          // numeric puede llegar como texto; los códigos char(n), con relleno.
          data: [
            { codigo: "05 ", codigo_geometria: null, nombre: "Antioquia", valor: "123", n: 123, poblacion: "6900000", valor_por_100k: null },
          ],
          error: null,
        }
      }
      const respuesta = await crearProveedorSupabase().mapa(NACIONAL)
      expect(llamadas[0]).toEqual({
        p_nivel: "departamento",
        p_metrica: "medios",
        p_desde: "2026-09-01",
        p_hasta: "2026-09-30",
        p_departamento: null,
      })
      expect(respuesta).toEqual({
        consulta: NACIONAL,
        filas: [
          { codigo: "05", codigoGeometria: "05", nombre: "Antioquia", valor: 123, n: 123, poblacion: 6_900_000, valorPor100k: null },
        ],
        sinPoligono: [],
        origen: "base-de-datos",
      })
      // El coroplético no lee coordenadas.
      expect(bd.lecturas).toEqual([])
    })

    it("un municipio sin polígono propio se dibuja con el que lo representa", async () => {
      bd.rpc = async () => ({
        data: [{ codigo: "13490", codigo_geometria: null, nombre: "Norosí", valor: 2, n: 2, poblacion: null, valor_por_100k: null }],
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
  })

  describe("puntos del modo calor", () => {
    it("accesos: solo ingresos exitosos con coordenadas, agregados en celdas", async () => {
      bd.tabla = (lectura) =>
        lectura.cabecera
          ? { data: null, error: null, count: 3 }
          : {
              data: [
                { lat: 6.251, lon: -75.571 },
                { lat: 6.249, lon: -75.569 },
                { lat: 4.61, lon: -74.08 },
              ],
              error: null,
            }
      const respuesta = await crearProveedorSupabase().puntos({
        ...NACIONAL,
        nivel: "departamental",
        departamento: "05",
        metrica: "accesos",
      })
      expect(respuesta).toMatchObject({ total: 3, muestra: 3, pasoGrados: 0.01, origen: "base-de-datos" })
      expect(respuesta.puntos).toEqual([
        [-75.57, 6.25, 2],
        [-74.08, 4.61, 1],
      ])
      const [conteo, pagina] = bd.lecturas
      expect(conteo).toMatchObject({ tabla: "accesos", cabecera: true })
      expect(pagina).toMatchObject({ columnas: "lat, lon", rango: [0, 2] })
      expect(filtro(pagina, "evento")?.[2]).toBe("LOGIN_EXITOSO")
      expect(filtro(pagina, "pais_iso2")?.[2]).toBe("CO")
      expect(filtro(pagina, "departamento_codigo")?.[2]).toBe("05")
      expect(filtro(pagina, "lat")?.[1]).toBe("not.is")
      // Nunca se leen columnas que identifiquen a la persona.
      expect(bd.lecturas.every((l) => !/usuario|ip|email/.test(l.columnas))).toBe(true)
    })

    it("accesos: con más filas que el tope muestrea todo el periodo y compensa el peso", async () => {
      bd.tabla = (lectura) =>
        lectura.cabecera
          ? { data: null, error: null, count: 24_000 }
          : { data: Array.from({ length: 1000 }, () => ({ lat: 4.6, lon: -74.1 })), error: null }
      const respuesta = await crearProveedorSupabase().puntos({
        ...NACIONAL,
        nivel: "internacional",
        metrica: "accesos",
      })
      const paginas = bd.lecturas.filter((l) => !l.cabecera)
      expect(paginas).toHaveLength(12)
      expect(paginas.at(-1)?.rango?.[0]).toBeGreaterThan(20_000)
      expect(respuesta).toMatchObject({ total: 24_000, muestra: 12_000 })
      expect(respuesta.puntos).toEqual([[-74, 4.5, 24_000]])
      // En el mapa mundial no se limita a Colombia.
      expect(filtro(paginas[0], "pais_iso2")).toBeUndefined()
    })

    it("medios: verificados al cierre del periodo, en la cabecera de su municipio", async () => {
      bd.tabla = (lectura) =>
        lectura.cabecera
          ? { data: null, error: null, count: 2 }
          : { data: [{ municipio_codigo: "05001" }, { municipio_codigo: "05001" }], error: null }
      const { puntos, total } = await crearProveedorSupabase().puntos(NACIONAL)
      expect(total).toBe(2)
      expect(puntos.reduce((suma, [, , peso]) => suma + peso, 0)).toBeCloseTo(2)
      for (const [lon, lat] of puntos) {
        expect(Math.abs(lon - -75.58)).toBeLessThan(0.1)
        expect(Math.abs(lat - 6.25)).toBeLessThan(0.1)
      }
      const pagina = bd.lecturas.find((l) => !l.cabecera)
      expect(pagina?.columnas).toBe("municipio_codigo")
      expect(filtro(pagina!, "verificado_at")?.[1]).toBe("lt")
    })

    it("un fallo de la tabla es un error del modo calor (no un mapa vacío)", async () => {
      bd.tabla = () => ({ data: null, error: { code: "42501", message: "permission denied" } })
      await expect(
        crearProveedorSupabase().puntos({ ...NACIONAL, metrica: "accesos" })
      ).rejects.toMatchObject({ motivo: "no-autorizado" })
    })
  })

  describe("detalle compuesto", () => {
    const DETALLE = {
      ...NACIONAL,
      zona: "05",
      metricasKpi: ["medios", "cumplimiento"],
      conMedios: false,
    } as const

    it("pide la zona filtrada, compone KPI y una serie por cubeta", async () => {
      const llamadas: Record<string, unknown>[] = []
      bd.rpc = async (_nombre, args) => {
        llamadas.push(args)
        if (args.p_metrica === "cumplimiento") {
          return { data: null, error: { code: "P0001", message: "AMO_METRICA_NIVEL_INVALIDO" } }
        }
        const valor = args.p_desde === "2026-09-01" && args.p_hasta === "2026-09-30" ? 7 : 3
        return { data: [{ codigo: "05", nombre: "Antioquia", valor, n: valor }], error: null }
      }
      const detalle = await crearProveedorSupabase().detalle(DETALLE)
      expect(detalle.kpis).toEqual([
        { metrica: "medios", valor: 7, n: 7 },
        { metrica: "cumplimiento", valor: null, n: null },
      ])
      // Un departamento se pide filtrado: la RPC devuelve una sola fila.
      expect(llamadas.filter((a) => a.p_nivel === "departamento").every((a) => a.p_departamento === "05")).toBe(true)
      expect(detalle.serie?.granularidad).toBe("semana")
      expect(detalle.serie?.puntos.map((p) => p.valor)).toEqual([3, 3, 3, 3, 3])
      expect(detalle.serie?.puntos[0]).toMatchObject({ desde: "2026-09-01", hasta: "2026-09-06", parcial: true })
      expect(detalle.sinSerie).toBeNull()
      expect(detalle.medios).toBeNull()
    })

    it("en un departamento, el top son sus municipios con más valor", async () => {
      bd.rpc = async (_nombre, args) =>
        args.p_nivel === "municipio"
          ? {
              data: [
                { codigo: "05002", nombre: "Abejorral", valor: 1, n: 1 },
                { codigo: "05001", nombre: "Medellín", valor: 40, n: 40 },
                { codigo: "05004", nombre: "Abriaquí", valor: 0, n: 0 },
              ],
              error: null,
            }
          : { data: [{ codigo: "05", nombre: "Antioquia", valor: 41, n: 41 }], error: null }
      const { top } = await crearProveedorSupabase().detalle({ ...DETALLE, metricasKpi: ["medios"] })
      expect(top?.titulo).toBe("Municipios con más medios")
      expect(top?.filas.map((f) => f.nombre)).toEqual(["Medellín", "Abejorral"])
    })

    it("medios destacados: los del municipio, ordenados por asignaciones", async () => {
      bd.rpc = async (nombre, args) => {
        if (nombre === "reporte_cumplimiento_medios") {
          expect(args).toMatchObject({ p_departamento: "05" })
          return {
            data: [
              { medio_id: "m1", medio: "Radio Medellín", comprometidas: 12, tasa_cumplimiento: 0.92 },
              { medio_id: "m2", medio: "Envigado Hoy", comprometidas: 9, tasa_cumplimiento: 1 },
              { medio_id: "m3", medio: "Sin pauta", comprometidas: 0, tasa_cumplimiento: null },
            ],
            error: null,
          }
        }
        return { data: [{ codigo: "05001", nombre: "Medellín", valor: 3, n: 3 }], error: null }
      }
      bd.tabla = () => ({ data: [{ id: "m1" }, { id: "m3" }], error: null })
      const { medios } = await crearProveedorSupabase().detalle({
        ...DETALLE,
        nivel: "departamental",
        departamento: "05",
        zona: "05001",
        metricasKpi: ["medios"],
        conMedios: true,
      })
      expect(medios?.filas).toEqual([
        { codigo: "m1", nombre: "Radio Medellín", valor: 12, detalle: `${formatearPorcentaje(0.92, 0)} a tiempo` },
      ])
      expect(filtro(bd.lecturas[0], "municipio_codigo")?.[2]).toBe("05001")
    })

    it("la audiencia no tiene evolución; un error de la métrica activa es el error del detalle", async () => {
      bd.rpc = async () => ({ data: [{ codigo: "US", nombre: "Estados Unidos", valor: 10, n: 1 }], error: null })
      const audiencia = await crearProveedorSupabase().detalle({
        ...DETALLE,
        nivel: "internacional",
        metrica: "audiencia",
        zona: "US",
        metricasKpi: ["audiencia"],
      })
      expect(audiencia.serie).toBeNull()
      expect(audiencia.sinSerie).toBe("foto-actual")

      bd.rpc = conError("P0001", "AMO_NO_AUTORIZADO")
      await expect(crearProveedorSupabase().detalle(DETALLE)).rejects.toMatchObject({
        motivo: "no-autorizado",
      })
    })

    it("sin movimiento en el periodo: la serie se omite con su motivo", async () => {
      bd.rpc = async () => ({ data: [{ codigo: "05", nombre: "Antioquia", valor: 0, n: 0 }], error: null })
      const detalle = await crearProveedorSupabase().detalle({ ...DETALLE, metricasKpi: ["medios"] })
      expect(detalle.serie).toBeNull()
      expect(detalle.sinSerie).toBe("sin-datos")
    })
  })
})
