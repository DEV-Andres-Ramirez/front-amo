"use client"

import { CalendarRange, MapPinOff } from "lucide-react"
import type { ReactNode } from "react"

import { EstadoError } from "@/components/feedback/estado-error"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { CLASE_PANEL } from "./lienzo"

/** Tarjeta centrada sobre el mapa (no bloquea el resto de controles). */
function TarjetaCentrada({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-4">
      <div
        className={cn(
          CLASE_PANEL,
          "w-full max-w-sm animate-aparecer-arriba",
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function AvisoErrorDatos({
  mensaje,
  pista,
  onReintentar,
}: {
  mensaje: string
  pista?: string
  onReintentar: () => void
}) {
  return (
    <TarjetaCentrada>
      <EstadoError
        compacto
        titulo="No pudimos cargar los datos del mapa"
        descripcion={
          <>
            {mensaje}
            {pista ? (
              <span className="mt-2 block rounded-lg bg-foreground/5 px-2.5 py-1.5 font-mono text-[0.6875rem]">
                {pista}
              </span>
            ) : null}
          </>
        }
        onReintentar={onReintentar}
      />
    </TarjetaCentrada>
  )
}

/** El lienzo de Mapbox no arrancó; `mensaje` ya viene en español (`mensajeErrorMapa`). */
export function AvisoErrorMapa({
  mensaje,
  onReintentar,
}: {
  mensaje: string
  onReintentar: () => void
}) {
  return (
    <TarjetaCentrada>
      <EstadoError
        compacto
        titulo="El mapa no pudo iniciar"
        descripcion={`${mensaje} El ranking sigue disponible.`}
        onReintentar={onReintentar}
      />
    </TarjetaCentrada>
  )
}

export function AvisoSinDatos({
  zonaSingular,
  onAmpliar,
}: {
  zonaSingular: string
  onAmpliar: (() => void) | null
}) {
  return (
    <TarjetaCentrada className="flex flex-col items-center gap-3 p-5 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary">
        <MapPinOff aria-hidden className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">Sin datos en este periodo</p>
        <p className="text-xs text-balance text-muted-foreground">
          Ningún {zonaSingular.toLowerCase()} registra esta métrica entre las
          fechas elegidas.
        </p>
      </div>
      {onAmpliar ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={onAmpliar}
          className="pointer-events-auto"
        >
          <CalendarRange data-icon="inline-start" aria-hidden />
          Ver este año
        </Button>
      ) : null}
    </TarjetaCentrada>
  )
}

/** Mientras Mapbox descarga el estilo: silueta y textura, sin saltos al aparecer. */
export function CargaLienzo({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 bg-background transition-opacity duration-700 ease-out",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="absolute inset-0 patron-puntos opacity-60" />
      <div className="absolute top-1/2 left-1/2 aspect-[3/4] h-[58%] max-w-[78%] -translate-1/2 rounded-[42%_38%_46%_40%] esqueleto-shimmer opacity-40 @min-[60rem]/mapa:left-[58%]" />
    </div>
  )
}
