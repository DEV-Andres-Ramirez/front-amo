import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { MiniMapaColombia } from "./mini-mapa-colombia"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

const VALORES = { "05": 123, "11": 122, "76": 82, "08": 0, "91": null }

describe("MiniMapaColombia", () => {
  it("dibuja los 33 departamentos con nombre y cifra accesibles", () => {
    render(
      <MiniMapaColombia
        valores={VALORES}
        metrica="medios"
        etiqueta="Medios por departamento"
        enlazar
      />
    )
    expect(
      screen.getByRole("group", { name: "Medios por departamento" })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("link")).toHaveLength(33)
    expect(screen.getByRole("link", { name: "Antioquia: 123" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /^Amazonas: Sin datos$/ })).toBeInTheDocument()
  })

  it("cada departamento abre el explorador; Bogotá abre el mapa nacional", () => {
    render(
      <MiniMapaColombia
        valores={VALORES}
        metrica="medios"
        etiqueta="Medios"
        enlazar
      />
    )
    fireEvent.click(screen.getByRole("link", { name: /^Antioquia/ }))
    expect(push).toHaveBeenLastCalledWith(
      "/analitica/mapa?nivel=departamental&depto=05"
    )
    fireEvent.keyDown(screen.getByRole("link", { name: /^Bogotá/ }), {
      key: "Enter",
    })
    expect(push).toHaveBeenLastCalledWith("/analitica/mapa")
  })

  it("sin enlaces no expone controles y muestra la leyenda", () => {
    render(<MiniMapaColombia valores={VALORES} metrica="medios" etiqueta="Medios" />)
    expect(screen.queryAllByRole("link")).toHaveLength(0)
    expect(screen.getByText("Sin datos")).toBeInTheDocument()
  })
})
