import { describe, expect, it } from "vitest"

import {
  calcularDelta,
  formatearCOP,
  formatearCOPCompacto,
  formatearCompacto,
  formatearDelta,
  formatearFecha,
  formatearFechaHora,
  formatearNumero,
  formatearPorcentaje,
  formatearRelativo,
  tendenciaDelta,
} from "./format"

/** Intl usa espacios duros (U+00A0/U+202F); se normalizan para comparar. */
const normalizar = (texto: string) => texto.replace(/[  ]/g, " ")

describe("moneda y números", () => {
  it("formatea COP sin decimales", () => {
    expect(normalizar(formatearCOP(1234567))).toBe("$ 1.234.567")
    expect(normalizar(formatearCOP(1234567.8))).toBe("$ 1.234.568")
    expect(normalizar(formatearCOP(0))).toBe("$ 0")
  })

  it("formatea COP compacto", () => {
    expect(normalizar(formatearCOPCompacto(1_300_000))).toBe("$1,3 M")
    expect(normalizar(formatearCOPCompacto(13_500))).toBe("$13,5 k")
  })

  it("formatea números con separador de miles y decimales opcionales", () => {
    expect(formatearNumero(1234567)).toBe("1.234.567")
    expect(formatearNumero(1234.567, 2)).toBe("1.234,57")
    expect(formatearNumero(3, 2)).toBe("3")
  })

  it("formatea números compactos", () => {
    expect(normalizar(formatearCompacto(1_300_000))).toBe("1,3 M")
    expect(formatearCompacto(950)).toBe("950")
  })

  it("formatea porcentajes desde fracciones", () => {
    expect(normalizar(formatearPorcentaje(0.125))).toBe("12,5%")
    expect(normalizar(formatearPorcentaje(0.5, 0))).toBe("50%")
    expect(normalizar(formatearPorcentaje(0.12345, 2))).toBe("12,35%")
  })

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    "devuelve una raya para valores ausentes (%s)",
    (valor) => {
      expect(formatearCOP(valor)).toBe("—")
      expect(formatearNumero(valor)).toBe("—")
      expect(formatearPorcentaje(valor)).toBe("—")
      expect(formatearDelta(valor)).toBe("—")
    }
  )
})

describe("deltas", () => {
  it("incluye flecha y signo", () => {
    expect(normalizar(formatearDelta(0.125))).toBe("↑ +12,5%")
    expect(normalizar(formatearDelta(-0.031))).toBe("↓ -3,1%")
    expect(normalizar(formatearDelta(0))).toBe("→ 0,0%")
  })

  it("trata como estable lo que se redondea a cero", () => {
    expect(tendenciaDelta(0.00004)).toBe("estable")
    expect(normalizar(formatearDelta(-0.00004))).toBe("→ 0,0%")
    expect(tendenciaDelta(0.0004, 2)).toBe("sube")
  })

  it("calcula la variación relativa y la omite sin base", () => {
    expect(calcularDelta(150, 100)).toBe(0.5)
    expect(calcularDelta(50, 100)).toBe(-0.5)
    expect(calcularDelta(10, -20)).toBe(1.5)
    expect(calcularDelta(10, 0)).toBeNull()
  })
})

describe("fechas en hora de Bogotá", () => {
  // 03:00 UTC del 30 = 22:00 del 29 en Bogotá (UTC−5).
  const cruceDeDia = new Date("2026-09-30T03:00:00Z")

  it("usa el día de Bogotá aunque el proceso corra en UTC", () => {
    expect(formatearFecha(cruceDeDia, "corto")).toBe("29/09/2026")
    expect(normalizar(formatearFecha(cruceDeDia))).toBe("29 de sept de 2026")
    expect(formatearFecha(cruceDeDia, "largo")).toBe("29 de septiembre de 2026")
  })

  it("acepta ISO y marcas de tiempo", () => {
    expect(formatearFecha("2026-01-15T12:00:00Z", "corto")).toBe("15/01/2026")
    expect(formatearFecha(Date.UTC(2026, 0, 15, 12), "corto")).toBe(
      "15/01/2026"
    )
  })

  it("formatea fecha y hora en 12 horas", () => {
    expect(normalizar(formatearFechaHora("2026-09-30T20:05:00Z"))).toBe(
      "30 de sept de 2026, 3:05 p. m."
    )
  })

  it("devuelve una raya para fechas inválidas", () => {
    expect(formatearFecha("no-es-fecha")).toBe("—")
    expect(formatearFecha(null)).toBe("—")
    expect(formatearFechaHora("")).toBe("—")
  })
})

describe("formatearRelativo", () => {
  const ahora = new Date("2026-09-30T15:00:00Z")
  const hace = (segundos: number) => new Date(ahora.getTime() - segundos * 1000)

  it.each([
    [10, "ahora"],
    [5 * 60, "hace 5 minutos"],
    [3 * 3600, "hace 3 horas"],
    [26 * 3600, "ayer"],
    [3 * 86400, "hace 3 días"],
    [14 * 86400, "hace 2 semanas"],
    [60 * 86400, "hace 2 meses"],
    [400 * 86400, "el año pasado"],
  ])("hace %i s → %s", (segundos, esperado) => {
    expect(formatearRelativo(hace(segundos), ahora)).toBe(esperado)
  })

  it("expresa fechas futuras", () => {
    expect(formatearRelativo(hace(-2 * 86400), ahora)).toBe("pasado mañana")
    expect(formatearRelativo(hace(-3600), ahora)).toBe("dentro de 1 hora")
  })
})
