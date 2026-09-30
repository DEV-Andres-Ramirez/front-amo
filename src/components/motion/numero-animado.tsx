"use client"

import NumberFlow, { type Format } from "@number-flow/react"

import { cn } from "@/lib/utils"
import { LOCALE, OPCIONES_NUMERO, opcionesPorcentaje } from "@/lib/format"

export type FormatoNumero =
  "numero" | "cop" | "copCompacto" | "compacto" | "porcentaje"

interface NumeroAnimadoProps {
  valor: number
  formato?: FormatoNumero
  /** Decimales para "numero" (máximo) y "porcentaje" (fijos). */
  decimales?: number
  className?: string
  prefijo?: string
  sufijo?: string
}

function opcionesDeFormato(formato: FormatoNumero, decimales: number): Format {
  switch (formato) {
    case "cop":
      return OPCIONES_NUMERO.cop
    case "copCompacto":
      return OPCIONES_NUMERO.copCompacto
    case "compacto":
      return OPCIONES_NUMERO.compacto
    case "porcentaje":
      return opcionesPorcentaje(decimales)
    case "numero":
      return { maximumFractionDigits: decimales }
  }
}

/**
 * Cifra que anima sus dígitos al cambiar (NumberFlow). Usa las mismas opciones
 * de Intl que `@/lib/format`, así el texto coincide con tablas y exportaciones.
 * NumberFlow respeta `prefers-reduced-motion` por defecto.
 */
export function NumeroAnimado({
  valor,
  formato = "numero",
  decimales = formato === "porcentaje" ? 1 : 0,
  className,
  prefijo,
  sufijo,
}: NumeroAnimadoProps) {
  return (
    <NumberFlow
      value={Number.isFinite(valor) ? valor : 0}
      locales={LOCALE}
      format={opcionesDeFormato(formato, decimales)}
      prefix={prefijo}
      suffix={sufijo}
      className={cn("cifras", className)}
    />
  )
}
