import { describe, expect, it, vi } from "vitest"

import { animarColores } from "./animacion-colores"
import {
  interpolarColor,
  pinturaCirculos,
  pinturaRelleno,
  pinturaSinDatos,
  radioCirculo,
} from "./expresiones"
import { nombreArchivoMapa } from "./exportar-mapa"
import { crearPatronRayado } from "./patron-rayado"
import { puntosSparkline } from "./sparkline"
import { posicionTooltip } from "./tooltip-flotante"

describe("expresiones del coroplético", () => {
  it("el rayado de «sin datos» se apaga en el mapa mundial y en modo calor", () => {
    const base = { calor: false, foco: "ninguno" as const, rayar: true }
    expect(pinturaSinDatos("oscuro", base)["fill-opacity"]).not.toBe(0)
    expect(pinturaSinDatos("oscuro", { ...base, rayar: false })["fill-opacity"]).toBe(0)
    expect(pinturaSinDatos("oscuro", { ...base, calor: true })["fill-opacity"]).toBe(0)
  })

  it("las capas no reciben la luz ni el tema monocromo del mapa base", () => {
    const relleno = pinturaRelleno("oscuro", {
      calor: false,
      foco: "ninguno",
      rayar: true,
    })
    expect(relleno["fill-emissive-strength"]).toBe(1)
    expect(relleno["fill-color-use-theme"]).toBe("none")
    expect(
      pinturaCirculos("claro", { calor: true, foco: "ninguno" })["circle-emissive-strength"]
    ).toBe(1)
  })

  it("el radio de los círculos crece con la raíz del valor, entre 4 y 22 px", () => {
    expect(radioCirculo(null, 100)).toBe(0)
    expect(radioCirculo(0, 100)).toBe(0)
    expect(radioCirculo(100, 100)).toBe(22)
    expect(radioCirculo(25, 100)).toBe(13)
    expect(radioCirculo(500, 100)).toBe(22)
  })

  it("interpola colores HEX para las transiciones", () => {
    expect(interpolarColor("#000000", "#ffffff", 0)).toBe("#000000")
    expect(interpolarColor("#000000", "#ffffff", 0.5)).toBe("#808080")
    expect(interpolarColor("#000", "#fff", 2)).toBe("#ffffff")
  })

  it("la animación sin duración escribe el destino y borra lo que sale", () => {
    const escribir = vi.fn()
    const actuales = new Map([["05", "#111111"], ["08", "#222222"]])
    animarColores({
      actuales,
      destino: new Map([["05", "#AAAAAA"]]),
      colorBase: "#000000",
      duracionMs: 0,
      escribir,
    })
    expect(escribir).toHaveBeenCalledWith("05", "#AAAAAA")
    expect(escribir).toHaveBeenCalledWith("08", null)
    expect([...actuales]).toEqual([["05", "#AAAAAA"]])
  })
})

describe("utilidades del mapa", () => {
  it("el patrón rayado repite rayas diagonales opacas sobre fondo transparente", () => {
    const patron = crearPatronRayado("#FF0000", { lado: 6, periodo: 3, grosor: 1 })
    expect(patron.data).toHaveLength(6 * 6 * 4)
    // (0,0) raya; (1,0) vacío.
    expect([...patron.data.slice(0, 4)]).toEqual([255, 0, 0, 255])
    expect(patron.data[7]).toBe(0)
    expect(() => crearPatronRayado("oklch(0.5 0.1 300)")).toThrow()
  })

  it("el tooltip se voltea cerca de los bordes", () => {
    const contenedor = { width: 400, height: 300 }
    expect(posicionTooltip(100, 200, 120, 60, contenedor)).toBe(
      "translate3d(114px, 126px, 0)"
    )
    expect(posicionTooltip(380, 10, 120, 60, contenedor)).toBe(
      "translate3d(246px, 24px, 0)"
    )
  })

  it("la sparkline normaliza la serie al lienzo", () => {
    expect(puntosSparkline([], 28)).toEqual([])
    const puntos = puntosSparkline([0, 10], 28)
    expect(puntos[0]).toEqual([0, 26])
    expect(puntos[1]).toEqual([100, 2])
  })

  it("el nombre del PNG es seguro y descriptivo", () => {
    expect(nombreArchivoMapa(["Medios", "Bogotá, D.C.", "2026-09-30"])).toBe(
      "amo-mapa-medios-bogota-d-c-2026-09-30.png"
    )
  })
})
