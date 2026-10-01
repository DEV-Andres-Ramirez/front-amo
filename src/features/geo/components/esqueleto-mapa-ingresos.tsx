import { Esqueleto } from "@/components/feedback/esqueletos"
import { cn } from "@/lib/utils"

/** Silueta de la tarjeta "Mapa de ingresos" (misma caja que la real). */
export function EsqueletoMapaIngresos({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-full flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Esqueleto className="size-8 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Esqueleto className="h-4 w-32" />
            <Esqueleto className="h-3 w-56 max-w-full" />
          </div>
        </div>
        <Esqueleto className="h-8 w-40 rounded-lg" />
      </div>
      <div className="flex flex-1 items-center">
        <Esqueleto className="aspect-[1000/435] w-full rounded-xl" />
      </div>
      <Esqueleto className="h-3 w-64 max-w-full" />
    </div>
  )
}
