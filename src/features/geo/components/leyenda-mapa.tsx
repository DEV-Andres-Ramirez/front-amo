"use client"

import type { CSSProperties } from "react"

import type { EscalaCoropletica, TemaMapa } from "@/lib/geo/escalas"
import { cn } from "@/lib/utils"

import { formatearValorGeo, unidadGeo } from "../formato"
import { DEFINICIONES_METRICAS, type MetricaGeo } from "../metricas"
import { CLASE_PANEL } from "./lienzo"

/** Clase de la leyenda en foco: índice de clase o "sin datos". */
export type FocoLeyenda = number | "sin-datos" | null

interface LeyendaMapaProps {
  escala: EscalaCoropletica
  tema: TemaMapa
  metrica: MetricaGeo
  por100k: boolean
  /** Zonas por clase (mismo orden que `escala.leyenda`) y sin dato. */
  conteos: readonly number[]
  sinDatos: number
  zonaPlural: string
  foco: FocoLeyenda
  fijado: FocoLeyenda
  onFoco: (foco: FocoLeyenda) => void
  onFijar: (foco: FocoLeyenda) => void
  calor: boolean
  compacta?: boolean
  className?: string
}

const ESTILO_RAYADO: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, color-mix(in oklab, var(--foreground) 22%, transparent) 0 2px, transparent 2px 6px)",
}

/**
 * Leyenda interactiva: pasar el puntero (o el foco) por una clase resalta sus
 * zonas en el mapa; un clic la fija. En modo calor explica la densidad.
 */
export function LeyendaMapa({
  escala,
  tema,
  metrica,
  por100k,
  conteos,
  sinDatos,
  zonaPlural,
  foco,
  fijado,
  onFoco,
  onFijar,
  calor,
  compacta = false,
  className,
}: LeyendaMapaProps) {
  const definicion = DEFINICIONES_METRICAS[metrica]
  const unidad = unidadGeo(metrica, por100k)
  // "Medios · medios" es redundante: la unidad solo se muestra si añade algo.
  const mostrarUnidad =
    unidad !== "" &&
    unidad.toLowerCase() !== definicion.tituloCorto.toLowerCase()
  const alternar = (clase: FocoLeyenda) => onFijar(fijado === clase ? null : clase)

  if (calor) {
    return (
      <div className={cn(CLASE_PANEL, "flex flex-col gap-2 p-3", className)}>
        <p className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          Densidad · {definicion.tituloCorto}
        </p>
        <div
          aria-hidden
          className={cn(
            "h-2 w-52 rounded-full",
            tema === "oscuro"
              ? "bg-[linear-gradient(90deg,#3F2A76,#7549DE,#A788F6,#DCD0FD,#FFFFFF)]"
              : "bg-[linear-gradient(90deg,#EDE7FE,#C3AEFB,#8C66EE,#6238BF,#261848)]"
          )}
        />
        <div className="flex justify-between text-[0.6875rem] text-muted-foreground">
          <span>Menos</span>
          <span>Más</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(CLASE_PANEL, "flex flex-col gap-2 p-3", className)}
      onPointerLeave={() => onFoco(null)}
    >
      <p className="flex items-baseline gap-1.5 text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {definicion.tituloCorto}
        {mostrarUnidad ? (
          <span className="font-normal tracking-normal normal-case">
            · {unidad}
          </span>
        ) : null}
      </p>

      <div
        role="group"
        aria-label={`Leyenda de ${definicion.titulo}`}
        className="flex items-end gap-2"
      >
        <div className="flex gap-0.5">
          {escala.leyenda.map((clase, indice) => {
            const activa = foco === indice || fijado === indice
            const rango =
              clase.hasta === null
                ? `${formatearValorGeo(clase.desde, metrica, { compacto: true, por100k })} o más`
                : `${formatearValorGeo(clase.desde, metrica, { compacto: true, por100k })} a ${formatearValorGeo(clase.hasta, metrica, { compacto: true, por100k })}`
            return (
              <button
                key={`${clase.color}-${indice}`}
                type="button"
                aria-pressed={fijado === indice}
                aria-label={`${rango}: ${conteos[indice] ?? 0} ${zonaPlural}`}
                title={`${rango} · ${conteos[indice] ?? 0} ${zonaPlural}`}
                onPointerEnter={() => onFoco(indice)}
                onFocus={() => onFoco(indice)}
                onBlur={() => onFoco(null)}
                onClick={() => alternar(indice)}
                className={cn(
                  "group flex flex-col items-start gap-1 rounded-md outline-none focus-visible:anillo-foco",
                  compacta ? "w-9" : "w-11"
                )}
              >
                <span
                  className={cn(
                    "h-2.5 w-full rounded-[3px] ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-200 ease-out",
                    indice === 0 && "rounded-l-full",
                    indice === escala.leyenda.length - 1 && "rounded-r-full",
                    activa && "-translate-y-0.5 shadow-[0_0_0_2px_var(--ring)]"
                  )}
                  style={{ backgroundColor: clase.color }}
                />
                <span className="cifras text-[0.625rem] leading-none text-muted-foreground group-hover:text-foreground">
                  {formatearValorGeo(clase.desde, metrica, {
                    compacto: true,
                    por100k,
                  })}
                </span>
              </button>
            )
          })}
        </div>

        {sinDatos > 0 ? (
          <button
            type="button"
            aria-pressed={fijado === "sin-datos"}
            aria-label={`Sin datos: ${sinDatos} ${zonaPlural}`}
            title={`Sin datos · ${sinDatos} ${zonaPlural}`}
            onPointerEnter={() => onFoco("sin-datos")}
            onFocus={() => onFoco("sin-datos")}
            onBlur={() => onFoco(null)}
            onClick={() => alternar("sin-datos")}
            className="group ml-1 flex flex-col items-start gap-1 rounded-md outline-none focus-visible:anillo-foco"
          >
            <span
              className={cn(
                "h-2.5 w-9 rounded-full bg-muted ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-200",
                (foco === "sin-datos" || fijado === "sin-datos") &&
                  "-translate-y-0.5 shadow-[0_0_0_2px_var(--ring)]"
              )}
              style={ESTILO_RAYADO}
            />
            <span className="text-[0.625rem] leading-none text-muted-foreground group-hover:text-foreground">
              Sin datos
            </span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
