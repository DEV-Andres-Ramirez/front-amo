import { describe, expect, it } from "vitest"

import {
  admiteCalor,
  admitePor100k,
  DEFINICIONES_METRICAS,
  METRICAS_GEO,
  metricaPermitida,
  metricasDelNivel,
  NIVELES_GEO,
  resolverMetrica,
} from "./metricas"

const SIN_ACCESOS = METRICAS_GEO.filter((metrica) => metrica !== "accesos")

describe("catálogo de métricas del mapa", () => {
  it("cada nivel ofrece las métricas de la matriz (§5.9)", () => {
    expect(metricasDelNivel("internacional")).toEqual([
      "anunciantes",
      "accesos",
      "audiencia",
    ])
    expect(metricasDelNivel("nacional")).toContain("medios")
    expect(metricasDelNivel("nacional")).not.toContain("audiencia")
    expect(metricasDelNivel("departamental")).toEqual(
      metricasDelNivel("nacional")
    )
    for (const nivel of NIVELES_GEO) {
      expect(metricasDelNivel(nivel).length).toBeGreaterThan(0)
    }
  })

  it("accesos exige además `accesos.ver`", () => {
    expect(metricaPermitida("accesos", () => false)).toBe(false)
    expect(metricaPermitida("accesos", (p) => p === "accesos.ver")).toBe(true)
    expect(metricaPermitida("medios", () => false)).toBe(true)
  })

  it("resuelve la métrica pedida, la del nivel o la primera permitida", () => {
    expect(resolverMetrica("nacional", "gmv")).toBe("gmv")
    expect(resolverMetrica("nacional", "audiencia")).toBe("medios")
    expect(resolverMetrica("internacional", null)).toBe("audiencia")
    expect(resolverMetrica("internacional", "accesos", SIN_ACCESOS)).toBe(
      "audiencia"
    )
    expect(resolverMetrica("internacional", null, ["medios"])).toBeNull()
  })

  it("por 100 mil habitantes solo en nacional y con conteos o montos", () => {
    expect(admitePor100k("nacional", "medios")).toBe(true)
    expect(admitePor100k("nacional", "cumplimiento")).toBe(false)
    expect(admitePor100k("departamental", "medios")).toBe(false)
  })

  it("el mapa de calor solo con coordenadas reales", () => {
    expect(admiteCalor("accesos")).toBe(true)
    expect(admiteCalor("medios")).toBe(true)
    expect(admiteCalor("gmv")).toBe(false)
    expect(
      METRICAS_GEO.filter((m) => DEFINICIONES_METRICAS[m].conPuntos)
    ).toEqual(["medios", "accesos"])
  })
})
