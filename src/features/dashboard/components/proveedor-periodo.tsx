"use client"

import { useQueryStates } from "nuqs"
import {
  createContext,
  type ReactNode,
  use,
  useMemo,
  useTransition,
} from "react"

import type { PresetAutomatico } from "@/lib/fechas"
import { cn } from "@/lib/utils"

import { parsersPeriodo, type ValoresPeriodo } from "../periodo"

interface ContextoPeriodo {
  /** El servidor está calculando el panel del periodo nuevo. */
  actualizando: boolean
  porDefecto: PresetAutomatico
  valores: ValoresPeriodo
  fijar: (valores: ValoresPeriodo) => void
}

const Contexto = createContext<ContextoPeriodo | null>(null)

export function usePeriodoPanel(): ContextoPeriodo {
  const contexto = use(Contexto)
  if (!contexto) {
    throw new Error("usePeriodoPanel debe usarse dentro de ProveedorPeriodo")
  }
  return contexto
}

/**
 * Estado del periodo del panel: escribe la URL (nuqs) y vuelve a pedir el
 * panel al servidor dentro de una transición, así lo anterior sigue visible
 * (atenuado) mientras llega lo nuevo, sin saltos a esqueletos.
 */
export function ProveedorPeriodo({
  porDefecto,
  children,
}: {
  porDefecto: PresetAutomatico
  children: ReactNode
}) {
  const [actualizando, iniciar] = useTransition()
  const [valores, fijarValores] = useQueryStates(parsersPeriodo, {
    shallow: false,
    scroll: false,
    startTransition: iniciar,
  })
  const valor = useMemo<ContextoPeriodo>(
    () => ({
      actualizando,
      porDefecto,
      valores,
      fijar: (siguientes) => void fijarValores(siguientes),
    }),
    [actualizando, porDefecto, valores, fijarValores]
  )
  return <Contexto value={valor}>{children}</Contexto>
}

/** Contenido del panel: se atenúa y anuncia la carga al cambiar de periodo. */
export function ContenidoPanel({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const { actualizando } = usePeriodoPanel()
  return (
    <div
      aria-busy={actualizando || undefined}
      className={cn(
        "transition-opacity duration-300 ease-suave",
        actualizando && "pointer-events-none opacity-55 motion-reduce:opacity-70",
        className
      )}
    >
      {children}
    </div>
  )
}
