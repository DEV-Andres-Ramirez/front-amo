import { useId } from "react"

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

/** Coordenadas normalizadas de la serie en el lienzo 100 × alto. */
export function puntosSparkline(
  valores: readonly number[],
  alto: number
): [number, number][] {
  if (valores.length === 0) return []
  const minimo = Math.min(...valores)
  const maximo = Math.max(...valores)
  const rango = maximo - minimo || 1
  const margen = 2
  const paso = valores.length > 1 ? ANCHO / (valores.length - 1) : 0
  return valores.map((valor, i) => [
    valores.length > 1 ? i * paso : ANCHO / 2,
    margen + (alto - 2 * margen) * (1 - (valor - minimo) / rango),
  ])
}

/**
 * Línea de tendencia mínima (SVG) con área degradada y el último punto
 * marcado. Hereda el color (`currentColor`) del contenedor.
 */
export function Sparkline({
  valores,
  etiqueta,
  className,
  alto = 28,
}: SparklineProps) {
  const id = useId()
  const puntos = puntosSparkline(valores, alto)
  if (puntos.length === 0) return null

  const linea = puntos
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ")
  const area = `${linea} L${ANCHO},${alto} L0,${alto} Z`
  const [ultimoX, ultimoY] = puntos[puntos.length - 1]

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
        style={{ left: `${ultimoX}%`, top: `${(ultimoY / alto) * 100}%` }}
      />
    </div>
  )
}
