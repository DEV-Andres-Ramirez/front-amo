"use client"

import { GraficoCombo } from "@/components/charts/grafico-combo"
import { GraficoDona } from "@/components/charts/grafico-dona"
import { TarjetaGrafico } from "@/components/charts/tarjeta-grafico"
import {
  formatearCompacto,
  formatearCOP,
  formatearCOPCompacto,
  formatearPorcentaje,
} from "@/lib/format"

import { POR_GRANULARIDAD } from "../../admin/datos"
import type { DesempenoPlataforma, SerieDesempeno } from "../datos"

/** Inversión verificada (columnas) y alcance (línea) en bandas apiladas. */
export function GraficoInversion({
  serie,
  className,
}: {
  serie: SerieDesempeno
  className?: string
}) {
  const totalInversion = serie.inversion.reduce((s, v) => s + v, 0)
  const totalAlcance = serie.alcance.reduce((s, v) => s + v, 0)
  const vacio = totalInversion === 0
  return (
    <TarjetaGrafico
      titulo="Inversión y alcance"
      descripcion={`Negocios cumplidos ${POR_GRANULARIDAD[serie.granularidad]}, por fecha de verificación.`}
      alto="min-h-80"
      className={className}
      vacio={
        vacio
          ? {
              titulo: "Aún no hay negocios verificados en el periodo",
              descripcion:
                "Cuando los medios publiquen y se validen sus métricas verás aquí tu inversión y el alcance logrado.",
            }
          : false
      }
      pie={
        vacio ? null : (
          <span className="cifras">
            {formatearCOP(totalInversion)} invertidos ·{" "}
            {formatearCompacto(totalAlcance)} personas alcanzadas (acumulado,
            sin deduplicar)
          </span>
        )
      }
    >
      <GraficoCombo
        titulo="Inversión y alcance"
        etiquetas={serie.etiquetas}
        barras={{
          id: "inversion",
          nombre: "Inversión",
          valores: serie.inversion,
          formato: "cop",
        }}
        linea={{
          id: "alcance",
          nombre: "Alcance",
          valores: serie.alcance,
          formato: "compacto",
        }}
      />
    </TarjetaGrafico>
  )
}

/** Reparto de la inversión por red y eficiencia de cada una (CPM y engagement). */
export function GraficoPlataformasAnunciante({
  plataformas,
  className,
}: {
  plataformas: readonly DesempenoPlataforma[]
  className?: string
}) {
  const conInversion = plataformas.filter((p) => p.gmv > 0)
  return (
    <TarjetaGrafico
      titulo="Inversión por plataforma"
      descripcion="Dónde se ejecutó tu pauta y qué tan eficiente fue cada red."
      alto="min-h-56"
      className={className}
      vacio={
        conInversion.length === 0
          ? {
              titulo: "Sin negocios verificados",
              descripcion: "El reparto aparece con tu primer negocio cumplido.",
            }
          : false
      }
      pie={
        conInversion.length ? (
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Eficiencia por plataforma en el periodo
            </caption>
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="pb-1 font-medium">
                  Red
                </th>
                <th scope="col" className="pb-1 text-right font-medium">
                  CPM
                </th>
                <th scope="col" className="pb-1 text-right font-medium">
                  Engagement
                </th>
              </tr>
            </thead>
            <tbody className="cifras text-foreground">
              {conInversion.map((fila) => (
                <tr key={fila.plataforma} className="border-t border-border/60">
                  <th scope="row" className="py-1 font-medium">
                    {fila.nombre}
                  </th>
                  <td className="py-1 text-right">
                    {formatearCOPCompacto(fila.cpm)}
                  </td>
                  <td className="py-1 text-right">
                    {formatearPorcentaje(fila.engagement, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null
      }
    >
      <GraficoDona
        titulo="Inversión por plataforma"
        segmentos={conInversion.map((fila) => ({
          id: fila.plataforma,
          nombre: fila.nombre,
          valor: fila.gmv,
        }))}
        formato="cop"
        etiquetaTotal="Inversión"
        nombreCategoria="Plataforma"
        maximo={3}
      />
    </TarjetaGrafico>
  )
}
