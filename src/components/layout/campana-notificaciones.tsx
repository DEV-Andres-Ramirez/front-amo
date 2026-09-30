"use client"

import { ArrowRight, Bell, BellOff } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { RUTA_NOTIFICACIONES } from "@/lib/auth/navegacion"

const MAXIMO_VISIBLE = 9

function etiquetaAccesible(noLeidas: number): string {
  if (noLeidas === 0) return "Notificaciones"
  return `Notificaciones, ${noLeidas} sin leer`
}

/**
 * Campana con el conteo de no leídas. La lista real llega con el módulo de
 * notificaciones (polling de React Query, docs/modelo-datos.md §9.1); por
 * ahora el conteo entra por prop y el panel enlaza a la bandeja.
 */
export function CampanaNotificaciones({ noLeidas = 0 }: { noLeidas?: number }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={etiquetaAccesible(noLeidas)}
            className="relative"
          />
        }
      >
        <Bell className="size-[1.1rem]" aria-hidden />
        {noLeidas > 0 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.625rem] leading-none font-semibold cifras text-primary-foreground ring-2 ring-background"
          >
            {noLeidas > MAXIMO_VISIBLE ? `${MAXIMO_VISIBLE}+` : noLeidas}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <PopoverHeader className="border-b px-4 py-3">
          <PopoverTitle className="font-heading text-sm font-semibold">
            Notificaciones
          </PopoverTitle>
          <PopoverDescription className="text-xs">
            {noLeidas > 0
              ? `Tienes ${noLeidas} sin leer.`
              : "Aquí verás avisos de campañas, ofertas y pagos."}
          </PopoverDescription>
        </PopoverHeader>
        {noLeidas === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
              <BellOff className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-medium">Estás al día</p>
            <p className="text-xs text-muted-foreground">
              No tienes notificaciones nuevas.
            </p>
          </div>
        ) : null}
        <div className="border-t p-1.5">
          <Button
            variant="ghost"
            className="w-full justify-between"
            nativeButton={false}
            render={<Link href={RUTA_NOTIFICACIONES} />}
          >
            Ver todas
            <ArrowRight aria-hidden data-icon="inline-end" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
