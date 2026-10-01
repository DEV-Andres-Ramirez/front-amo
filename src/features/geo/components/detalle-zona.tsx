"use client"

import { ArrowRight, ChartNoAxesColumn, Info, X } from "lucide-react"

import { EstadoError } from "@/components/feedback/estado-error"
import { Esqueleto } from "@/components/feedback/esqueletos"
import { BarrasSerie } from "@/components/maps/barras-serie"
import {
  type FormatoNumero,
  NumeroAnimado,
} from "@/components/motion/numero-animado"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { FilaRanking } from "../agregacion"
import { departamentoPorCodigo } from "../departamentos"
import {
  etiquetaCubeta,
  formatearParticipacion,
  formatearValorGeo,
  TITULO_SERIE,
  unidadGeo,
} from "../formato"
import { DEFINICIONES_METRICAS, type MetricaGeo } from "../metricas"
import {
  DEPARTAMENTOS_SIN_DESCENSO,
  type EstadoNivel,
  TIPO_ZONA,
} from "../niveles"
import type {
  MotivoSinSerie,
  RespuestaDetalleGeo,
  SerieZona,
  TopZona,
} from "../tipos"
import { ICONOS_METRICA } from "./iconos-metrica"

export interface DatosDetalle {
  readonly codigo: string
  readonly nombre: string
  readonly fila: FilaRanking | null
  readonly totalZonas: number
  readonly estado: EstadoNivel
  readonly metrica: MetricaGeo
  readonly por100k: boolean
  readonly explorable: boolean
  readonly detalle: RespuestaDetalleGeo | undefined
  readonly cargando: boolean
  readonly error: Error | null
}

interface AccionesDetalle {
  onExplorar: () => void
  onCerrar: () => void
  onCambiarMetrica: (metrica: MetricaGeo) => void
  onReintentar: () => void
}

function contextoZona(
  codigo: string,
  estado: EstadoNivel
): string {
  const tipo = TIPO_ZONA[estado.nivel].singular
  if (estado.nivel === "nacional") {
    const departamento = departamentoPorCodigo(codigo)
    return departamento ? `${tipo} · Región ${departamento.region}` : tipo
  }
  if (estado.nivel === "departamental") {
    const departamento = departamentoPorCodigo(estado.departamento)
    return departamento ? `${tipo} · ${departamento.nombreCorto}` : tipo
  }
  return tipo
}

function formatoAnimado(metrica: MetricaGeo): FormatoNumero {
  switch (DEFINICIONES_METRICAS[metrica].unidad) {
    case "cop":
      return "cop"
    case "porcentaje":
      return "porcentaje"
    default:
      return "numero"
  }
}

/** Nota para las zonas que no bajan de nivel aunque sean departamentos. */
function notaSinDescenso(codigo: string, estado: EstadoNivel): string | null {
  if (estado.nivel !== "nacional" || !DEPARTAMENTOS_SIN_DESCENSO.has(codigo)) {
    return null
  }
  return codigo === "11"
    ? "Bogotá es un solo municipio: su detalle ya es el de la ciudad."
    : "El archipiélago se analiza completo (San Andrés y Providencia)."
}

function ValorPrincipal({
  fila,
  metrica,
  por100k,
  totalZonas,
  zonaPlural,
}: {
  fila: FilaRanking | null
  metrica: MetricaGeo
  por100k: boolean
  totalZonas: number
  zonaPlural: string
}) {
  const definicion = DEFINICIONES_METRICAS[metrica]
  const valor = fila?.valor ?? null
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">
        {definicion.titulo}
        {por100k ? " · por 100 mil hab." : ""}
      </p>
      {valor === null ? (
        <p className="text-2xl font-semibold text-muted-foreground">
          {definicion.aditiva || fila?.n === null || fila?.n === undefined
            ? "Sin datos"
            : "Muestra insuficiente"}
        </p>
      ) : (
        <p className="font-heading text-[1.875rem] leading-none font-bold tracking-tight">
          <NumeroAnimado
            valor={valor}
            formato={formatoAnimado(metrica)}
            decimales={por100k || definicion.unidad === "porcentaje" ? 1 : 0}
          />
          {unidadGeo(metrica, por100k) && !por100k ? (
            <span className="ml-1.5 text-sm font-medium text-muted-foreground">
              {unidadGeo(metrica)}
            </span>
          ) : null}
        </p>
      )}
      <p className="cifras text-xs text-muted-foreground">
        {fila?.posicion
          ? `Puesto ${fila.posicion} de ${totalZonas} ${zonaPlural}`
          : `Sin puesto en el ranking`}
        {fila?.participacion !== null && fila?.participacion !== undefined
          ? ` · ${formatearParticipacion(fila.participacion)} del total`
          : ""}
        {!definicion.aditiva && fila?.n ? ` · n = ${fila.n}` : ""}
      </p>
    </div>
  )
}

const SIN_SERIE: Readonly<Record<MotivoSinSerie, string>> = {
  "foto-actual":
    "Es una foto de las audiencias declaradas hoy: no cambia con el periodo.",
  "sin-datos": "Sin movimiento en esta zona durante el periodo.",
  fallo: "No pudimos calcular la evolución. El resto del detalle está al día.",
}

/** Nota de la serie: periodos incompletos y cubetas sin muestra suficiente. */
function notaSerie(serie: SerieZona): string | null {
  const notas: string[] = []
  if (serie.puntos.some((punto) => punto.parcial)) {
    notas.push("Las barras tenues cubren periodos incompletos")
  }
  if (serie.puntos.some((punto) => punto.valor === null)) {
    notas.push("la línea punteada indica muestra insuficiente")
  }
  if (notas.length === 0) return null
  const texto = notas.join("; ")
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`
}

function Serie({
  detalle,
  metrica,
}: {
  detalle: RespuestaDetalleGeo
  metrica: MetricaGeo
}) {
  const { serie, sinSerie } = detalle
  if (!serie) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-foreground/4 px-3 py-2.5 text-xs text-muted-foreground">
        <ChartNoAxesColumn aria-hidden className="mt-px size-3.5 shrink-0" />
        {SIN_SERIE[sinSerie ?? "sin-datos"]}
      </p>
    )
  }
  return (
    <BarrasSerie
      titulo={TITULO_SERIE[serie.granularidad]}
      barras={serie.puntos.map((punto) => ({
        valor: punto.valor,
        parcial: punto.parcial,
        etiqueta: etiquetaCubeta(punto, serie.granularidad),
        texto:
          punto.valor === null
            ? "Muestra insuficiente"
            : formatearValorGeo(punto.valor, metrica, { compacto: true }),
      }))}
      nota={notaSerie(serie)}
    />
  )
}

function Kpis({
  detalle,
  metrica,
  onCambiarMetrica,
}: {
  detalle: RespuestaDetalleGeo
  metrica: MetricaGeo
  onCambiarMetrica: (metrica: MetricaGeo) => void
}) {
  const otras = detalle.kpis.filter((kpi) => kpi.metrica !== metrica)
  if (otras.length === 0) return null
  return (
    <section aria-label="Otras métricas de la zona" className="flex flex-col gap-2">
      <h3 className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        Otras métricas
      </h3>
      <div className="grid grid-cols-2 gap-1.5">
        {otras.map((kpi) => {
          const Icono = ICONOS_METRICA[kpi.metrica]
          return (
            <button
              key={kpi.metrica}
              type="button"
              onClick={() => onCambiarMetrica(kpi.metrica)}
              title={`Ver ${DEFINICIONES_METRICAS[kpi.metrica].titulo} en el mapa`}
              className="flex flex-col gap-1 rounded-xl bg-foreground/4 px-2.5 py-2 text-left transition-colors outline-none hover:bg-primary/10 focus-visible:anillo-foco"
            >
              <span className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                <Icono aria-hidden className="size-3 text-primary" />
                {DEFINICIONES_METRICAS[kpi.metrica].tituloCorto}
              </span>
              <span className="cifras truncate text-sm font-semibold">
                {kpi.valor === null && !DEFINICIONES_METRICAS[kpi.metrica].aditiva && kpi.n
                  ? `n = ${kpi.n}`
                  : formatearValorGeo(kpi.valor, kpi.metrica, { compacto: true })}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Destacados({ top }: { top: TopZona | null }) {
  if (!top || top.filas.length === 0) return null
  const maximo = Math.max(...top.filas.map((f) => f.valor ?? 0), 0)
  return (
    <section aria-label={top.titulo} className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {top.titulo}
        </h3>
        {top.descripcion ? (
          <p className="text-[0.6875rem] text-muted-foreground">{top.descripcion}</p>
        ) : null}
      </div>
      <ol className="flex flex-col gap-2">
        {top.filas.map((fila, indice) => (
          <li key={`${fila.codigo ?? fila.nombre}-${indice}`} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="cifras text-muted-foreground">{indice + 1}.</span>
                <span className="truncate font-medium" title={fila.nombre}>
                  {fila.nombre}
                </span>
              </span>
              <span className="cifras shrink-0 text-muted-foreground">
                {formatearValorGeo(fila.valor, top.metrica, { compacto: true })}
                {fila.detalle ? (
                  <span className="ml-1.5 text-[0.6875rem] text-muted-foreground/80">
                    · {fila.detalle}
                  </span>
                ) : null}
              </span>
            </div>
            <span aria-hidden className="h-1 overflow-hidden rounded-full bg-foreground/6">
              <span
                className="block h-full rounded-full bg-primary/70"
                style={{
                  width: `${fila.valor && fila.valor > 0 && maximo > 0 ? Math.max(4, (fila.valor / maximo) * 100) : 0}%`,
                }}
              />
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function EsqueletoDetalle() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Cargando el detalle de la zona…</span>
      <Esqueleto className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-1.5">
        {Array.from({ length: 4 }, (_, i) => (
          <Esqueleto key={i} className="h-14 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Esqueleto key={i} className="h-3.5 w-full" />
        ))}
      </div>
    </div>
  )
}

/** Encabezado del detalle: tipo de zona, nombre y cierre. */
export function EncabezadoDetalle({
  datos,
  onCerrar,
  tituloId,
}: {
  datos: DatosDetalle
  onCerrar: () => void
  tituloId?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[0.6875rem] font-semibold tracking-[0.06em] text-primary uppercase">
          {contextoZona(datos.codigo, datos.estado)}
        </p>
        <h2
          id={tituloId}
          className="truncate text-lg leading-tight font-bold"
          title={datos.nombre}
        >
          {datos.nombre}
        </h2>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onCerrar}
        aria-label="Cerrar detalle"
        className="-mt-0.5 -mr-1 shrink-0 text-muted-foreground"
      >
        <X aria-hidden />
      </Button>
    </div>
  )
}

/** Cuerpo del detalle (compartido por el panel lateral y la hoja inferior). */
export function CuerpoDetalle({
  datos,
  onCambiarMetrica,
  onReintentar,
}: { datos: DatosDetalle } & Pick<
  AccionesDetalle,
  "onCambiarMetrica" | "onReintentar"
>) {
  const zonaPlural = TIPO_ZONA[datos.estado.nivel].plural
  return (
    <div className="flex flex-col gap-5">
      <ValorPrincipal
        fila={datos.fila}
        metrica={datos.metrica}
        por100k={datos.por100k}
        totalZonas={datos.totalZonas}
        zonaPlural={zonaPlural}
      />
      {datos.error ? (
        <EstadoError
          compacto
          titulo="No pudimos cargar el detalle"
          descripcion={datos.error.message}
          onReintentar={onReintentar}
          className="rounded-xl bg-foreground/4"
        />
      ) : datos.detalle ? (
        <div
          className={cn(
            "flex flex-col gap-5 transition-opacity duration-200",
            datos.cargando && "opacity-60"
          )}
        >
          <Serie detalle={datos.detalle} metrica={datos.metrica} />
          <Kpis
            detalle={datos.detalle}
            metrica={datos.metrica}
            onCambiarMetrica={onCambiarMetrica}
          />
          <Destacados top={datos.detalle.top} />
          <Destacados top={datos.detalle.medios} />
        </div>
      ) : (
        <EsqueletoDetalle />
      )}
    </div>
  )
}

/** Acción principal: bajar de nivel, o la explicación de por qué no. */
export function PieDetalle({
  datos,
  onExplorar,
}: {
  datos: DatosDetalle
  onExplorar: () => void
}) {
  const nota = notaSinDescenso(datos.codigo, datos.estado)
  if (datos.explorable) {
    return (
      <Button onClick={onExplorar} size="lg" className="h-10 w-full rounded-xl text-sm">
        Explorar {datos.nombre}
        <ArrowRight data-icon="inline-end" aria-hidden />
      </Button>
    )
  }
  if (!nota) return null
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <Info aria-hidden className="mt-px size-3.5 shrink-0" />
      {nota}
    </p>
  )
}
