"use client"

import { useState } from "react"

import {
  type CeldaActividad,
  DIAS_SEMANA,
  franjaHoraria,
} from "@/components/charts/datos"
import { conUnidad, type Unidad } from "@/components/charts/formatos"
import { MapaCalorActividad } from "@/components/charts/mapa-calor-actividad"
import { TarjetaGrafico } from "@/components/charts/tarjeta-grafico"
import { ControlSegmentado } from "@/features/roles/components/control-segmentado"

import { type FuenteActividad, picoActividad, totalCalor } from "../datos"

const FUENTES: Readonly<
  Record<FuenteActividad, { etiqueta: string; unidad: Unidad; vacio: string }>
> = {
  asignaciones: {
    etiqueta: "Aceptaciones",
    unidad: { singular: "aceptación", plural: "aceptaciones" },
    vacio: "Ningún medio aceptó ofertas en el periodo.",
  },
  publicaciones: {
    etiqueta: "Publicaciones",
    unidad: { singular: "publicación", plural: "publicaciones" },
    vacio: "No hubo publicaciones en el periodo.",
  },
  accesos: {
    etiqueta: "Ingresos",
    unidad: { singular: "inicio de sesión", plural: "inicios de sesión" },
    vacio: "No hubo inicios de sesión en el periodo.",
  },
}

/**
 * Actividad por día de la semana y hora de Bogotá. Las fuentes llegan todas
 * desde el servidor (168 celdas cada una): cambiar de fuente es inmediato.
 */
export function MapaCalorPanel({
  fuentes,
  className,
}: {
  fuentes: Partial<Record<FuenteActividad, CeldaActividad[]>>
  className?: string
}) {
  const disponibles = (Object.keys(FUENTES) as FuenteActividad[]).filter(
    (fuente) => fuentes[fuente]
  )
  const [fuente, setFuente] = useState<FuenteActividad>(
    disponibles[0] ?? "asignaciones"
  )
  const celdas = fuentes[fuente] ?? []
  const { unidad, vacio } = FUENTES[fuente]
  const total = totalCalor(celdas)
  const pico = picoActividad(celdas)

  return (
    <TarjetaGrafico
      titulo="Actividad por día y hora"
      descripcion="Cuándo ocurre la actividad (hora de Bogotá), sumada en el periodo."
      alto="min-h-72"
      nombreArchivo={`Actividad por día y hora · ${FUENTES[fuente].etiqueta}`}
      className={className}
      acciones={
        disponibles.length > 1 ? (
          <ControlSegmentado
            etiqueta="Fuente de la actividad"
            opciones={disponibles.map((valor) => ({
              valor,
              etiqueta: FUENTES[valor].etiqueta,
            }))}
            valor={fuente}
            onCambio={setFuente}
            className="w-auto max-sm:hidden"
          />
        ) : null
      }
      vacio={
        total === 0 ? { titulo: "Sin actividad", descripcion: vacio } : false
      }
      pie={
        <div className="flex flex-col gap-2">
          {disponibles.length > 1 ? (
            <ControlSegmentado
              etiqueta="Fuente de la actividad"
              opciones={disponibles.map((valor) => ({
                valor,
                etiqueta: FUENTES[valor].etiqueta,
              }))}
              valor={fuente}
              onCambio={setFuente}
              className="sm:hidden"
            />
          ) : null}
          {pico ? (
            <span className="cifras">
              {conUnidad(total, unidad)} en total · pico el{" "}
              {DIAS_SEMANA[pico.diaSemana - 1].toLocaleLowerCase("es-CO")}{" "}
              de {franjaHoraria(pico.hora)} ({conUnidad(pico.cantidad, unidad)})
            </span>
          ) : null}
        </div>
      }
    >
      <MapaCalorActividad
        key={fuente}
        titulo={`Actividad por día y hora: ${FUENTES[fuente].etiqueta.toLocaleLowerCase("es-CO")}`}
        celdas={celdas}
        unidad={unidad}
      />
    </TarjetaGrafico>
  )
}
