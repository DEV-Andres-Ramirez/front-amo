/**
 * Transformaciones puras del panel del medio: progreso del tope anual por
 * nivel, cuenta regresiva de las próximas acciones, etiquetas de acciones y
 * estados, y la serie de ganancias. Sin I/O ni React.
 */
import { etiquetasPeriodos } from "../series"

// ── Tope anual del nivel (§7.1.1) ────────────────────────────────────────────

export type EstadoTope = "normal" | "alerta" | "bloqueo" | "sin-tope"

export interface EntradaTope {
  consumido: number
  tope: number | null
  /** Fracción desde la que se avisa "cerca del tope" (0,80). */
  alerta: number
  /** Fracción desde la que no se pueden aceptar ofertas (0,95). */
  bloqueo: number
}

export interface ProgresoTope {
  estado: EstadoTope
  /** Consumido / tope, acotado a [0, 1] para dibujar la barra. */
  fraccion: number
  /** Consumido / tope sin acotar (puede pasar de 1). */
  porcentaje: number | null
  /** Lo que falta para el umbral de bloqueo (0 si ya lo alcanzó). */
  margenHastaBloqueo: number | null
}

export function progresoTope({
  consumido,
  tope,
  alerta,
  bloqueo,
}: EntradaTope): ProgresoTope {
  if (tope === null || !(tope > 0)) {
    return {
      estado: "sin-tope",
      fraccion: 0,
      porcentaje: null,
      margenHastaBloqueo: null,
    }
  }
  const porcentaje = consumido / tope
  const estado: EstadoTope =
    porcentaje >= bloqueo ? "bloqueo" : porcentaje >= alerta ? "alerta" : "normal"
  return {
    estado,
    fraccion: Math.min(1, Math.max(0, porcentaje)),
    porcentaje,
    margenHastaBloqueo: Math.max(0, tope * bloqueo - consumido),
  }
}

// ── Próximas acciones ────────────────────────────────────────────────────────

/** Fila de `proximas_acciones_medio`. */
export interface AccionPendiente {
  asignacionId: string
  ofertaTitulo: string
  accion: string
  venceAt: string | null
}

const ACCIONES: Readonly<Record<string, string>> = {
  DESCARGAR: "Descargar el contenido",
  PUBLICAR: "Publicar la pauta",
  CORREGIR_EVIDENCIA: "Corregir la evidencia",
  CARGAR_METRICA_H24: "Cargar métricas de 24 h",
  CARGAR_METRICA_H72: "Cargar métricas de 72 h",
  CARGAR_METRICA_D7: "Cargar métricas de 7 días",
  CORREGIR_METRICAS: "Corregir las métricas",
}

export function etiquetaAccion(accion: string): string {
  return (
    ACCIONES[accion] ??
    accion.charAt(0) + accion.slice(1).toLowerCase().replace(/_/g, " ")
  )
}

export type Urgencia = "vencida" | "critica" | "pronto" | "holgada"

export interface CuentaRegresiva {
  urgencia: Urgencia
  /** "Vence en 2 h 15 min", "Venció hace 3 h", "Vence en 4 días". */
  texto: string
  /** Para lectores de pantalla y `title`. */
  minutosRestantes: number | null
}

const MINUTO = 60_000
const HORAS_CRITICA = 6
const HORAS_PRONTO = 24

function duracion(minutos: number): string {
  const total = Math.max(0, Math.round(minutos))
  const dias = Math.floor(total / (60 * 24))
  const horas = Math.floor((total % (60 * 24)) / 60)
  const mins = total % 60
  if (dias >= 2) return `${dias} días`
  if (dias === 1) return horas > 0 ? `1 día ${horas} h` : "1 día"
  if (horas > 0) return mins > 0 ? `${horas} h ${mins} min` : `${horas} h`
  return `${Math.max(1, mins)} min`
}

/** Cuenta regresiva hasta `venceAt`, con la urgencia que colorea la acción. */
export function cuentaRegresiva(
  venceAt: string | null,
  ahora: Date
): CuentaRegresiva {
  const limite = venceAt ? new Date(venceAt).getTime() : Number.NaN
  if (!Number.isFinite(limite)) {
    return {
      urgencia: "holgada",
      texto: "Sin fecha límite",
      minutosRestantes: null,
    }
  }
  const minutos = (limite - ahora.getTime()) / MINUTO
  if (minutos <= 0) {
    return {
      urgencia: "vencida",
      texto: `Venció hace ${duracion(-minutos)}`,
      minutosRestantes: Math.round(minutos),
    }
  }
  const horas = minutos / 60
  return {
    urgencia:
      horas < HORAS_CRITICA
        ? "critica"
        : horas < HORAS_PRONTO
          ? "pronto"
          : "holgada",
    texto: `Vence en ${duracion(minutos)}`,
    minutosRestantes: Math.round(minutos),
  }
}

// ── Asignaciones en curso ────────────────────────────────────────────────────

/** Fila de `mis_asignaciones_medio` con lo que muestra el panel. */
export interface AsignacionEnCurso {
  id: string
  estado: string
  plataforma: string
  /** Valor para el medio (antes de retenciones). */
  montoMedio: number | null
  aceptadaAt: string | null
  fechaLimitePublicacion: string | null
}

export const ESTADOS_EN_CURSO = [
  "ACEPTADA",
  "CONTENIDO_ENTREGADO",
  "PUBLICADA",
  "EVIDENCIA_VALIDADA",
  "METRICAS_CARGADAS",
] as const

export type EstadoEnCurso = (typeof ESTADOS_EN_CURSO)[number]

const ESTADOS: Readonly<Record<EstadoEnCurso, string>> = {
  ACEPTADA: "Por descargar",
  CONTENIDO_ENTREGADO: "Por publicar",
  PUBLICADA: "Evidencia en revisión",
  EVIDENCIA_VALIDADA: "Por cargar métricas",
  METRICAS_CARGADAS: "Métricas en revisión",
}

export function etiquetaEstado(estado: string): string {
  return (ESTADOS as Readonly<Record<string, string>>)[estado] ?? estado
}

/** Paso del recorrido (1–5) para la barra de avance de cada asignación. */
export function pasoEstado(estado: string): number {
  return (ESTADOS_EN_CURSO as readonly string[]).indexOf(estado) + 1
}

// ── Ganancias ────────────────────────────────────────────────────────────────

export interface PuntoGanancias {
  periodo: string
  ganado: number
  pagado: number
  asignaciones: number
}

export interface SerieGanancias {
  etiquetas: string[]
  ganado: number[]
  pagado: number[]
  totalGanado: number
  totalPagado: number
}

export function serieGanancias(
  puntos: readonly PuntoGanancias[],
  granularidad: "semana" | "mes"
): SerieGanancias {
  const ganado = puntos.map((p) => p.ganado)
  const pagado = puntos.map((p) => p.pagado)
  return {
    etiquetas: etiquetasPeriodos(
      puntos.map((p) => p.periodo),
      granularidad
    ),
    ganado,
    pagado,
    totalGanado: ganado.reduce((s, v) => s + v, 0),
    totalPagado: pagado.reduce((s, v) => s + v, 0),
  }
}
