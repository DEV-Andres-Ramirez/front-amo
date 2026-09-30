"use client"

import { CalendarRange, Check } from "lucide-react"
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
import {
  inicioDelDia,
  rangoDesdePreset,
  rangoPersonalizado,
  type RangoFechas,
  ZONA,
} from "@/lib/fechas"
import { cn } from "@/lib/utils"

import {
  ETIQUETAS_PRESET_MAPA,
  PRESETS_MAPA,
  type PresetMapa,
} from "../estado-url"
import { formatearPeriodo } from "../formato"

interface SelectorPeriodoProps {
  rango: RangoFechas
  onCambiar: (rango: RangoFechas) => void
  /** Solo el ícono y un rótulo corto (barra móvil). */
  compacto?: boolean
  className?: string
}

function esPresetMapa(valor: string): valor is PresetMapa {
  return PRESETS_MAPA.includes(valor as PresetMapa)
}

/** Periodo del mapa: presets frecuentes o un rango a medida en el calendario. */
export function SelectorPeriodo({
  rango,
  onCambiar,
  compacto = false,
  className,
}: SelectorPeriodoProps) {
  const [abierto, setAbierto] = useState(false)
  const [borrador, setBorrador] = useState<DateRange | undefined>()
  const [hoy] = useState(() => inicioDelDia(new Date()))
  const etiqueta = esPresetMapa(rango.preset)
    ? ETIQUETAS_PRESET_MAPA[rango.preset]
    : formatearPeriodo(rango.desde, rango.hasta)

  const elegirPreset = (preset: PresetMapa) => {
    onCambiar(rangoDesdePreset(preset))
    setAbierto(false)
  }

  const aplicar = () => {
    if (!borrador?.from) return
    onCambiar(rangoPersonalizado(borrador.from, borrador.to ?? borrador.from))
    setAbierto(false)
  }

  return (
    <Popover
      open={abierto}
      onOpenChange={(siguiente) => {
        setAbierto(siguiente)
        if (siguiente) setBorrador({ from: rango.desde, to: rango.hasta })
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            aria-label={`Periodo: ${formatearPeriodo(rango.desde, rango.hasta)}`}
            className={cn(
              "h-9 gap-2 rounded-xl bg-foreground/5 px-3 font-medium hover:bg-foreground/8 dark:hover:bg-foreground/10",
              className
            )}
          />
        }
      >
        <CalendarRange aria-hidden className="text-primary" />
        <span className={cn("truncate", compacto && "sr-only")}>{etiqueta}</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        <div className="flex flex-col sm:flex-row">
          <ul
            aria-label="Periodos frecuentes"
            className="flex flex-row flex-wrap gap-1 border-b p-2 sm:w-44 sm:flex-col sm:flex-nowrap sm:border-r sm:border-b-0"
          >
            {PRESETS_MAPA.map((preset) => (
              <li key={preset}>
                <button
                  type="button"
                  onClick={() => elegirPreset(preset)}
                  aria-pressed={rango.preset === preset}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:anillo-foco aria-pressed:bg-primary/10 aria-pressed:font-medium aria-pressed:text-primary"
                >
                  {ETIQUETAS_PRESET_MAPA[preset]}
                  {rango.preset === preset ? (
                    <Check aria-hidden className="size-3.5" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 p-2">
            <Calendar
              mode="range"
              locale={es}
              timeZone={ZONA}
              selected={borrador}
              onSelect={setBorrador}
              defaultMonth={rango.hasta}
              disabled={{ after: hoy }}
              numberOfMonths={1}
              className="p-1"
            />
            <div className="flex items-center justify-between gap-2 border-t px-1 pt-2">
              <p className="cifras text-xs text-muted-foreground">
                {borrador?.from
                  ? formatearPeriodo(borrador.from, borrador.to ?? borrador.from)
                  : "Elige el día inicial"}
              </p>
              <Button size="sm" onClick={aplicar} disabled={!borrador?.from}>
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
