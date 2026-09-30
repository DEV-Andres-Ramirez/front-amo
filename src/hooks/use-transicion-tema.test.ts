import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useTransicionTema } from "./use-transicion-tema"

const setTheme = vi.hoisted(() => vi.fn())
vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme, theme: "dark", resolvedTheme: "dark" }),
}))

/** jsdom no implementa la View Transition API: se instala un doble por test. */
function instalarStartViewTransition(implementacion: unknown) {
  Object.defineProperty(document, "startViewTransition", {
    value: implementacion,
    configurable: true,
  })
}

function simularMovimientoReducido(reducido: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (consulta) =>
      ({
        matches: reducido && consulta.includes("reduce"),
        media: consulta,
      }) as MediaQueryList
  )
}

describe("useTransicionTema", () => {
  const raiz = document.documentElement

  beforeEach(() => {
    simularMovimientoReducido(false)
  })

  afterEach(() => {
    Reflect.deleteProperty(document, "startViewTransition")
    raiz.removeAttribute("style")
    vi.restoreAllMocks()
  })

  it("cambia al instante si el navegador no soporta View Transitions", () => {
    const { result } = renderHook(() => useTransicionTema())
    act(() => result.current.cambiarTema("light"))
    expect(setTheme).toHaveBeenCalledWith("light")
    expect(raiz).not.toHaveAttribute("data-transicion")
  })

  it("revela el tema desde el punto del clic", async () => {
    let finalizar: () => void = () => {}
    const finished = new Promise<void>((resolver) => (finalizar = resolver))
    const startViewTransition = vi.fn((actualizar: () => void) => {
      actualizar()
      return { finished }
    })
    instalarStartViewTransition(startViewTransition)

    const { result } = renderHook(() => useTransicionTema())
    act(() =>
      result.current.cambiarTema("light", { clientX: 120, clientY: 40 })
    )

    expect(startViewTransition).toHaveBeenCalledOnce()
    expect(setTheme).toHaveBeenCalledWith("light")
    expect(raiz).toHaveAttribute("data-transicion", "tema")
    expect(raiz.style.getPropertyValue("--vt-x")).toBe("120px")
    expect(raiz.style.getPropertyValue("--vt-y")).toBe("40px")

    await act(async () => {
      finalizar()
      await finished
    })
    expect(raiz).not.toHaveAttribute("data-transicion")
  })

  it("respeta prefers-reduced-motion", () => {
    simularMovimientoReducido(true)
    const startViewTransition = vi.fn()
    instalarStartViewTransition(startViewTransition)

    const { result } = renderHook(() => useTransicionTema())
    act(() => result.current.cambiarTema("dark"))

    expect(startViewTransition).not.toHaveBeenCalled()
    expect(setTheme).toHaveBeenCalledWith("dark")
  })
})
