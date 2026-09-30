import { SlidersHorizontal } from "lucide-react"
import type { Metadata } from "next"

import { EstadoVacio } from "@/components/feedback/estado-vacio"
import { ContenedorPagina } from "@/components/layout/contenedor-pagina"
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina"
import { requerirPermiso } from "@/lib/auth/dal"

export const metadata: Metadata = { title: "Configuración" }

/** Marcador provisional: la fase de operación y configuración reemplaza esta página. */
export default async function PaginaConfiguracion() {
  await requerirPermiso("configuracion.ver")

  return (
    <ContenedorPagina>
      <EncabezadoPagina
        titulo="Configuración"
        descripcion="Parámetros, tarifas, comisiones y catálogos de la plataforma."
      />
      <EstadoVacio
        icono={SlidersHorizontal}
        titulo="Esta sección está en preparación"
        descripcion="Pronto podrás ajustar aquí los parámetros del negocio."
        className="flex-none py-16"
      />
    </ContenedorPagina>
  )
}
