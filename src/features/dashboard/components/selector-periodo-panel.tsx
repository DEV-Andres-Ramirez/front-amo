"use client"

import { CalendarRange, Check, ChevronDown } from "lucide-react"
import { useState } from "react"
import type { DateRange } from "react-day-picker"
import { es } from "react-day-picker/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  ETIQUETAS_PRESET,
  inicioDelDia,
  type PresetAutomatico,
  rangoPersonalizado,
  ZONA,
} from "@/lib/fechas"
import { cn } from "@/lib/utils"

import {
  DIAS_MAXIMOS_PANEL,
  PRESETS_PANEL,
  rangoPanel,
  textoPeriodo,
  valoresParaPreset,
  valoresParaRango,
} from "../periodo"
import { usePeriodoPanel } from "./proveedor-periodo"

const MS_DIA = 86_400_000

/**
 * Periodo del panel: presets de `@/lib/fechas` o un rango del calendario
 * (máximo dos años). Escribe en la URL; el panel se vuelve a calcular en el
 * servidor y lo anterior queda atenuado mientras tanto.
 */
export function SelectorPeriodoPanel({ className }: { className?: string }) {
  const esMovil = useIsMobile()
  const { valores, porDefecto, fijar, actualizando } = usePeriodoPanel()
  const rango = rangoPanel(valores, porDefecto)
  const [abierto, setAbierto] = useState(false)
  const [borrador, setBorrador] = useState<DateRange | undefined>()

  function cambiarAbierto(siguiente: boolean) {
    // Cada apertura parte del periodo vigente.
    if (siguiente) setBorrador({ from: rango.desde, to: rango.hasta })
    setAbierto(siguiente)
  }

  function elegirPreset(preset: PresetAutomatico) {
    fijar(valoresParaPreset(preset, porDefecto))
    setAbierto(false)
  }

  const hoy = inicioDelDia(new Date())
  const elegido = borrador?.from
    ? rangoPersonalizado(borrador.from, borrador.to ?? borrador.from)
    : null
  const dias = elegido
    ? Math.round((elegido.hasta.getTime() - elegido.desde.getTime()) / MS_DIA) +
      1
    : 0
  const demasiadoLargo = dias > DIAS_MAXIMOS_PANEL

  function aplicarRango() {
    if (!elegido || demasiadoLargo) return
    fijar(valoresParaRango(elegido))
    setAbierto(false)
  }

  return (
    <Popover open={abierto} onOpenChange={cambiarAbierto}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "min-w-0 justify-start bg-card dark:bg-input/30",
              className
            )}
          />
        }
        aria-label={`Periodo: ${textoPeriodo(rango)}`}
      >
        {actualizando ? (
          <Spinner data-icon="inline-start" aria-hidden />
        ) : (
          <CalendarRange data-icon="inline-start" aria-hidden />
        )}
        <span className="truncate">{textoPeriodo(rango)}</span>
        <ChevronDown
          data-icon="inline-end"
          aria-hidden
          className="ml-auto opacity-60"
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
      >
        <div className="flex flex-col md:flex-row">
          <div
            role="group"
            aria-label="Periodos rápidos"
            className="grid grid-cols-2 gap-1 border-b p-2 md:flex md:w-44 md:flex-col md:border-r md:border-b-0"
          >
            {PRESETS_PANEL.map((preset) => {
              const activo = rango.preset === preset
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => elegirPreset(preset)}
                  className={cn(
                    "flex h-8 items-center justify-between gap-2 rounded-md px-2.5 text-left text-[0.8125rem] transition-colors hover:bg-muted focus-visible:anillo-foco",
                    activo &&
                      "bg-primary/10 font-medium text-primary hover:bg-primary/15"
                  )}
                >
                  {ETIQUETAS_PRESET[preset]}
                  {activo ? <Check className="size-3.5" aria-hidden /> : null}
                </button>
              )
            })}
          </div>
          <div className="flex flex-col">
            <Calendar
              mode="range"
              locale={es}
              timeZone={ZONA}
              numberOfMonths={esMovil ? 1 : 2}
              defaultMonth={
                esMovil
                  ? rango.hasta
                  : new Date(
                      rango.hasta.getFullYear(),
                      rango.hasta.getMonth() - 1,
                      1
                    )
              }
              selected={borrador}
              onSelect={setBorrador}
              disabled={{ after: hoy }}
              className="bg-transparent p-3 [--cell-size:--spacing(8)]"
            />
            <div className="flex items-center justify-between gap-3 border-t px-3 py-2.5">
              <p
                className={cn(
                  "min-w-0 truncate text-xs cifras",
                  demasiadoLargo ? "text-destructive" : "text-muted-foreground"
                )}
                aria-live="polite"
              >
                {demasiadoLargo
                  ? "Elige un periodo de máximo dos años"
                  : elegido
                    ? textoPeriodo(elegido)
                    : "Elige el día inicial y el final"}
              </p>
              <Button
                size="sm"
                onClick={aplicarRango}
                disabled={!elegido || demasiadoLargo}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
