import { useId } from "react"

import { trazarSparkline } from "@/components/charts/trazado-sparkline"
import { cn } from "@/lib/utils"

interface SparklineProps {
  valores: readonly number[]
  /** Resumen accesible ("Evolución diaria: mínimo 3, máximo 12"). */
  etiqueta: string
  className?: string
  /** Alto del lienzo en unidades del viewBox (el ancho es 100). */
  alto?: number
}

const ANCHO = 100
const MARGEN = 2

/**
 * Sparkline que ocupa todo el ancho de su contenedor (el SVG se estira y el
 * trazo no se deforma), con área degradada y el último punto marcado. La
 * geometría es la de las tarjetas KPI (`trazarSparkline`); hereda el color
 * (`currentColor`) del contenedor.
 */
export function Sparkline({
  valores,
  etiqueta,
  className,
  alto = 28,
}: SparklineProps) {
  const id = useId()
  const { linea, area, ultimo } = trazarSparkline(valores, ANCHO, alto, MARGEN)
  if (!linea || !ultimo) return null

  return (
    <div className={cn("relative h-10 w-full text-primary", className)}>
      <svg
        role="img"
        aria-label={etiqueta}
        viewBox={`0 0 ${ANCHO} ${alto}`}
        preserveAspectRatio="none"
        className="size-full overflow-visible"
      >
        <defs>
          <linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id}-area)`} />
        <path
          d={linea}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* El punto final va fuera del SVG estirado para que siga siendo redondo. */}
      <span
        aria-hidden
        className="absolute size-1.5 -translate-1/2 rounded-full bg-current ring-2 ring-current/25"
        style={{ left: `${ultimo.x}%`, top: `${(ultimo.y / alto) * 100}%` }}
      />
    </div>
  )
}
