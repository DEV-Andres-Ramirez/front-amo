"use client"

import {
  BadgeDollarSign,
  CircleCheckBig,
  FileSpreadsheet,
  FileText,
  Handshake,
  Megaphone,
  Percent,
  RadioTower,
  Users,
} from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import { capturarGrafico } from "@/components/charts/captura"
import { GraficoBarrasApiladas } from "@/components/charts/grafico-barras-apiladas"
import { GraficoBarrasRanking } from "@/components/charts/grafico-barras-ranking"
import { GraficoCombo } from "@/components/charts/grafico-combo"
import { GraficoDona } from "@/components/charts/grafico-dona"
import { GraficoEmbudo } from "@/components/charts/grafico-embudo"
import { GraficoTendencia } from "@/components/charts/grafico-tendencia"
import { MapaCalorActividad } from "@/components/charts/mapa-calor-actividad"
import { TarjetaGrafico } from "@/components/charts/tarjeta-grafico"
import { propsDesdeFila } from "@/components/kpi/desde-fila"
import { formatearValorKpi } from "@/components/kpi/formato-kpi"
import { RejillaKpi } from "@/components/kpi/rejilla-kpi"
import { TarjetaKpi } from "@/components/kpi/tarjeta-kpi"
import { Button } from "@/components/ui/button"
import { PanelInsights } from "@/features/dashboard/insights/components/panel-insights"
import type { Insight } from "@/features/dashboard/insights/tipos"
import { exportarExcel } from "@/lib/export/excel"
import { exportarPdf } from "@/lib/export/pdf"
import { formatearCOP, formatearDelta } from "@/lib/format"

import {
  ACTIVIDAD,
  APILADAS,
  DEPARTAMENTOS,
  DIAS,
  EMBUDO,
  GMV_DIARIO,
  GMV_DIARIO_ANTERIOR,
  GMV_MENSUAL,
  KPIS,
  MESES,
  MESES_APILADAS,
  MEZCLA,
  TAKE_RATE,
} from "./datos-sinteticos"

const ICONOS = [
  BadgeDollarSign,
  BadgeDollarSign,
  Percent,
  Handshake,
  CircleCheckBig,
  Users,
  RadioTower,
  Megaphone,
]

function Rompe(): never {
  throw new Error("Falla simulada del gráfico")
}

const FILTROS = [
  { etiqueta: "Periodo", valor: "1–30 de septiembre de 2026" },
  { etiqueta: "Comparado con", valor: "1–31 de agosto de 2026" },
  { etiqueta: "Plataforma", valor: "Todas" },
]

function Exportaciones() {
  const [exportando, iniciar] = useTransition()

  const excel = () =>
    iniciar(async () => {
      await exportarExcel({
        titulo: "Resumen ejecutivo",
        subtitulo: "Tablero administrativo de AMO",
        filtros: FILTROS,
        generadoPor: "Vitrina de gráficos",
        hojas: [
          {
            nombre: "GMV mensual",
            titulo: "GMV verificado y take rate por mes",
            descripcion: "Valores en pesos colombianos.",
            columnas: [
              { titulo: "Mes" },
              { titulo: "GMV verificado", formato: "cop", totalizar: true },
              { titulo: "Take rate", formato: "porcentaje" },
            ],
            filas: MESES.map((mes, i) => [mes, GMV_MENSUAL[i], TAKE_RATE[i]]),
          },
          {
            nombre: "Departamentos",
            columnas: [
              { titulo: "Código" },
              { titulo: "Departamento" },
              { titulo: "GMV", formato: "cop", totalizar: true },
            ],
            filas: DEPARTAMENTOS.map((d) => [d.id, d.nombre, d.valor]),
          },
        ],
      })
      toast.success("Excel descargado")
    })

  const pdf = () =>
    iniciar(async () => {
      const combo = await capturarGrafico(
        <GraficoCombo
          titulo="GMV verificado y take rate"
          etiquetas={MESES}
          barras={{
            id: "gmv",
            nombre: "GMV verificado",
            valores: GMV_MENSUAL,
            formato: "cop",
          }}
          linea={{
            id: "take",
            nombre: "Take rate",
            valores: TAKE_RATE,
            formato: "porcentaje",
          }}
        />,
        { ancho: 900, alto: 360 }
      )
      const dona = await capturarGrafico(
        <GraficoDona titulo="Mezcla" segmentos={MEZCLA} formato="cop" />,
        { ancho: 520, alto: 240 }
      )
      const calor = await capturarGrafico(
        <MapaCalorActividad
          titulo="Actividad"
          celdas={ACTIVIDAD}
          unidad={{ singular: "aceptación", plural: "aceptaciones" }}
        />,
        { ancho: 900, alto: 300 }
      )
      await exportarPdf({
        titulo: "Resumen ejecutivo",
        subtitulo: "Tablero administrativo de AMO",
        filtros: FILTROS,
        generadoPor: "Vitrina de gráficos",
        secciones: [
          {
            tipo: "indicadores",
            titulo: "Indicadores del periodo",
            elementos: KPIS.slice(0, 8).map((fila) => {
              const props = propsDesdeFila(fila, 20)
              return {
                etiqueta: props.titulo,
                valor:
                  fila.valor === null
                    ? "—"
                    : formatearValorKpi(fila.valor, props.unidad ?? "conteo"),
                detalle:
                  fila.variacion === null
                    ? "Muestra insuficiente para comparar"
                    : `${formatearDelta(fila.variacion)} frente al periodo anterior`,
              }
            }),
          },
          {
            tipo: "imagen",
            titulo: "GMV verificado y take rate",
            imagen: combo,
            pie: "Fuente: AMO. Take rate = comisión ÷ GMV verificado.",
          },
          {
            tipo: "imagen",
            titulo: "Mezcla por plataforma y formato",
            imagen: dona,
            anchoRelativo: 0.6,
          },
          {
            tipo: "tabla",
            titulo: "Top departamentos por GMV",
            columnas: [
              { titulo: "Departamento" },
              { titulo: "GMV", alinear: "derecha" },
            ],
            filas: DEPARTAMENTOS.map((d) => [d.nombre, formatearCOP(d.valor)]),
            nota: "GMV comprometido por ubicación del medio.",
          },
          { tipo: "imagen", titulo: "Actividad por día y hora", imagen: calor },
        ],
      })
      toast.success("PDF descargado")
    })

  return (
    <>
      <Button variant="outline" onClick={excel} disabled={exportando}>
        <FileSpreadsheet data-icon="inline-start" aria-hidden />
        Excel
      </Button>
      <Button variant="outline" onClick={pdf} disabled={exportando}>
        <FileText data-icon="inline-start" aria-hidden />
        PDF
      </Button>
    </>
  )
}

export { Exportaciones }

export function Vitrina({ insights }: { insights: readonly Insight[] }) {
  return (
    <>
      <RejillaKpi etiqueta="Indicadores del periodo">
        {KPIS.map((fila, i) => (
          <TarjetaKpi
            key={fila.kpi}
            {...propsDesdeFila(fila, 20)}
            icono={ICONOS[i]}
            indice={i}
            href="/inicio"
          />
        ))}
      </RejillaKpi>

      <div className="grid gap-4 lg:grid-cols-3">
        <TarjetaGrafico
          titulo="GMV verificado y take rate"
          descripcion="Últimos 12 meses · el take rate debe rondar la comisión global (20 %)"
          className="lg:col-span-2"
          alto="min-h-80"
        >
          <div data-vitrina="combo" className="size-full">
            <GraficoCombo
              titulo="GMV verificado y take rate"
              etiquetas={MESES}
              barras={{
                id: "gmv",
                nombre: "GMV verificado",
                valores: GMV_MENSUAL,
                formato: "cop",
              }}
              linea={{
                id: "take",
                nombre: "Take rate",
                valores: TAKE_RATE,
                formato: "porcentaje",
              }}
            />
          </div>
        </TarjetaGrafico>
        <PanelInsights insights={insights} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TarjetaGrafico
          titulo="GMV verificado diario"
          alto="h-72"
          descripcion="Septiembre frente a agosto (discontinua)"
        >
          <GraficoTendencia
            titulo="GMV verificado diario"
            etiquetas={DIAS}
            series={[{ id: "gmv", nombre: "Septiembre", valores: GMV_DIARIO }]}
            anterior={{ nombre: "Agosto", valores: GMV_DIARIO_ANTERIOR }}
            formato="cop"
          />
        </TarjetaGrafico>
        <TarjetaGrafico
          titulo="Mezcla por plataforma y formato"
          descripcion="Participación en el GMV comprometido"
        >
          <GraficoDona
            titulo="Mezcla por plataforma y formato"
            segmentos={MEZCLA}
            formato="cop"
            etiquetaTotal="GMV total"
          />
        </TarjetaGrafico>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TarjetaGrafico
          titulo="Embudo de asignaciones"
          descripcion="Cohorte aceptada en septiembre"
          alto="min-h-96"
        >
          <GraficoEmbudo
            titulo="Embudo de asignaciones"
            etapas={EMBUDO}
            unidad={{ singular: "asignación", plural: "asignaciones" }}
          />
        </TarjetaGrafico>
        <TarjetaGrafico
          titulo="Top departamentos"
          descripcion="GMV comprometido por ubicación del medio"
          alto="min-h-96"
        >
          <GraficoBarrasRanking
            titulo="Top departamentos"
            elementos={DEPARTAMENTOS}
            formato="cop"
            nombreValor="GMV"
            nombreCategoria="Departamento"
            limite={8}
            agruparResto
          />
        </TarjetaGrafico>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TarjetaGrafico
          titulo="Asignaciones por plataforma"
          descripcion="Aceptadas por mes"
        >
          <GraficoBarrasApiladas
            titulo="Asignaciones por plataforma"
            categorias={MESES_APILADAS}
            series={APILADAS}
            formato="numero"
            nombreCategoria="Mes"
          />
        </TarjetaGrafico>
        <TarjetaGrafico
          titulo="Actividad por día y hora"
          descripcion="Aceptaciones en hora de Bogotá"
        >
          <MapaCalorActividad
            titulo="Actividad por día y hora"
            celdas={ACTIVIDAD}
            unidad={{ singular: "aceptación", plural: "aceptaciones" }}
          />
        </TarjetaGrafico>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TarjetaGrafico
          titulo="Cargando"
          descripcion="Primera carga"
          cargando
          alto="min-h-56"
        >
          <span />
        </TarjetaGrafico>
        <TarjetaGrafico
          titulo="Sin datos"
          descripcion="Periodo sin movimientos"
          alto="min-h-56"
          vacio={{
            titulo: "Sin asignaciones en el periodo",
            descripcion: "Prueba con un rango de fechas más amplio.",
          }}
        >
          <span />
        </TarjetaGrafico>
        <TarjetaGrafico
          titulo="Con error"
          descripcion="Falla aislada"
          alto="min-h-56"
        >
          <Rompe />
        </TarjetaGrafico>
      </div>
    </>
  )
}
