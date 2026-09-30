/**
 * Plugins de Chart.js propios, sin estado global: se pasan por gráfico
 * (`plugins={[...]}`) y leen sus colores de `options.plugins.<id>`.
 */
import type { ChartType, Plugin } from "chart.js"

/** Opciones del texto de conversión entre etapas del embudo. */
export interface OpcionesConversiones {
  color?: string
  fuente?: string
  /** Un texto por etapa; el de la primera se ignora. */
  textos?: readonly string[]
}

declare module "chart.js" {
  // La fusión de declaraciones exige el mismo parámetro de tipo que Chart.js.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    /** Línea vertical que sigue al puntero (líneas y columnas). */
    amoCruz?: { color?: string }
    amoConversiones?: OpcionesConversiones
  }
}

/**
 * Cruz vertical: el lector apunta a una fecha, no a una línea de 2 px. Se
 * dibuja bajo las series, en el centro del elemento activo.
 */
export const pluginCruz: Plugin = {
  id: "amoCruz",
  beforeDatasetsDraw(grafico, _argumentos, opciones: { color?: string }) {
    const activo = grafico.getActiveElements()[0]
    if (!activo) return
    const { ctx, chartArea } = grafico
    const x = activo.element.x
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.lineWidth = 1
    ctx.strokeStyle = opciones.color ?? "rgba(128, 128, 128, 0.4)"
    ctx.stroke()
    ctx.restore()
  },
}
