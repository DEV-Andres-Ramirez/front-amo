import { Esqueleto } from "@/components/feedback/esqueletos"
import { cn } from "@/lib/utils"

import { CLASE_LIENZO } from "./lienzo"

const FILAS_RANKING = 9

/**
 * Esqueleto fiel del explorador: lienzo del mapa con la silueta de Colombia,
 * encabezado, controles, ranking y leyenda. Se adapta al ancho del
 * contenedor (container queries), igual que el explorador.
 */
export function EsqueletoExplorador({
  className,
  superpuesto = false,
}: {
  className?: string
  /** Encima del mapa mientras carga (sin alto propio). */
  superpuesto?: boolean
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        "@container/mapa overflow-hidden bg-background",
        superpuesto ? "absolute inset-0 z-20" : cn("relative", CLASE_LIENZO),
        className
      )}
    >
      <span className="sr-only">Cargando el explorador geográfico…</span>
      <div aria-hidden className="absolute inset-0 patron-puntos opacity-60" />
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 aspect-[3/4] h-[62%] -translate-1/2 rounded-[42%_38%_46%_40%] esqueleto-shimmer opacity-40 @min-[64rem]/mapa:left-[55%]"
      />

      <div className="absolute inset-0 flex flex-col gap-3 p-3 @min-[42rem]/mapa:p-4">
        <div className="flex flex-col gap-3 @min-[42rem]/mapa:flex-row @min-[42rem]/mapa:items-start @min-[42rem]/mapa:justify-between">
          <div className="vidrio flex w-full flex-col gap-2.5 rounded-2xl p-3.5 @min-[42rem]/mapa:w-[21rem]">
            <Esqueleto className="h-4 w-40" />
            <Esqueleto className="h-3 w-56" />
          </div>
          <div className="vidrio flex items-center gap-2 rounded-2xl p-2">
            <Esqueleto className="h-8 flex-1 @min-[42rem]/mapa:w-48 @min-[42rem]/mapa:flex-none" />
            <Esqueleto className="h-8 w-10 @min-[42rem]/mapa:w-36" />
            <Esqueleto className="h-8 w-8" />
          </div>
        </div>

        <div className="hidden min-h-0 flex-1 @min-[64rem]/mapa:flex">
          <div className="vidrio flex w-[21rem] flex-col gap-3 rounded-2xl p-3.5">
            <Esqueleto className="h-4 w-44" />
            <Esqueleto className="h-3 w-32" />
            <div className="mt-2 flex flex-col gap-3.5">
              {Array.from({ length: FILAS_RANKING }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Esqueleto className="size-5 rounded-md" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Esqueleto className="h-3 w-3/5" />
                    <Esqueleto className="h-1.5 w-full rounded-full" />
                  </div>
                  <Esqueleto className="h-3 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 @min-[64rem]/mapa:ml-[22rem]">
          <div className="vidrio flex flex-col gap-2 rounded-2xl p-3">
            <Esqueleto className="h-3 w-28" />
            <Esqueleto className="h-2.5 w-52 rounded-full" />
          </div>
          <div className="vidrio flex flex-col gap-1 rounded-xl p-1">
            <Esqueleto className="size-8" />
            <Esqueleto className="size-8" />
          </div>
        </div>
      </div>
    </div>
  )
}
