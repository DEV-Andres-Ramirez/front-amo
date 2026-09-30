import type { Metadata } from "next"

import { ContenedorPagina } from "@/components/layout/contenedor-pagina"
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina"
import { requerirPermiso } from "@/lib/auth/dal"

import { insightsDeMuestra } from "./datos-sinteticos"
import { Exportaciones, Vitrina } from "./vitrina"

export const metadata: Metadata = { title: "Vitrina de gráficos" }

/** Página temporal de revisión visual de la librería de gráficos (se elimina). */
export default async function PaginaVitrina() {
  await requerirPermiso("inicio.admin")
  return (
    <ContenedorPagina>
      <EncabezadoPagina
        antetitulo="Revisión visual"
        titulo="Vitrina de gráficos"
        descripcion="Datos sintéticos para revisar la librería de gráficos, las tarjetas KPI, los insights y las exportaciones."
        acciones={<Exportaciones />}
      />
      <Vitrina insights={insightsDeMuestra()} />
    </ContenedorPagina>
  )
}
