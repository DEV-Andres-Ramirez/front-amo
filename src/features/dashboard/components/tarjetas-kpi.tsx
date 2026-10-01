"use client"

import {
  Banknote,
  Building2,
  CircleDollarSign,
  Clapperboard,
  Coins,
  Eye,
  Gauge,
  Handshake,
  Heart,
  type LucideIcon,
  Megaphone,
  MousePointerClick,
  Percent,
  RadioTower,
  Radar,
  ShieldCheck,
  Target,
  Users,
  Wallet,
} from "lucide-react"
import type { CSSProperties } from "react"

import { Esqueleto } from "@/components/feedback/esqueletos"
import { propsDesdeFila } from "@/components/kpi/desde-fila"
import { RejillaKpi } from "@/components/kpi/rejilla-kpi"
import { TarjetaKpi } from "@/components/kpi/tarjeta-kpi"
import type { FilaKpi } from "@/components/kpi/tipos"
import { cn } from "@/lib/utils"

import type {
  DatoSecundario,
  DefinicionTarjeta,
  NombreIconoKpi,
} from "../tarjetas"

/** Iconos por nombre: un componente no viaja del servidor al cliente. */
const ICONOS = {
  alcance: Radar,
  anunciantes: Building2,
  campanas: Megaphone,
  clics: MousePointerClick,
  comision: Coins,
  costo: Target,
  cumplimiento: ShieldCheck,
  dinero: CircleDollarSign,
  engagement: Heart,
  impresiones: Eye,
  inversion: Wallet,
  llenado: Gauge,
  medios: RadioTower,
  negocios: Handshake,
  pago: Banknote,
  porcentaje: Percent,
  reproducciones: Clapperboard,
  usuarios: Users,
} as const satisfies Record<NombreIconoKpi, LucideIcon>

const TONO_SECUNDARIO = {
  neutro: "text-foreground",
  aviso: "text-warning",
} as const

function Secundario({ dato }: { dato: DatoSecundario }) {
  return (
    <dl className="flex h-8.5 min-w-0 items-center justify-between gap-2 border-t border-dashed px-3.5 text-xs sm:px-4">
      <dt className="truncate text-muted-foreground">{dato.etiqueta}</dt>
      <dd
        className={cn(
          "shrink-0 font-medium cifras",
          TONO_SECUNDARIO[dato.tono ?? "neutro"]
        )}
      >
        {dato.valor}
      </dd>
    </dl>
  )
}

const MARCO =
  "flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] duration-300 hover:border-foreground/15"

/**
 * Fila de indicadores del panel: `TarjetaKpi` (cifra animada, variación con
 * color según el sentido, sparkline, definición y muestra mínima) más una
 * línea secundaria opcional con el dato que le da contexto.
 */
export function TarjetasKpi({
  etiqueta,
  filas,
  tarjetas,
  nMinimo,
  etiquetaComparacion,
  className,
}: {
  etiqueta: string
  filas: readonly FilaKpi[]
  tarjetas: readonly DefinicionTarjeta[]
  nMinimo: number
  etiquetaComparacion: string
  className?: string
}) {
  const porClave = new Map(filas.map((fila) => [fila.kpi, fila]))
  const conSecundario = tarjetas.some((tarjeta) => tarjeta.secundario)
  return (
    <RejillaKpi
      etiqueta={etiqueta}
      className={cn("md:grid-cols-4 lg:grid-cols-4", className)}
    >
      {tarjetas.map((tarjeta, indice) => {
        const fila = porClave.get(tarjeta.kpi) ?? filaVacia(tarjeta.kpi)
        const props = propsDesdeFila(fila, nMinimo)
        const estilo: CSSProperties = { animationDelay: `${indice * 55}ms` }
        return (
          <div
            key={tarjeta.kpi}
            className={cn(
              MARCO,
              "animate-aparecer-arriba motion-reduce:animate-none"
            )}
            style={estilo}
          >
            <TarjetaKpi
              {...props}
              titulo={tarjeta.titulo ?? props.titulo}
              icono={ICONOS[tarjeta.icono]}
              etiquetaComparacion={etiquetaComparacion}
              className="flex-1 animate-none rounded-none border-0 bg-transparent"
            />
            {tarjeta.secundario ? (
              <Secundario dato={tarjeta.secundario} />
            ) : conSecundario ? (
              // Misma altura en toda la fila aunque esta tarjeta no tenga dato.
              <div aria-hidden className="h-8.5 border-t border-dashed" />
            ) : null}
          </div>
        )
      })}
    </RejillaKpi>
  )
}

function filaVacia(kpi: string): FilaKpi {
  return {
    kpi,
    valor: null,
    valor_anterior: null,
    variacion: null,
    n: null,
    unidad: "conteo",
    serie: null,
  }
}

/** Fallback fiel de `TarjetasKpi` (con o sin línea secundaria). */
export function EsqueletoTarjetasKpi({
  cantidad = 8,
  conSecundario = true,
  className,
}: {
  cantidad?: number
  conSecundario?: boolean
  className?: string
}) {
  return (
    <RejillaKpi
      etiqueta="Cargando indicadores"
      className={cn("md:grid-cols-4 lg:grid-cols-4", className)}
    >
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className={MARCO}>
          <TarjetaKpi
            titulo="Indicador"
            valor={null}
            cargando
            indice={i}
            className="flex-1 rounded-none border-0 bg-transparent"
          />
          {conSecundario ? (
            <div className="flex h-8.5 items-center justify-between border-t border-dashed px-3.5 sm:px-4">
              <Esqueleto className="h-3 w-16" />
              <Esqueleto className="h-3 w-12" />
            </div>
          ) : null}
        </div>
      ))}
    </RejillaKpi>
  )
}
