/**
 * Contrato de datos del explorador geográfico, compartido por el Route
 * Handler, los proveedores (Supabase y simulado) y el cliente.
 */
import type { MetricaGeo, NivelGeo } from "./metricas"

export interface ConsultaMapaGeo {
  readonly nivel: NivelGeo
  readonly metrica: MetricaGeo
  /** 'YYYY-MM-DD' inclusivo, hora de Bogotá. */
  readonly desde: string
  readonly hasta: string
  /** Código DANE; obligatorio en el nivel departamental. */
  readonly departamento: string | null
}

export interface ConsultaDetalleGeo extends ConsultaMapaGeo {
  /** ISO2 (internacional), DANE de 2 dígitos (nacional) o DIVIPOLA (departamental). */
  readonly zona: string
  /** Métricas de las tarjetas del detalle (las del nivel que el usuario puede ver). */
  readonly metricasKpi: readonly MetricaGeo[]
}

/** Una fila de `geo_metricas` (docs/modelo-datos.md §5.9) en camelCase. */
export interface FilaMetricaGeo {
  readonly codigo: string
  /** Polígono que la dibuja (municipios sin polígono propio comparten el de otro). */
  readonly codigoGeometria: string
  readonly nombre: string
  /** `null`: sin dato o muestra insuficiente (tasas con n < mínimo). */
  readonly valor: number | null
  readonly n: number | null
  readonly poblacion: number | null
  readonly valorPor100k: number | null
}

/** Punto real para el mapa de calor: [longitud, latitud, peso]. */
export type PuntoGeo = readonly [lon: number, lat: number, peso: number]

/** Zona sin polígono en el GeoJSON (microestados, islas): se dibuja como círculo. */
export interface CentroZona {
  readonly codigo: string
  readonly centro: readonly [lon: number, lat: number]
}

export type OrigenDatosGeo = "base-de-datos" | "simulado"

export interface RespuestaMapaGeo {
  readonly consulta: ConsultaMapaGeo
  readonly filas: readonly FilaMetricaGeo[]
  /** Solo para métricas con coordenadas reales (accesos, medios); `null` si no aplica o no hay. */
  readonly puntos: readonly PuntoGeo[] | null
  /** Zonas con fila pero sin polígono propio (solo países). */
  readonly sinPoligono: readonly CentroZona[]
  readonly origen: OrigenDatosGeo
}

export interface KpiZona {
  readonly metrica: MetricaGeo
  readonly valor: number | null
  readonly n: number | null
}

export interface SerieZona {
  /** Primer día del primer periodo ('YYYY-MM-DD'). */
  readonly inicio: string
  readonly granularidad: "dia" | "semana"
  readonly valores: readonly number[]
}

export interface FilaTopZona {
  readonly codigo: string | null
  readonly nombre: string
  readonly valor: number | null
  /** Contexto corto (municipio de un medio, plataforma…). */
  readonly detalle: string | null
}

export interface TopZona {
  readonly titulo: string
  readonly metrica: MetricaGeo
  readonly filas: readonly FilaTopZona[]
}

export interface RespuestaDetalleGeo {
  readonly consulta: ConsultaDetalleGeo
  readonly kpis: readonly KpiZona[]
  /** Evolución de la métrica en el periodo; `null` si la fuente aún no la ofrece. */
  readonly serie: SerieZona | null
  readonly top: TopZona | null
  readonly origen: OrigenDatosGeo
}

/**
 * Fuente de datos del explorador. Dos implementaciones: Supabase (RPC
 * `geo_metricas`, producción) y simulada (determinista, desarrollo y pruebas).
 */
export interface ProveedorMetricasGeo {
  mapa(consulta: ConsultaMapaGeo): Promise<RespuestaMapaGeo>
  detalle(consulta: ConsultaDetalleGeo): Promise<RespuestaDetalleGeo>
}

export type MotivoErrorGeo =
  | "no-disponible"
  | "no-autorizado"
  | "consulta-invalida"
  | "fallo"

/** Error esperado de un proveedor; el Route Handler lo traduce a un estado HTTP. */
export class ErrorDatosGeo extends Error {
  constructor(
    readonly motivo: MotivoErrorGeo,
    mensaje: string
  ) {
    super(mensaje)
    this.name = "ErrorDatosGeo"
  }
}

/** Cuerpo de error de `GET /api/geo/metricas`. */
export interface ErrorApiGeo {
  readonly error: {
    readonly motivo: MotivoErrorGeo | "sin-sesion"
    readonly mensaje: string
    /** Sugerencia para desarrollo (nunca en producción). */
    readonly pista?: string
  }
}
