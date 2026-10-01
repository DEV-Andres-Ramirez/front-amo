/**
 * Arma el libro de Excel y el informe PDF de un reporte a partir de su
 * contenido (módulo puro: las imágenes de los gráficos llegan ya capturadas).
 * Ambos documentos llevan la portada o el encabezado de marca de
 * `@/lib/export`, los filtros aplicados y el sello de generación de Bogotá.
 */
import type { HojaExcel, LibroExcel } from "@/lib/export/excel"
import type { ImagenPng } from "@/lib/export/logo"
import type { DocumentoPdf, SeccionPdf } from "@/lib/export/pdf"
import { formatearNumero } from "@/lib/format"

import type { ReporteCatalogo } from "../catalogo"
import {
  detalleIndicador,
  textoAnteriorIndicador,
  textoValorIndicador,
  textoVariacionIndicador,
} from "../indicadores"
import type { ContenidoReporte, ContextoDatos } from "../tipos"

/** Filas máximas de la tabla del PDF: el detalle completo va en el Excel. */
export const MAXIMO_FILAS_PDF = 300

export interface EncabezadoDocumento {
  reporte: Pick<ReporteCatalogo, "titulo" | "proposito" | "orientacionPdf">
  contexto: ContextoDatos
  generadoPor: string
  fecha: Date
}

function hojaIndicadores(
  contenido: ContenidoReporte,
  contexto: ContextoDatos
): HojaExcel {
  return {
    nombre: "Indicadores",
    titulo: "Indicadores del reporte",
    descripcion: contexto.comparacion
      ? `Variación ${contexto.comparacion}.`
      : undefined,
    columnas: [
      { titulo: "Indicador" },
      { titulo: "Valor" },
      { titulo: "Anterior" },
      { titulo: "Variación" },
      { titulo: "Muestra (n)", formato: "numero" },
      { titulo: "Qué mide", ancho: 70 },
    ],
    filas: contenido.vista.indicadores.map((ind) => [
      ind.titulo,
      textoValorIndicador(ind),
      textoAnteriorIndicador(ind),
      textoVariacionIndicador(ind),
      ind.n,
      ind.definicion?.definicion ?? null,
    ]),
  }
}

function hojaDefiniciones(contenido: ContenidoReporte): HojaExcel {
  return {
    nombre: "Cómo leer",
    titulo: "Cómo leer este reporte",
    columnas: [
      { titulo: "Término", ancho: 32 },
      { titulo: "Explicación", ancho: 110 },
    ],
    filas: contenido.notas.map((nota) => [nota.termino, nota.explicacion]),
  }
}

export function construirLibro(
  contenido: ContenidoReporte,
  encabezado: EncabezadoDocumento
): LibroExcel {
  const { tabla } = contenido
  return {
    titulo: encabezado.reporte.titulo,
    subtitulo: encabezado.reporte.proposito,
    filtros: encabezado.contexto.filtros,
    generadoPor: encabezado.generadoPor,
    fecha: encabezado.fecha,
    hojas: [
      hojaIndicadores(contenido, encabezado.contexto),
      {
        nombre: "Detalle",
        titulo: tabla.titulo,
        descripcion: tabla.descripcion,
        columnas: tabla.columnas,
        filas: tabla.filas,
      },
      ...contenido.hojas,
      hojaDefiniciones(contenido),
    ],
  }
}

/** Imagen ya capturada de un gráfico de la vista (por id). */
export interface ImagenGrafico {
  id: string
  imagen: ImagenPng
}

function seccionesGraficos(
  contenido: ContenidoReporte,
  imagenes: readonly ImagenGrafico[]
): SeccionPdf[] {
  const porId = new Map(imagenes.map((i) => [i.id, i.imagen]))
  return contenido.vista.graficos.flatMap((grafico): SeccionPdf[] => {
    const imagen = porId.get(grafico.id)
    if (imagen) {
      return [
        {
          tipo: "imagen",
          imagen,
          pie: grafico.pie,
          // Las donas y el mapa son casi cuadrados: no ocupan todo el ancho.
          anchoRelativo: grafico.tipo === "mapa" ? 0.55 : undefined,
          altoRelativo: grafico.tipo === "mapa" ? 0.7 : 0.45,
        },
      ]
    }
    if (grafico.vacio) {
      return [
        {
          tipo: "texto",
          titulo: grafico.titulo,
          parrafos: [
            [grafico.vacio.titulo, grafico.vacio.descripcion]
              .filter(Boolean)
              .join(". "),
          ],
        },
      ]
    }
    return []
  })
}

function seccionTabla(contenido: ContenidoReporte): SeccionPdf {
  const { tabla } = contenido
  const filas = tabla.filasPdf.slice(0, MAXIMO_FILAS_PDF)
  const recortada = tabla.filasPdf.length > filas.length
  return {
    tipo: "tabla",
    titulo: tabla.titulo,
    columnas: tabla.columnasPdf,
    filas,
    nota:
      tabla.filasPdf.length === 0
        ? "Sin filas para los filtros elegidos."
        : recortada
          ? `Se muestran ${formatearNumero(filas.length)} de ${formatearNumero(tabla.filasPdf.length)} filas; el Excel trae el detalle completo y todas las columnas.`
          : undefined,
  }
}

export function construirDocumentoPdf(
  contenido: ContenidoReporte,
  encabezado: EncabezadoDocumento,
  imagenes: readonly ImagenGrafico[]
): DocumentoPdf {
  const { vista } = contenido
  const conComparativo = encabezado.contexto.comparacion !== null
  const secciones: SeccionPdf[] = []

  if (vista.indicadores.length > 0) {
    secciones.push({
      tipo: "indicadores",
      titulo: conComparativo
        ? `Indicadores (${encabezado.contexto.comparacion})`
        : "Indicadores",
      elementos: vista.indicadores.map((ind) => ({
        etiqueta: ind.titulo,
        valor: textoValorIndicador(ind),
        detalle: detalleIndicador(ind, conComparativo),
      })),
    })
  }
  if (vista.hallazgos.length > 0) {
    secciones.push({
      tipo: "texto",
      titulo: "Hallazgos del periodo",
      parrafos: vista.hallazgos.map((h) => `• ${h.titulo} ${h.detalle}`),
    })
  }
  if (vista.avisos.length > 0) {
    secciones.push({ tipo: "texto", titulo: "Ten en cuenta", parrafos: vista.avisos })
  }
  secciones.push(...seccionesGraficos(contenido, imagenes), seccionTabla(contenido))
  secciones.push({
    tipo: "texto",
    titulo: "Cómo leer este reporte",
    parrafos: contenido.notas.map((nota) => `${nota.termino}: ${nota.explicacion}`),
  })

  return {
    titulo: encabezado.reporte.titulo,
    subtitulo: encabezado.reporte.proposito,
    filtros: encabezado.contexto.filtros,
    orientacion: encabezado.reporte.orientacionPdf,
    generadoPor: encabezado.generadoPor,
    fecha: encabezado.fecha,
    secciones,
  }
}
