"use client"

import { CalendarRange, Check, ChevronDown } from "lucide-react"
import { useQueryStates } from "nuqs"
import { useState, useTransition } from "react"
import type { DateRange } from "react-day-picker"
import { es } from "react-day-picker/locale"

import { parseAsPagina } from "@/components/data-table/estado-url"
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
  PRESET_POR_DEFECTO,
  PRESETS_RANGO,
  type PresetAutomatico,
  rangoPersonalizado,
  serializarFecha,
  ZONA,
} from "@/lib/fechas"
import { cn } from "@/lib/utils"

import { etiquetaRango, parsersPeriodo, rangoDeValores } from "../periodo"

const PRESETS_AUTOMATICOS = PRESETS_RANGO.filter(
  (preset): preset is PresetAutomatico => preset !== "personalizado"
)

const parsers = { ...parsersPeriodo, pagina: parseAsPagina }

/**
 * Periodo de la página (presets de `@/lib/fechas` o un rango del calendario).
 * Escribe en la URL sin desplazar la vista; el servidor vuelve a consultar y
 * la página conserva lo anterior mientras llega lo nuevo. Cambiar el periodo
 * vuelve a la primera página de la tabla.
 */
export function SelectorPeriodo({ className }: { className?: string }) {
  const esMovil = useIsMobile()
  const [cargando, iniciar] = useTransition()
  const [valores, fijar] = useQueryStates(parsers, {
    shallow: false,
    scroll: false,
    startTransition: iniciar,
  })
  const rango = rangoDeValores(valores)
  const [abierto, setAbierto] = useState(false)
  const [borrador, setBorrador] = useState<DateRange | undefined>()

  function cambiarAbierto(siguiente: boolean) {
    // Cada apertura parte del periodo vigente.
    if (siguiente) setBorrador({ from: rango.desde, to: rango.hasta })
    setAbierto(siguiente)
  }

  function elegirPreset(preset: PresetAutomatico) {
    void fijar({
      periodo: preset === PRESET_POR_DEFECTO ? null : preset,
      desde: null,
      hasta: null,
      pagina: null,
    })
    setAbierto(false)
  }

  function aplicarRango() {
    if (!borrador?.from) return
    const elegido = rangoPersonalizado(
      borrador.from,
      borrador.to ?? borrador.from
    )
    void fijar({
      periodo: "personalizado",
      desde: serializarFecha(elegido.desde),
      hasta: serializarFecha(elegido.hasta),
      pagina: null,
    })
    setAbierto(false)
  }

  const hoy = inicioDelDia(new Date())
  const borradorCompleto = borrador?.from
    ? rangoPersonalizado(borrador.from, borrador.to ?? borrador.from)
    : null

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
        aria-label={`Periodo: ${etiquetaRango(rango)}`}
      >
        {cargando ? (
          <Spinner data-icon="inline-start" aria-hidden />
        ) : (
          <CalendarRange data-icon="inline-start" aria-hidden />
        )}
        <span className="truncate">{etiquetaRango(rango)}</span>
        <ChevronDown
          data-icon="inline-end"
          aria-hidden
          className="opacity-60"
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
            {PRESETS_AUTOMATICOS.map((preset) => {
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
                className="min-w-0 truncate text-xs cifras text-muted-foreground"
                aria-live="polite"
              >
                {borradorCompleto
                  ? etiquetaRango(borradorCompleto)
                  : "Elige el día inicial y el final"}
              </p>
              <Button
                size="sm"
                onClick={aplicarRango}
                disabled={!borrador?.from}
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
