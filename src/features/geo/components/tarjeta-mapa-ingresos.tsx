"use client"

import { Earth, MapPinned } from "lucide-react"
import { useQueryStates } from "nuqs"
import { type CSSProperties, useId, useTransition } from "react"

import { parseAsPagina } from "@/components/data-table/estado-url"
import { EstadoError } from "@/components/feedback/estado-error"
import { Esqueleto } from "@/components/feedback/esqueletos"
import { leyendaMundo, MapaMundi, type ZonaMundo } from "@/components/maps/mapa-mundi"
import { MiniMapaColombia } from "@/components/maps/mini-mapa-colombia"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  estadoTablaAccesos,
  ID_REGISTRO_ACCESOS,
} from "@/features/accesos/estado-accesos"
import { COLOR_SIN_DATOS } from "@/lib/geo/escalas"
import { formatearNumero, formatearPorcentaje } from "@/lib/format"

import { useGeometriaNivel } from "../consultas-cliente"
import { urlGeometria } from "../encuadre"
import { CODIGO_COLOMBIA } from "../niveles"
import type { IngresosPorUbicacion } from "../tipos"

const parsersRegistro = {
  pais: estadoTablaAccesos.parsers.pais,
  pagina: parseAsPagina,
}

const URL_PAISES = urlGeometria({ nivel: "internacional", departamento: null })

function ingresos(valor: number): string {
  return `${formatearNumero(valor)} ${valor === 1 ? "ingreso" : "ingresos"}`
}

/** Filtra el registro de accesos por país y baja hasta él (como los atajos de alertas). */
function useFiltrarRegistroPorPais() {
  const [, iniciar] = useTransition()
  const [, fijar] = useQueryStates(parsersRegistro, {
    shallow: false,
    scroll: false,
    startTransition: iniciar,
  })
  return (codigo: string) => {
    void fijar({ pais: [codigo], pagina: null })
    document
      .getElementById(ID_REGISTRO_ACCESOS)
      // Sin `behavior`: rige el `scroll-behavior` global (suave salvo movimiento reducido).
      ?.scrollIntoView({ block: "start" })
  }
}

function LeyendaMundo({ zonas }: { zonas: readonly ZonaMundo[] }) {
  const clases = leyendaMundo(zonas)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.6875rem] text-muted-foreground">
      {clases.map((clase, indice) => (
        <span key={indice} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-[3px] bg-(--c-claro) dark:bg-(--c-oscuro)"
            style={{ "--c-claro": clase.colorClaro, "--c-oscuro": clase.colorOscuro } as CSSProperties}
          />
          <span className="cifras">
            {formatearNumero(clase.desde)}
            {clase.hasta === null ? "+" : ""}
          </span>
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-2.5 rounded-[3px] bg-(--c-claro) dark:bg-(--c-oscuro)"
          style={{ "--c-claro": COLOR_SIN_DATOS.claro, "--c-oscuro": COLOR_SIN_DATOS.oscuro } as CSSProperties}
        />
        Sin ingresos
      </span>
    </div>
  )
}

function PanelMundo({ datos }: { datos: IngresosPorUbicacion }) {
  const geometria = useGeometriaNivel(URL_PAISES)
  const filtrar = useFiltrarRegistroPorPais()

  if (geometria.error) {
    return (
      <EstadoError
        compacto
        titulo="No pudimos dibujar el planisferio"
        descripcion={geometria.error.message}
        onReintentar={() => void geometria.refetch()}
        className="rounded-xl bg-foreground/4"
      />
    )
  }
  if (!geometria.data) {
    return <Esqueleto className="aspect-[1000/435] w-full rounded-xl" />
  }
  return (
    <div className="flex flex-col gap-3">
      <MapaMundi
        coleccion={geometria.data.coleccion}
        zonas={datos.paises}
        etiqueta="Ingresos exitosos por país"
        formatear={ingresos}
        onElegir={filtrar}
        describirAccion={(zona) =>
          `${zona.nombre}: ${ingresos(zona.valor)}. Ver sus accesos en el registro`
        }
        className="animate-aparecer-arriba"
      />
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <LeyendaMundo zonas={datos.paises} />
        <p className="text-xs text-muted-foreground">
          Elige un país para ver sus accesos en el registro.
        </p>
      </div>
    </div>
  )
}

function PanelColombia({ datos }: { datos: IngresosPorUbicacion }) {
  const total = Object.values(datos.departamentos).reduce((suma, valor) => suma + valor, 0)
  if (total === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Ningún ingreso del periodo se ubicó en un departamento de Colombia.
      </p>
    )
  }
  return (
    <MiniMapaColombia
      valores={datos.departamentos}
      metrica="accesos"
      etiqueta="Ingresos exitosos por departamento"
      className="mx-auto w-full max-w-[17rem]"
    />
  )
}

function resumen(datos: IngresosPorUbicacion): string {
  const colombia = datos.paises.find((zona) => zona.codigo === CODIGO_COLOMBIA)?.valor ?? 0
  const partes = [
    `${ingresos(datos.total)} ${datos.total === 1 ? "exitoso" : "exitosos"}`,
    `${formatearNumero(datos.paises.length)} ${datos.paises.length === 1 ? "país" : "países"}`,
  ]
  if (datos.total > 0) {
    partes.push(`${formatearPorcentaje(colombia / datos.total, 0)} desde Colombia`)
  }
  return partes.join(" · ")
}

/**
 * Mapa de los ingresos del periodo (página de Accesos): planisferio por país
 * y, en otra pestaña, Colombia por departamento. En SVG (sin Mapbox: la
 * página no paga el peso del explorador). Elegir un país filtra el registro.
 */
export function TarjetaMapaIngresos({ datos }: { datos: IngresosPorUbicacion }) {
  const idTitulo = useId()
  return (
    <section
      aria-labelledby={idTitulo}
      className="flex h-full min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 transition-colors duration-300 hover:border-foreground/15 sm:p-5"
    >
      <Tabs defaultValue="mundo" className="flex flex-1 flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary [&_svg]:size-4">
              <MapPinned aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <h3 id={idTitulo} className="font-heading text-[0.9375rem] leading-snug font-semibold">
                Mapa de ingresos
              </h3>
              <p className="cifras text-[0.8125rem] text-muted-foreground">{resumen(datos)}</p>
            </div>
          </div>
          <TabsList aria-label="Ámbito del mapa">
            <TabsTrigger value="mundo" className="px-2.5">
              <Earth aria-hidden />
              Mundo
            </TabsTrigger>
            <TabsTrigger value="colombia" className="px-2.5">
              Colombia
            </TabsTrigger>
          </TabsList>
        </header>

        <TabsContent value="mundo" className="flex flex-1 flex-col justify-center">
          {datos.paises.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              Ningún ingreso del periodo trae país.
            </p>
          ) : (
            <PanelMundo datos={datos} />
          )}
        </TabsContent>
        <TabsContent value="colombia" className="flex flex-1 flex-col justify-center">
          <PanelColombia datos={datos} />
        </TabsContent>
      </Tabs>

      {datos.estimado ? (
        <p className="text-xs text-muted-foreground">
          Cifras estimadas a partir de una muestra del periodo.
        </p>
      ) : null}
    </section>
  )
}
