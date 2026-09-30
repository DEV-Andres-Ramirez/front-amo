import { describe, expect, it } from "vitest"

import { formatearValorGeo, unidadGeo } from "./formato"

const sinEspacios = (texto: string) => texto.replace(/\s/g, " ")

describe("formato de cifras del mapa", () => {
  it("distingue sin datos de cero", () => {
    expect(formatearValorGeo(null, "medios")).toBe("Sin datos")
    expect(formatearValorGeo(Number.NaN, "medios")).toBe("Sin datos")
    expect(formatearValorGeo(0, "medios")).toBe("0")
  })

  it("formatea por unidad (COP, porcentaje, conteos)", () => {
    expect(sinEspacios(formatearValorGeo(1_234_567, "gmv"))).toBe("$ 1.234.567")
    expect(formatearValorGeo(0.8123, "cumplimiento")).toMatch(/^81,2\s?%$/)
    expect(formatearValorGeo(12_345, "medios")).toBe("12.345")
  })

  it("el modo compacto abrevia cifras grandes", () => {
    expect(formatearValorGeo(12_345, "alcance", { compacto: true })).not.toBe(
      "12.345"
    )
    expect(formatearValorGeo(950, "alcance", { compacto: true })).toBe("950")
  })

  it("las tasas por 100 mil habitantes conservan decimales útiles y la moneda", () => {
    expect(formatearValorGeo(3.456, "medios", { por100k: true })).toBe("3,46")
    expect(formatearValorGeo(45.66, "medios", { por100k: true })).toBe("45,7")
    expect(
      sinEspacios(formatearValorGeo(2_612_164, "gmv", { por100k: true }))
    ).toBe("$ 2.612.164")
  })

  it("rotula la unidad sin repetir la métrica", () => {
    expect(unidadGeo("medios")).toBe("medios")
    expect(unidadGeo("gmv")).toBe("")
    expect(unidadGeo("medios", true)).toBe("por 100 mil hab.")
  })
})
