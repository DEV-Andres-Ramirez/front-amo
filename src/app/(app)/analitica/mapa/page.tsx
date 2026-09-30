import type { Metadata } from "next"
import { Suspense } from "react"
import { preconnect, preload } from "react-dom"

import { TransicionPagina } from "@/components/motion/transicion-vista"
import { EsqueletoExplorador } from "@/features/geo/components/esqueleto-explorador"
import { ExploradorGeo } from "@/features/geo/components/explorador-geo"
import { LimiteErrorMapa } from "@/features/geo/components/limite-error-mapa"
import { urlGeometria } from "@/features/geo/encuadre"
import { cargarEstadoMapa } from "@/features/geo/estado-url"
import { METRICAS_GEO, metricaPermitida } from "@/features/geo/metricas"
import { normalizarEstadoNivel } from "@/features/geo/niveles"
import { requerirPermiso, tieneAlgunPermiso } from "@/lib/auth/dal"
import { envCliente } from "@/lib/env"

export const metadata: Metadata = {
  title: "Explorador geográfico",
  description:
    "Medios, pauta, alcance y accesos por país, departamento y municipio.",
}

/**
 * Explorador geográfico (Mapbox). La página autoriza con el DAL y decide qué
 * métricas ofrece según los permisos; los datos llegan desde el cliente por
 * `GET /api/geo/metricas` (que vuelve a autorizar). El mapa es un widget
 * aislado: su límite de error no tumba el AppShell.
 */
export default async function PaginaMapa({
  searchParams,
}: PageProps<"/analitica/mapa">) {
  const usuario = await requerirPermiso("analitica.mapa")
  const metricasPermitidas = METRICAS_GEO.filter((metrica) =>
    metricaPermitida(metrica, (permiso) =>
      tieneAlgunPermiso(usuario, [permiso])
    )
  )

  // Adelanta la conexión con Mapbox y los polígonos del nivel que se abrirá.
  const { nivel, depto } = await cargarEstadoMapa(searchParams)
  preconnect("https://api.mapbox.com", { crossOrigin: "anonymous" })
  preload(urlGeometria(normalizarEstadoNivel(nivel, depto)), {
    as: "fetch",
    crossOrigin: "anonymous",
  })

  return (
    <TransicionPagina>
      <LimiteErrorMapa>
        <Suspense fallback={<EsqueletoExplorador />}>
          <ExploradorGeo
            token={envCliente.NEXT_PUBLIC_MAPBOX_TOKEN}
            estilo={envCliente.NEXT_PUBLIC_MAPBOX_STYLE}
            metricasPermitidas={metricasPermitidas}
          />
        </Suspense>
      </LimiteErrorMapa>
    </TransicionPagina>
  )
}
