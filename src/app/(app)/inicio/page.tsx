import type { Metadata } from "next"

import { PanelInicio } from "@/features/dashboard/components/panel-inicio"
import { cargarValoresPeriodo } from "@/features/dashboard/periodo"
import { requerirPermiso } from "@/lib/auth/dal"

export const metadata: Metadata = { title: "Inicio" }

/**
 * Inicio: el panel que corresponde al tipo de rol (interno, anunciante o
 * medio), con el periodo en la URL (`?periodo=` o `desde`/`hasta`).
 */
export default async function PaginaInicio({
  searchParams,
}: PageProps<"/inicio">) {
  const usuario = await requerirPermiso([
    "inicio.admin",
    "inicio.anunciante",
    "inicio.medio",
  ])
  const valores = await cargarValoresPeriodo(searchParams)
  return <PanelInicio usuario={usuario} valores={valores} />
}
