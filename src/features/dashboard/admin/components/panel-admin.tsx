import "server-only"

import { EsqueletoTarjetaGrafico } from "@/components/charts/esqueleto-grafico"
import { EsqueletoPanelInsights } from "@/features/dashboard/insights/components/esqueleto-panel-insights"
import { tieneAlgunPermiso } from "@/lib/auth/dal"
import type { ClavePermiso } from "@/lib/auth/permisos"
import type { UsuarioSesion } from "@/lib/auth/tipos"
import { cn } from "@/lib/utils"

import { BloquePanel } from "../../components/bloque-panel"
import {
  EsqueletoLista,
  EsqueletoMapaRanking,
} from "../../components/esqueletos-panel"
import { EsqueletoTarjetasKpi } from "../../components/tarjetas-kpi"
import type { PeriodoPanel } from "../../periodo"
import type { FuenteActividad } from "../datos"
import {
  BloqueActividad,
  BloqueActividadReciente,
  BloqueAlertas,
  BloqueDepartamentos,
  BloqueEmbudo,
  BloqueFormatos,
  BloqueInsights,
  BloqueKpisAdmin,
  BloquePlataformas,
  BloqueSaludMedios,
  BloqueTendenciaGmv,
} from "./bloques-admin"

const FILA = "grid gap-4 sm:gap-5"

/**
 * Panel general (interno): indicadores → qué cambió y la tendencia →
 * cómo avanza la operación (embudo, mezcla) → dónde y con quién (territorio,
 * salud de medios) → cuándo (actividad) y qué atender (alertas, bitácora).
 * Cada bloque consulta en paralelo y solo aparece si el rol tiene su permiso.
 */
export function PanelAdmin({
  usuario,
  periodo,
  ahora,
}: {
  usuario: UsuarioSesion
  periodo: PeriodoPanel
  ahora: Date
}) {
  const puede = (permiso: ClavePermiso) => tieneAlgunPermiso(usuario, [permiso])
  const conTerritorio = puede("analitica.global")
  const conAlertas = puede("accesos.ver") || puede("asignaciones.ver")
  const conBitacora = puede("auditoria.ver")
  const fuentes: FuenteActividad[] = puede("accesos.ver")
    ? ["asignaciones", "publicaciones", "accesos"]
    : ["asignaciones", "publicaciones"]

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <BloquePanel
        titulo="Indicadores del periodo"
        esqueleto={<EsqueletoTarjetasKpi />}
      >
        <BloqueKpisAdmin periodo={periodo} />
      </BloquePanel>

      <div className={cn(FILA, "lg:grid-cols-3")}>
        <BloquePanel
          titulo="GMV verificado y comisión"
          orden={1}
          className="lg:col-span-2"
          esqueleto={<EsqueletoTarjetaGrafico alto="min-h-80" />}
        >
          <BloqueTendenciaGmv periodo={periodo} />
        </BloquePanel>
        {/* En móvil los hallazgos van antes del gráfico: son la lectura rápida. */}
        <BloquePanel
          titulo="Lo que cambió en el periodo"
          orden={2}
          className="max-lg:-order-1"
          esqueleto={<EsqueletoPanelInsights />}
        >
          <BloqueInsights periodo={periodo} usuario={usuario} ahora={ahora} />
        </BloquePanel>
      </div>

      <div className={cn(FILA, "md:grid-cols-2 lg:grid-cols-3")}>
        <BloquePanel
          titulo="Embudo de asignaciones"
          orden={3}
          className="md:col-span-2 lg:col-span-1"
          esqueleto={<EsqueletoTarjetaGrafico alto="min-h-96" />}
        >
          <BloqueEmbudo periodo={periodo} />
        </BloquePanel>
        <BloquePanel
          titulo="GMV por plataforma"
          orden={4}
          esqueleto={<EsqueletoTarjetaGrafico alto="min-h-64" />}
        >
          <BloquePlataformas periodo={periodo} />
        </BloquePanel>
        <BloquePanel
          titulo="GMV por formato"
          orden={5}
          esqueleto={<EsqueletoTarjetaGrafico alto="min-h-64" />}
        >
          <BloqueFormatos periodo={periodo} />
        </BloquePanel>
      </div>

      <div className={cn(FILA, conTerritorio && "lg:grid-cols-3")}>
        {conTerritorio ? (
          <BloquePanel
            titulo="Top departamentos"
            orden={6}
            className="lg:col-span-2"
            esqueleto={<EsqueletoMapaRanking />}
          >
            <BloqueDepartamentos periodo={periodo} usuario={usuario} />
          </BloquePanel>
        ) : null}
        <BloquePanel
          titulo="Salud de los medios"
          orden={7}
          esqueleto={<EsqueletoLista filas={5} />}
        >
          <BloqueSaludMedios periodo={periodo} ahora={ahora} />
        </BloquePanel>
      </div>

      <div
        className={cn(FILA, (conAlertas || conBitacora) && "lg:grid-cols-3")}
      >
        <BloquePanel
          titulo="Actividad por día y hora"
          orden={8}
          className="lg:col-span-2"
          esqueleto={<EsqueletoTarjetaGrafico alto="min-h-72" />}
        >
          <BloqueActividad periodo={periodo} fuentes={fuentes} />
        </BloquePanel>
        {conAlertas || conBitacora ? (
          <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
            {conAlertas ? (
              <BloquePanel
                titulo="Alertas"
                orden={9}
                className="flex-none"
                esqueleto={<EsqueletoLista filas={3} />}
              >
                <BloqueAlertas
                  periodo={periodo}
                  usuario={usuario}
                  ahora={ahora}
                />
              </BloquePanel>
            ) : null}
            {conBitacora ? (
              <BloquePanel
                titulo="Actividad reciente"
                orden={10}
                className="flex-1"
                esqueleto={<EsqueletoLista filas={6} />}
              >
                <BloqueActividadReciente usuario={usuario} ahora={ahora} />
              </BloquePanel>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
