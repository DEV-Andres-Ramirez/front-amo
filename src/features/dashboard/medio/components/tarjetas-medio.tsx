import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  Gauge,
  Handshake,
  Info,
  Star,
} from "lucide-react"
import type { CSSProperties } from "react"

import { Sparkline } from "@/components/charts/sparkline"
import { presentarDelta, type TonoDelta } from "@/components/kpi/delta"
import type { FilaKpi } from "@/components/kpi/tipos"
import { NumeroAnimado } from "@/components/motion/numero-animado"
import { NOMBRES_PLATAFORMA } from "@/features/dashboard/insights/textos"
import type { Plataforma } from "@/features/dashboard/insights/tipos"
import {
  formatearCOP,
  formatearCOPCompacto,
  formatearNumero,
  formatearPorcentaje,
} from "@/lib/format"
import { cn } from "@/lib/utils"

import { TarjetaPanel } from "../../components/tarjeta-panel"
import {
  type AsignacionEnCurso,
  etiquetaEstado,
  ESTADOS_EN_CURSO,
  type ProgresoTope,
  pasoEstado,
} from "../datos"

const TONOS: Readonly<Record<TonoDelta, string>> = {
  positivo: "bg-success/12 text-success",
  negativo: "bg-destructive/12 text-destructive",
  neutro: "bg-muted text-muted-foreground",
}

function FlechaDelta({ tendencia }: { tendencia: string }) {
  if (tendencia === "sube") return <ArrowUpRight aria-hidden className="size-3.5" />
  if (tendencia === "baja") return <ArrowDownRight aria-hidden className="size-3.5" />
  return <ArrowRight aria-hidden className="size-3.5" />
}

function Monto({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string
  valor: number | null
  nota: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border bg-card/70 p-3 backdrop-blur-sm">
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="font-heading text-lg leading-tight font-semibold tracking-tight sm:text-xl">
        {valor === null ? "—" : formatearCOPCompacto(valor)}
        <span className="sr-only"> ({formatearCOP(valor)})</span>
      </dd>
      <dd className="text-[0.6875rem] leading-snug text-muted-foreground">
        {nota}
      </dd>
    </div>
  )
}

/**
 * La cifra que el medio viene a ver: lo ganado en el periodo (cifra héroe,
 * animada), su variación y tendencia, y lo pendiente y lo ya pagado.
 */
export function HeroGanancias({
  titulo,
  ganado,
  pendiente,
  pagado,
  etiquetaComparacion,
  className,
}: {
  titulo: string
  ganado: FilaKpi | undefined
  pendiente: number | null
  pagado: number | null
  etiquetaComparacion: string
  className?: string
}) {
  const valor = ganado?.valor ?? 0
  const delta = presentarDelta({
    valor,
    valorAnterior: ganado?.valor_anterior,
    variacion: ganado?.variacion,
    unidad: "COP",
    sentido: "mayor",
  })
  const serie = ganado?.serie ?? null
  const conSerie = (serie?.filter((v) => v !== null && v > 0).length ?? 0) > 1
  return (
    <section
      aria-labelledby="titulo-ganancias"
      className={cn(
        "relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl border bg-card p-5 sm:p-6",
        className
      )}
    >
      {/* Aurora de marca, tenue: jerarquía de la cifra principal. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-20 -z-10 size-72 rounded-full bg-aurora opacity-25 blur-3xl dark:opacity-30"
      />
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h2
            id="titulo-ganancias"
            className="text-sm font-medium text-muted-foreground"
          >
            {titulo}
          </h2>
          <p
            className="font-heading text-5xl leading-none font-bold tracking-tight sm:text-6xl"
            title={formatearCOP(valor)}
          >
            <NumeroAnimado
              valor={valor}
              formato={valor >= 10_000_000 ? "copCompacto" : "cop"}
            />
            <span className="sr-only"> ({formatearCOP(valor)})</span>
          </p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold cifras",
                TONOS[delta.tono]
              )}
            >
              <FlechaDelta tendencia={delta.tendencia} />
              <span aria-hidden>{delta.texto}</span>
              <span className="sr-only">{delta.descripcion}</span>
            </span>
            {etiquetaComparacion} · antes de retenciones
          </p>
        </div>
        {conSerie && serie ? (
          <Sparkline
            valores={serie}
            ancho={120}
            alto={48}
            tono="exito"
            className="mt-1 hidden w-28 sm:block"
          />
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <Monto
          etiqueta="Pendiente de pago"
          valor={pendiente}
          nota="Estimado: las retenciones se calculan al liquidar"
        />
        <Monto
          etiqueta="Pagado a la fecha"
          valor={pagado}
          nota="Neto recibido, después de retenciones"
        />
      </dl>
    </section>
  )
}

const ESTILOS_TOPE = {
  normal: { relleno: "bg-primary", pista: "bg-primary/15", texto: "text-muted-foreground" },
  alerta: { relleno: "bg-warning", pista: "bg-warning/15", texto: "text-warning" },
  bloqueo: { relleno: "bg-destructive", pista: "bg-destructive/15", texto: "text-destructive" },
  "sin-tope": { relleno: "bg-primary", pista: "bg-primary/15", texto: "text-muted-foreground" },
} as const

function mensajeTope(progreso: ProgresoTope, bloqueo: number): string {
  switch (progreso.estado) {
    case "sin-tope":
      return "Tu nivel de verificación no tiene tope anual."
    case "normal":
      return `Puedes aceptar ofertas por ${formatearCOPCompacto(progreso.margenHastaBloqueo)} más este año antes del umbral del ${formatearPorcentaje(bloqueo, 0)}.`
    case "alerta":
      return `Estás cerca del tope de tu nivel: te quedan ${formatearCOPCompacto(progreso.margenHastaBloqueo)}. Sube de nivel para seguir aceptando sin límite.`
    case "bloqueo":
      return `Alcanzaste el ${formatearPorcentaje(bloqueo, 0)} del tope: no podrás aceptar nuevas ofertas hasta subir de nivel.`
  }
}

/** Avance del tope anual del nivel (§7.1.1), con el umbral de bloqueo marcado. */
export function ProgresoTopeAnual({
  progreso,
  consumido,
  tope,
  nivel,
  alerta,
  bloqueo,
  className,
}: {
  progreso: ProgresoTope
  consumido: number
  tope: number | null
  nivel: string
  alerta: number
  bloqueo: number
  className?: string
}) {
  const estilo = ESTILOS_TOPE[progreso.estado]
  const marca = (fraccion: number): CSSProperties => ({ left: `${fraccion * 100}%` })
  return (
    <TarjetaPanel
      titulo="Tope anual de tu nivel"
      descripcion={nivel}
      icono={Gauge}
      className={className}
    >
      <div className="flex flex-col gap-3">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-heading text-2xl font-semibold tracking-tight">
            {formatearCOPCompacto(consumido)}
            {tope ? (
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                de {formatearCOPCompacto(tope)}
              </span>
            ) : null}
          </span>
          {progreso.porcentaje !== null ? (
            <span className={cn("text-sm font-semibold cifras", estilo.texto)}>
              {formatearPorcentaje(progreso.porcentaje, 0)}
            </span>
          ) : null}
        </p>
        {tope ? (
          <div className="relative pt-1 pb-5">
            <div
              role="meter"
              aria-label="Avance del tope anual"
              aria-valuemin={0}
              aria-valuemax={tope}
              aria-valuenow={Math.min(consumido, tope)}
              aria-valuetext={`${formatearCOP(consumido)} de ${formatearCOP(tope)} (${formatearPorcentaje(progreso.porcentaje, 0)})`}
              className={cn("h-3 overflow-hidden rounded-full", estilo.pista)}
            >
              <div
                className={cn(
                  "h-full origin-left rounded-full transition-[width] duration-700 ease-suave motion-reduce:transition-none",
                  estilo.relleno
                )}
                style={{ width: `${progreso.fraccion * 100}%` }}
              />
            </div>
            {[
              { fraccion: alerta, texto: `${formatearPorcentaje(alerta, 0)}` },
              { fraccion: bloqueo, texto: `Bloqueo ${formatearPorcentaje(bloqueo, 0)}` },
            ].map((umbral) => (
              <span
                key={umbral.texto}
                aria-hidden
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                style={marca(umbral.fraccion)}
              >
                <span className="h-5 w-0.5 rounded-full bg-foreground/50" />
                <span className="mt-0.5 text-[0.625rem] whitespace-nowrap cifras text-muted-foreground">
                  {umbral.texto}
                </span>
              </span>
            ))}
          </div>
        ) : null}
        <p className={cn("flex gap-2 text-xs leading-relaxed", estilo.texto)}>
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {mensajeTope(progreso, bloqueo)}
        </p>
      </div>
    </TarjetaPanel>
  )
}

/** Reputación (§7.1.8): cumplimiento en 180 días, calificación y multiplicador. */
export function Reputacion({
  cumplimiento,
  calificacion,
  multiplicador,
  publicaciones,
  nMinimoCumplimiento,
  className,
}: {
  cumplimiento: FilaKpi | undefined
  calificacion: number | null
  multiplicador: number | null
  publicaciones: number | null
  nMinimoCumplimiento: number
  className?: string
}) {
  const tasa = cumplimiento?.valor ?? null
  const n = cumplimiento?.n ?? 0
  const datos = [
    {
      etiqueta: "Cumplimiento",
      valor: tasa === null ? "—" : formatearPorcentaje(tasa, 0),
      nota:
        tasa === null
          ? `Sin historial suficiente (${formatearNumero(n)} de ${formatearNumero(nMinimoCumplimiento)})`
          : `Últimos 180 días · ${formatearNumero(n)} ${n === 1 ? "negocio" : "negocios"}`,
      destacado: tasa !== null && tasa >= 0.9,
    },
    {
      etiqueta: "Calificación",
      valor: calificacion === null ? "—" : `${formatearNumero(calificacion, 1)} / 5`,
      nota: calificacion === null ? "Aún sin calificaciones" : "Promedio de los anunciantes",
      destacado: false,
    },
    {
      etiqueta: "Multiplicador",
      valor: multiplicador === null ? "—" : `${formatearNumero(multiplicador, 2)} ×`,
      nota: "Ajusta tu tarifa según el desempeño",
      destacado: false,
    },
  ]
  return (
    <TarjetaPanel
      titulo="Tu reputación"
      descripcion="Lo que ven los anunciantes y lo que mueve tu tarifa."
      icono={Award}
      className={className}
      pie={
        publicaciones !== null
          ? `${formatearNumero(publicaciones)} ${publicaciones === 1 ? "publicación aprobada" : "publicaciones aprobadas"} en el periodo.`
          : null
      }
    >
      <dl className="grid grid-cols-3 gap-2.5">
        {datos.map((dato) => (
          <div
            key={dato.etiqueta}
            className="flex min-w-0 flex-col gap-1 rounded-xl border bg-background/40 p-3"
          >
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              {dato.etiqueta === "Calificación" ? (
                <Star aria-hidden className="size-3 fill-current text-warning" />
              ) : null}
              {dato.etiqueta}
            </dt>
            <dd
              className={cn(
                "font-heading text-xl leading-tight font-semibold tracking-tight",
                dato.destacado && "text-success"
              )}
            >
              {dato.valor}
            </dd>
            <dd className="text-[0.6875rem] leading-snug text-muted-foreground">
              {dato.nota}
            </dd>
          </div>
        ))}
      </dl>
    </TarjetaPanel>
  )
}

function esPlataforma(valor: string): valor is Plataforma {
  return valor in NOMBRES_PLATAFORMA
}

/** Negocios en ejecución con su paso (descargar → publicar → métricas). */
export function NegociosEnCurso({
  asignaciones,
  activas,
  className,
}: {
  asignaciones: readonly AsignacionEnCurso[]
  activas: number | null
  className?: string
}) {
  const pasos = ESTADOS_EN_CURSO.length
  return (
    <TarjetaPanel
      titulo="Negocios en curso"
      descripcion="Aceptados y aún sin verificar."
      icono={Handshake}
      className={className}
      acciones={
        activas ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold cifras text-primary">
            {formatearNumero(activas)}
          </span>
        ) : null
      }
    >
      {asignaciones.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-background/40 p-4 text-[0.8125rem] text-muted-foreground">
          No tienes negocios en curso. Las ofertas que aceptes aparecerán aquí
          hasta que se verifiquen sus métricas.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {asignaciones.map((asignacion) => {
            const paso = pasoEstado(asignacion.estado)
            return (
              <li key={asignacion.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="truncate font-medium">
                      {etiquetaEstado(asignacion.estado)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {esPlataforma(asignacion.plataforma)
                        ? NOMBRES_PLATAFORMA[asignacion.plataforma]
                        : asignacion.plataforma}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold cifras">
                    {formatearCOPCompacto(asignacion.montoMedio)}
                  </span>
                </div>
                <div
                  className="flex gap-1"
                  role="img"
                  aria-label={`Paso ${paso} de ${pasos}: ${etiquetaEstado(asignacion.estado)}`}
                >
                  {ESTADOS_EN_CURSO.map((estado, indice) => (
                    <span
                      key={estado}
                      className={cn(
                        "h-1 flex-1 rounded-full",
                        indice < paso ? "bg-primary" : "bg-primary/15"
                      )}
                    />
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </TarjetaPanel>
  )
}
