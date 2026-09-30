import { describe, expect, it } from "vitest"

import { geometriaMinigrafico } from "./minigrafico"

describe("geometriaMinigrafico", () => {
  it("null con menos de dos puntos o todo en cero", () => {
    expect(geometriaMinigrafico([], 100, 40)).toBeNull()
    expect(geometriaMinigrafico([5], 100, 40)).toBeNull()
    expect(geometriaMinigrafico([0, 0, 0], 100, 40)).toBeNull()
  })

  it("escala desde cero dentro del margen y marca el último punto", () => {
    const geometria = geometriaMinigrafico([0, 5, 10], 100, 40, 0)
    expect(geometria?.linea).toBe("M0 40 L50 20 L100 0")
    expect(geometria?.area).toBe("M0 40 L50 20 L100 0 L100 40 L0 40 Z")
    expect(geometria?.ultimo).toEqual({ x: 100, y: 0 })
  })

  it("trata negativos y no finitos como cero", () => {
    const geometria = geometriaMinigrafico([-3, Number.NaN, 4], 10, 10, 0)
    expect(geometria?.linea).toBe("M0 10 L5 10 L10 0")
  })
})
