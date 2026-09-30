"use client"

import type { Chart, ChartType, TooltipModel } from "chart.js"
import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

import type { MarcaSerie } from "./tipos"

/** Clave de la serie en el tooltip: trazo corto, nunca una caja (dataviz). */
export type ClaveSerie = MarcaSerie

export interface FilaTooltip {
  id: string
  color: string
  clave: ClaveSerie
  /** El valor manda: va primero y en negrita. */
  valor: string
  etiqueta: string
}

export interface ContenidoTooltip {
  titulo: string
  filas: readonly FilaTooltip[]
  /** Nota al pie (p. ej. "62 % del total"). */
  pie?: string
}

export interface EstadoTooltip extends ContenidoTooltip {
  /** Punto de anclaje en px, relativo al lienzo. */
  x: number
  y: number
  anchoLienzo: number
  altoLienzo: number
}

type ConstruirContenido<TTipo extends ChartType> = (
  tooltip: TooltipModel<TTipo>,
  grafico: Chart<TTipo>
) => ContenidoTooltip | null

function mismoEstado(a: EstadoTooltip | null, b: EstadoTooltip): boolean {
  return (
    a !== null &&
    a.x === b.x &&
    a.y === b.y &&
    a.titulo === b.titulo &&
    a.pie === b.pie &&
    a.filas.length === b.filas.length &&
    a.filas.every(
      (fila, i) =>
        fila.valor === b.filas[i].valor && fila.etiqueta === b.filas[i].etiqueta
    )
  )
}

/**
 * Tooltip propio (HTML) para Chart.js: `externo` va en
 * `plugins.tooltip.external` y `tooltip` se pasa a `<TooltipVidrio>`. El
 * callback es estable, así las opciones memorizadas no cambian por él.
 */
export function useTooltipGrafico<TTipo extends ChartType>(
  construir: ConstruirContenido<TTipo>
) {
  const [tooltip, setTooltip] = useState<EstadoTooltip | null>(null)
  const construirRef = useRef(construir)

  useEffect(() => {
    construirRef.current = construir
  }, [construir])

  const externo = useCallback(
    ({
      chart,
      tooltip: modelo,
    }: {
      chart: Chart<TTipo>
      tooltip: TooltipModel<TTipo>
    }) => {
      const contenido =
        modelo.opacity === 0 ? null : construirRef.current(modelo, chart)
      if (!contenido || contenido.filas.length === 0) {
        setTooltip(null)
        return
      }
      const siguiente: EstadoTooltip = {
        ...contenido,
        x: modelo.caretX,
        y: modelo.caretY,
        anchoLienzo: chart.width,
        altoLienzo: chart.height,
      }
      setTooltip((previo) =>
        mismoEstado(previo, siguiente) ? previo : siguiente
      )
    },
    []
  )

  return { tooltip, externo }
}

function MarcaSerie({ color, clave }: Pick<FilaTooltip, "color" | "clave">) {
  if (clave === "bloque") {
    return (
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-[3px]"
        style={{ backgroundColor: color }}
      />
    )
  }
  return (
    <span
      aria-hidden
      className="w-3 shrink-0 border-t-2"
      style={{
        borderColor: color,
        borderTopStyle: clave === "discontinua" ? "dashed" : "solid",
      }}
    />
  )
}

/** Lo que se vería en el tooltip, como texto plano (región viva, pruebas). */
export function textoTooltip(contenido: ContenidoTooltip): string {
  const filas = contenido.filas.map((fila) => `${fila.etiqueta}: ${fila.valor}`)
  return [contenido.titulo, ...filas, contenido.pie].filter(Boolean).join(". ")
}

/**
 * Tooltip de vidrio: valor en negrita primero, serie después con su trazo.
 * Se ancla al punto activo y cambia de lado cerca del borde derecho.
 */
export function TooltipVidrio({ estado }: { estado: EstadoTooltip | null }) {
  if (!estado) return null

  const aLaIzquierda = estado.x > estado.anchoLienzo * 0.58
  const arriba = Math.min(Math.max(estado.y, 24), estado.altoLienzo - 24)

  return (
    <div
      aria-hidden
      data-slot="tooltip-grafico"
      className={cn(
        "pointer-events-none absolute z-20 flex max-w-64 min-w-36 flex-col gap-1.5 rounded-xl vidrio px-3 py-2.5 text-xs shadow-lg shadow-black/10",
        "animate-in transition-[left,top] duration-100 ease-out fade-in-0 zoom-in-95 motion-reduce:animate-none motion-reduce:transition-none"
      )}
      style={{
        left: estado.x,
        top: arriba,
        transform: aLaIzquierda
          ? "translate(calc(-100% - 14px), -50%)"
          : "translate(14px, -50%)",
      }}
    >
      <p className="font-medium text-muted-foreground">{estado.titulo}</p>
      <ul className="flex flex-col gap-1">
        {estado.filas.map((fila) => (
          <li key={fila.id} className="flex items-center gap-2">
            <MarcaSerie color={fila.color} clave={fila.clave} />
            <span className="font-semibold cifras whitespace-nowrap text-foreground">
              {fila.valor}
            </span>
            <span className="truncate text-muted-foreground">
              {fila.etiqueta}
            </span>
          </li>
        ))}
      </ul>
      {estado.pie ? (
        <p className="border-t pt-1.5 text-muted-foreground">{estado.pie}</p>
      ) : null}
    </div>
  )
}
