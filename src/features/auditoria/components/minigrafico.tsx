import { cn } from "@/lib/utils"

import { geometriaMinigrafico } from "../minigrafico"

const ANCHO = 96
const ALTO = 32

/**
 * Tendencia de un indicador en el tono de marca, sin ejes: la línea (2 px),
 * un lavado suave debajo y el último tramo marcado con un punto. La cifra
 * exacta vive en la tarjeta; aquí solo importa la forma.
 */
export function Minigrafico({
  valores,
  etiqueta,
  className,
}: {
  valores: readonly number[]
  /** Descripción para lectores de pantalla ("Eventos por día"). */
  etiqueta: string
  className?: string
}) {
  const geometria = geometriaMinigrafico(valores, ANCHO, ALTO, 3)
  if (!geometria) return null
  return (
    <svg
      role="img"
      aria-label={etiqueta}
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-24 overflow-visible text-primary", className)}
    >
      <title>{etiqueta}</title>
      <path d={geometria.area} className="fill-current opacity-12" />
      <path
        d={geometria.linea}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={geometria.ultimo.x}
        cy={geometria.ultimo.y}
        r={3}
        className="fill-current stroke-card"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
