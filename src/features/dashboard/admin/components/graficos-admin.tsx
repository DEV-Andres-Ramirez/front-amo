"use client"

import type { ElementoValor, EtapaEmbudo } from "@/components/charts/datos"
import { conversionesEmbudo, mayorCaida } from "@/components/charts/datos"
import { GraficoBarrasRanking } from "@/components/charts/grafico-barras-ranking"
import { GraficoCombo } from "@/components/charts/grafico-combo"
import { GraficoDona } from "@/components/charts/grafico-dona"
import { GraficoEmbudo } from "@/components/charts/grafico-embudo"
import { TarjetaGrafico } from "@/components/charts/tarjeta-grafico"
import {
  formatearCOP,
  formatearCOPCompacto,
  formatearPorcentaje,
} from "@/lib/format"

import { type DatosTendenciaGmv, POR_GRANULARIDAD } from "../datos"

/** GMV verificado (columnas) y comisión (línea), en bandas apiladas. */
export function GraficoTendenciaGmv({
  datos,
  className,
}: {
  datos: DatosTendenciaGmv
  className?: string
}) {
  const vacio = datos.totalGmv === 0 && datos.totalComision === 0
  const tomaDeComision =
    datos.totalGmv > 0 ? datos.totalComision / datos.totalGmv : null
  return (
    <TarjetaGrafico
      titulo="GMV verificado y comisión"
      descripcion={`Negocios cumplidos ${POR_GRANULARIDAD[datos.granularidad]}, por fecha de verificación.`}
      alto="min-h-80"
      className={className}
      vacio={
        vacio
          ? {
              titulo: "Aún no hay negocios verificados en el periodo",
              descripcion:
                "Cuando se validen las métricas de las asignaciones verás aquí el GMV y la comisión.",
            }
          : false
      }
      pie={
        vacio ? null : (
          <span className="cifras">
            Total del periodo: {formatearCOP(datos.totalGmv)} de GMV ·{" "}
            {formatearCOP(datos.totalComision)} de comisión
            {tomaDeComision !== null
              ? ` (${formatearPorcentaje(tomaDeComision, 1)})`
              : ""}
          </span>
        )
      }
    >
      <GraficoCombo
        titulo="GMV verificado y comisión"
        etiquetas={datos.etiquetas}
        barras={{
          id: "gmv_verificado",
          nombre: "GMV verificado",
          valores: datos.gmvVerificado,
          formato: "cop",
        }}
        linea={{
          id: "comision",
          nombre: "Comisión",
          valores: datos.comision,
          formato: "cop",
        }}
      />
    </TarjetaGrafico>
  )
}

const UNIDAD_ASIGNACION = { singular: "asignación", plural: "asignaciones" }

/** De las ofertas vistas a los negocios pagados, con la mayor fuga al pie. */
export function GraficoEmbudoPanel({
  etapas,
  vacio,
  className,
}: {
  etapas: readonly EtapaEmbudo[]
  vacio: boolean
  className?: string
}) {
  // Desde las aceptadas: "vistas" es otra cohorte y casi siempre sería la
  // mayor caída, lo que no dice nada nuevo (ya está en la tasa de aceptación).
  const ejecucion = etapas.filter((etapa) => etapa.id !== "vistas")
  const caida = mayorCaida(conversionesEmbudo(ejecucion))
  const indice = caida ? ejecucion.findIndex((e) => e.id === caida.id) : -1
  const previa = indice > 0 ? ejecucion[indice - 1] : null
  return (
    <TarjetaGrafico
      titulo="Embudo de asignaciones"
      descripcion="Asignaciones aceptadas en el periodo según la etapa más avanzada que alcanzaron."
      alto="min-h-96"
      className={className}
      vacio={
        vacio
          ? {
              titulo: "Sin asignaciones aceptadas en el periodo",
              descripcion:
                "El embudo aparece cuando los medios acepten ofertas publicadas.",
            }
          : false
      }
      pie={
        !vacio && caida && previa && caida.deLaAnterior !== null ? (
          <>
            Mayor fuga: de {previa.nombre.toLocaleLowerCase("es-CO")} a{" "}
            {caida.nombre.toLocaleLowerCase("es-CO")} avanza el{" "}
            <span className="cifras font-medium text-foreground">
              {formatearPorcentaje(caida.deLaAnterior, 1)}
            </span>
            .
          </>
        ) : null
      }
    >
      <GraficoEmbudo
        titulo="Embudo de asignaciones"
        etapas={etapas}
        unidad={UNIDAD_ASIGNACION}
      />
    </TarjetaGrafico>
  )
}

export interface CpmPlataforma {
  nombre: string
  cpm: number | null
  /** TikTok cuenta reproducciones, no impresiones. */
  familia: "impresiones" | "reproducciones"
}

/** Participación de cada plataforma en el GMV verificado, con su CPM al pie. */
export function GraficoPlataformas({
  segmentos,
  cpm,
  className,
}: {
  segmentos: readonly ElementoValor[]
  cpm: readonly CpmPlataforma[]
  className?: string
}) {
  const conCpm = cpm.filter((fila) => fila.cpm !== null)
  return (
    <TarjetaGrafico
      titulo="GMV por plataforma"
      descripcion="Participación de cada red en los negocios verificados."
      alto="min-h-64"
      className={className}
      vacio={
        segmentos.length === 0
          ? {
              titulo: "Sin negocios verificados",
              descripcion: "La mezcla aparece con el primer negocio cumplido.",
            }
          : false
      }
      pie={
        conCpm.length ? (
          <span className="cifras">
            CPM efectivo:{" "}
            {conCpm
              .map(
                (fila) =>
                  `${fila.nombre} ${formatearCOPCompacto(fila.cpm)}${fila.familia === "reproducciones" ? " (por mil reproducciones)" : ""}`
              )
              .join(" · ")}
          </span>
        ) : null
      }
    >
      <GraficoDona
        titulo="GMV por plataforma"
        segmentos={segmentos}
        formato="cop"
        etiquetaTotal="GMV verificado"
        nombreCategoria="Plataforma"
        maximo={3}
      />
    </TarjetaGrafico>
  )
}

/** Formatos con más GMV verificado (cada uno con su plataforma). */
export function GraficoFormatos({
  elementos,
  className,
}: {
  elementos: readonly ElementoValor[]
  className?: string
}) {
  return (
    <TarjetaGrafico
      titulo="GMV por formato"
      descripcion="Los formatos que más negocio verificado movieron."
      alto="min-h-64"
      className={className}
      vacio={
        elementos.length === 0
          ? {
              titulo: "Sin formatos con negocios verificados",
              descripcion: "Aparecerán cuando se verifiquen las métricas.",
            }
          : false
      }
    >
      <GraficoBarrasRanking
        titulo="GMV por formato"
        elementos={elementos}
        formato="cop"
        nombreValor="GMV verificado"
        nombreCategoria="Formato"
        limite={6}
        agruparResto
      />
    </TarjetaGrafico>
  )
}
