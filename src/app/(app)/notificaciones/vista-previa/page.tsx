// TEMPORAL: vista previa con datos de ejemplo para las capturas de diseño. Se borra al terminar.
import { ContenedorPagina } from "@/components/layout/contenedor-pagina"
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina"
import { BandejaNotificaciones } from "@/features/notificaciones/components/bandeja-notificaciones"
import { BotonMarcarTodas } from "@/features/notificaciones/components/boton-marcar-todas"
import { CampanaNotificacionesEnVivo } from "@/features/notificaciones/components/campana-en-vivo"
import {
  BarraFiltros,
  RielFiltros,
} from "@/features/notificaciones/components/filtros-bandeja"
import { MarcoBandeja } from "@/features/notificaciones/components/marco-bandeja"
import { aNotificacion } from "@/features/notificaciones/presentacion"
import { requerirPermiso } from "@/lib/auth/dal"

const hace = (minutos: number) =>
  new Date(Date.now() - minutos * 60_000).toISOString()

const FILAS = [
  {
    id: 12,
    tipo: "oferta.nueva_elegible",
    titulo: "Nueva oferta disponible para tu medio",
    mensaje:
      "Almacenes Éxito publicó «Temporada escolar Antioquia» con 3 cupos en la franja Prime. La oferta cierra el viernes a las 6:00 p. m.",
    url: "/operacion/campanas",
    prioridad: 1,
    leida: false,
    created_at: hace(6),
  },
  {
    id: 11,
    tipo: "seguridad.pais_inusual",
    titulo: "Ingreso desde un país inusual",
    mensaje:
      "Detectamos un ingreso a la cuenta de ana@medio.co desde Panamá. Revisa el registro de accesos.",
    url: "/administracion/accesos",
    prioridad: 2,
    leida: false,
    created_at: hace(48),
  },
  {
    id: 10,
    tipo: "liquidacion.pagada",
    titulo: "Pagamos tu liquidación de septiembre",
    mensaje:
      "Transferimos $ 4.820.000 a tu cuenta registrada. El soporte ya está disponible.",
    url: null,
    prioridad: 0,
    leida: true,
    created_at: hace(190),
  },
  {
    id: 9,
    tipo: "asignacion.recordatorio_publicacion",
    titulo: "Publica antes de mañana a las 10:00 a. m.",
    mensaje:
      "La asignación «Semana de la salud» vence en 24 horas. Descarga el contenido y carga la evidencia a tiempo.",
    url: "/operacion/asignaciones",
    prioridad: 1,
    leida: false,
    created_at: hace(60 * 20),
  },
  {
    id: 8,
    tipo: "metricas.rechazadas",
    titulo: "Revisa las métricas del corte D7",
    mensaje:
      "Las métricas de «Feria de las flores» no coinciden con la captura. Corrígelas en las próximas 48 horas.",
    url: "/operacion/asignaciones",
    prioridad: 0,
    leida: true,
    created_at: hace(60 * 30),
  },
  {
    id: 7,
    tipo: "multiplicador.cambio_programado",
    titulo: "Tu multiplicador de calidad cambiará",
    mensaje:
      "Desde el 7 de octubre pasará de 1,00 a 1,12 por el buen alcance de tus últimas 20 publicaciones.",
    url: null,
    prioridad: 0,
    leida: true,
    created_at: hace(60 * 24 * 3),
  },
  {
    id: 6,
    tipo: "disputa.resuelta",
    titulo: "Resolvimos la disputa #184",
    mensaje:
      "La disputa sobre la asignación de Postobón se resolvió a tu favor. El pago se incluirá en la próxima liquidación.",
    url: null,
    prioridad: 0,
    leida: true,
    created_at: hace(60 * 24 * 12),
  },
]

export default async function VistaPrevia() {
  await requerirPermiso("notificaciones.ver")
  const inicial = { disponible: true, total: 3 }
  return (
    <ContenedorPagina className="max-w-6xl">
      <MarcoBandeja>
        <EncabezadoPagina
          titulo="Notificaciones"
          descripcion="Avisos de ofertas, asignaciones, pagos y de la seguridad de tu cuenta."
          acciones={
            <>
              <CampanaNotificacionesEnVivo />
              <BotonMarcarTodas inicial={inicial} />
            </>
          }
        />
        <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8">
          <RielFiltros inicial={inicial} />
          <div className="flex min-w-0 flex-col gap-4">
            <BarraFiltros inicial={inicial} className="lg:hidden" />
            <BandejaNotificaciones
              filtros={{ estado: "todas", categoria: null }}
              inicial={{
                disponible: true,
                notificaciones: FILAS.map(aNotificacion),
                siguiente: 5,
              }}
            />
          </div>
        </div>
      </MarcoBandeja>
    </ContenedorPagina>
  )
}
