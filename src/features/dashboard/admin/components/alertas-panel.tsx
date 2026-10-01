import {
  ChartNoAxesColumn,
  CircleCheck,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react"
import type { Route } from "next"

import { Bandera, InsigniaSospecha } from "@/features/accesos/components/distintivos"
import type { AccesoFila } from "@/features/accesos/tipos"
import type { MetricasAtipicas } from "@/features/dashboard/insights/tipos"
import { formatearNumero, formatearRelativo } from "@/lib/format"
import { cn } from "@/lib/utils"

import { TarjetaPanel } from "../../components/tarjeta-panel"

export interface AlertaAccesos {
  total: number
  recientes: readonly AccesoFila[]
  href: Route
}

function Encabezado({
  icono: Icono,
  titulo,
  cantidad,
  tono,
}: {
  icono: typeof ShieldAlert
  titulo: string
  cantidad: number
  tono: "aviso" | "peligro"
}) {
  return (
    <p className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          tono === "peligro"
            ? "bg-destructive/12 text-destructive"
            : "bg-warning/10 text-warning"
        )}
      >
        <Icono className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[0.8125rem] font-semibold">{titulo}</span>
      </span>
      <span className="text-lg leading-none font-semibold cifras">
        {formatearNumero(cantidad)}
      </span>
    </p>
  )
}

/**
 * Alertas que piden acción: accesos sospechosos del periodo (`accesos.ver`)
 * y métricas con alertas de integridad esperando validación
 * (`asignaciones.ver`). Sin alertas, lo dice en positivo.
 */
export function AlertasPanel({
  accesos,
  atipicas,
  ahora,
  className,
}: {
  accesos: AlertaAccesos | null
  atipicas: MetricasAtipicas | null
  ahora: Date
  className?: string
}) {
  const hayAccesos = (accesos?.total ?? 0) > 0
  const hayAtipicas = (atipicas?.total ?? 0) > 0
  return (
    <TarjetaPanel
      titulo="Alertas"
      descripcion="Seguridad e integridad de los datos."
      icono={TriangleAlert}
      className={className}
      enlace={
        hayAccesos && accesos
          ? { href: accesos.href, texto: "Revisar los accesos" }
          : undefined
      }
    >
      {!hayAccesos && !hayAtipicas ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed bg-background/40 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success/12 text-success">
            <CircleCheck aria-hidden className="size-4.5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold">Sin alertas</p>
            <p className="text-[0.8125rem] text-muted-foreground">
              {accesos
                ? "Ningún acceso sospechoso ni métrica atípica pendiente."
                : "Ninguna métrica atípica pendiente de validar."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {hayAccesos && accesos ? (
            <section className="flex flex-col gap-2.5" aria-label="Accesos sospechosos">
              <Encabezado
                icono={ShieldAlert}
                titulo="Accesos sospechosos en el periodo"
                cantidad={accesos.total}
                tono="peligro"
              />
              <ul className="flex flex-col divide-y rounded-lg border">
                {accesos.recientes.map((acceso) => (
                  <li
                    key={acceso.id}
                    className="flex items-center gap-2.5 px-3 py-2 text-[0.8125rem]"
                  >
                    <Bandera bandera={acceso.bandera} iso2={acceso.paisIso2} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        {acceso.usuario?.nombre ?? "Correo sin cuenta en AMO"}
                      </span>
                      <span className="truncate text-[0.6875rem] text-muted-foreground">
                        {[acceso.ciudad, acceso.pais].filter(Boolean).join(", ") ||
                          "Ubicación desconocida"}{" "}
                        · {formatearRelativo(acceso.at, ahora)}
                      </span>
                    </span>
                    <InsigniaSospecha motivo={acceso.motivoSospecha} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {hayAtipicas && atipicas ? (
            <section className="flex flex-col gap-1.5" aria-label="Métricas atípicas">
              <Encabezado
                icono={ChartNoAxesColumn}
                titulo="Métricas atípicas por validar"
                cantidad={atipicas.total}
                tono="aviso"
              />
              <p className="pl-10.5 text-xs text-muted-foreground">
                {[
                  atipicas.desviacion > 0
                    ? `${formatearNumero(atipicas.desviacion)} se desvían del histórico`
                    : null,
                  atipicas.multiplo > 0
                    ? `${formatearNumero(atipicas.multiplo)} superan el alcance esperado`
                    : null,
                  atipicas.masAntiguaAt
                    ? `la más antigua llegó ${formatearRelativo(atipicas.masAntiguaAt, ahora)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </section>
          ) : null}
        </div>
      )}
    </TarjetaPanel>
  )
}

/** Enlace del registro de accesos filtrado a los sospechosos del periodo. */
export function hrefAccesosSospechosos(periodo: {
  desde: string
  hasta: string
}): Route {
  const busqueda = new URLSearchParams({
    sospechoso: "SI",
    periodo: "personalizado",
    desde: periodo.desde,
    hasta: periodo.hasta,
  })
  return `/administracion/accesos?${busqueda}` as Route
}
