import { type CSSProperties, type ReactNode, Suspense } from "react"

import { cn } from "@/lib/utils"

import { LimiteErrorBloque } from "./limite-error-bloque"

/**
 * Celda de la rejilla del panel: límite de error propio + Suspense con un
 * esqueleto fiel. Cada bloque consulta en paralelo y aparece en cuanto llega
 * (con un fundido ascendente escalonado por `orden`).
 */
export function BloquePanel({
  titulo,
  esqueleto,
  orden = 0,
  className,
  children,
}: {
  titulo: string
  esqueleto: ReactNode
  /** Posición visual: escalona la entrada cuando varios llegan a la vez. */
  orden?: number
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 flex-col *:flex-1", className)}>
      <LimiteErrorBloque titulo={titulo}>
        <Suspense fallback={esqueleto}>
          <EntradaBloque orden={orden}>{children}</EntradaBloque>
        </Suspense>
      </LimiteErrorBloque>
    </div>
  )
}

/** Animación CSS (no motion): se pinta en SSR sin esperar a hidratar. */
function EntradaBloque({
  orden,
  children,
}: {
  orden: number
  children: ReactNode
}) {
  const estilo: CSSProperties = { animationDelay: `${Math.min(orden, 8) * 45}ms` }
  return (
    <div
      className="flex min-w-0 animate-aparecer-arriba flex-col *:flex-1 motion-reduce:animate-none"
      style={estilo}
    >
      {children}
    </div>
  )
}
