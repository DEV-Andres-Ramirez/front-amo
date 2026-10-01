import { History } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"

import { EstadoVacio } from "@/components/feedback/estado-vacio"
import { IconoAccion } from "@/features/auditoria/components/distintivos"
import type { EventoBitacora } from "@/features/auditoria/tipos"
import { formatearFechaHora, formatearRelativo } from "@/lib/format"

import { TarjetaPanel } from "../../components/tarjeta-panel"

/** Últimos cambios de la bitácora: quién hizo qué y cuándo. */
export function ActividadReciente({
  eventos,
  ahora,
  className,
}: {
  eventos: readonly EventoBitacora[]
  ahora: Date
  className?: string
}) {
  return (
    <TarjetaPanel
      titulo="Actividad reciente"
      descripcion="Los últimos cambios registrados en la bitácora."
      icono={History}
      className={className}
      enlace={{
        href: "/administracion/auditoria" as Route,
        texto: "Ver la bitácora",
      }}
    >
      {eventos.length === 0 ? (
        <EstadoVacio
          variante="simple"
          icono={History}
          titulo="Sin actividad reciente"
          descripcion="Los cambios de usuarios, roles y configuración aparecerán aquí."
          className="h-full py-6"
        />
      ) : (
        <ol className="relative flex flex-col gap-3.5 before:absolute before:inset-y-2 before:left-3.5 before:w-px before:bg-border">
          {eventos.map((evento) => {
            const contenido = (
              <>
                <span className="text-[0.8125rem] leading-snug font-medium">
                  {evento.titulo}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {evento.actor.nombre}
                  {evento.resumen ? ` · ${evento.resumen}` : ""}
                </span>
              </>
            )
            return (
              <li key={evento.id} className="relative flex gap-3">
                <IconoAccion
                  accion={evento.accion}
                  tono={evento.tono}
                  tamano="sm"
                  className="relative ring-4 ring-card"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {evento.ruta ? (
                    <Link
                      href={evento.ruta as Route}
                      className="flex min-w-0 flex-col gap-0.5 rounded-sm hover:[&>span:first-child]:text-primary focus-visible:anillo-foco"
                    >
                      {contenido}
                    </Link>
                  ) : (
                    contenido
                  )}
                </div>
                <time
                  dateTime={evento.at}
                  title={formatearFechaHora(evento.at)}
                  className="shrink-0 pt-0.5 text-[0.6875rem] whitespace-nowrap text-muted-foreground"
                >
                  {formatearRelativo(evento.at, ahora)}
                </time>
              </li>
            )
          })}
        </ol>
      )}
    </TarjetaPanel>
  )
}
