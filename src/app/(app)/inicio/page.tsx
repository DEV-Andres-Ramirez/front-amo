import { LayoutDashboard } from "lucide-react"
import type { Metadata } from "next"

import { EstadoVacio } from "@/components/feedback/estado-vacio"
import { ContenedorPagina } from "@/components/layout/contenedor-pagina"
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina"
import { requerirPermiso } from "@/lib/auth/dal"

export const metadata: Metadata = { title: "Inicio" }

/** Marcador provisional: la fase de paneles reemplaza esta página. */
export default async function PaginaInicio() {
  const usuario = await requerirPermiso([
    "inicio.admin",
    "inicio.anunciante",
    "inicio.medio",
  ])

  const primerNombre = usuario.nombre.split(" ")[0]

  return (
    <ContenedorPagina>
      <EncabezadoPagina
        titulo={`Hola, ${primerNombre}`}
        descripcion="Este es tu punto de partida en AMO."
      />
      <EstadoVacio
        icono={LayoutDashboard}
        titulo="Tu panel está en preparación"
        descripcion="Pronto verás aquí los indicadores, alertas y actividad reciente de tu operación."
        className="flex-none py-16"
      />
    </ContenedorPagina>
  )
}
