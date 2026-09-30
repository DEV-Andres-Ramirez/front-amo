/**
 * Datos sintéticos y deterministas de la vitrina (revisión visual temporal).
 */
import type { FilaKpi } from "@/components/kpi/tipos"
import { generarInsights } from "@/features/dashboard/insights/motor"
import {
  CONFIG_INSIGHTS_POR_DEFECTO,
  type Insight,
} from "@/features/dashboard/insights/tipos"

function azar(semilla: number) {
  let estado = semilla
  return () => {
    estado = (estado + 0x6d2b79f5) | 0
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const MESES = [
  "oct",
  "nov",
  "dic",
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sept",
]
export const GMV_MENSUAL = [
  142, 151, 168, 139, 147, 163, 171, 185, 178, 192, 204, 231,
].map((m) => m * 1_000_000)
export const TAKE_RATE = [
  0.198, 0.201, 0.197, 0.203, 0.2, 0.196, 0.199, 0.202, 0.195, 0.198, 0.2,
  0.197,
]

const aleatorio = azar(7)
export const DIAS = Array.from({ length: 30 }, (_, i) => `${i + 1} sept`)
export const GMV_DIARIO = DIAS.map((_, i) =>
  Math.round(
    (5.2 + i * 0.09 + Math.sin(i / 2.3) * 1.3 + aleatorio() * 1.4) * 1_000_000
  )
)
export const GMV_DIARIO_ANTERIOR = DIAS.map((_, i) =>
  Math.round(
    (5.0 + Math.sin(i / 2.8 + 1) * 1.1 + aleatorio() * 1.2) * 1_000_000
  )
)

export const MEZCLA = [
  { id: "ig-reel", nombre: "Reels · Instagram", valor: 58_400_000 },
  { id: "ig-historia", nombre: "Historias · Instagram", valor: 31_200_000 },
  { id: "fb-post", nombre: "Publicaciones · Facebook", valor: 46_900_000 },
  { id: "tt-video", nombre: "Videos · TikTok", valor: 39_700_000 },
  { id: "fb-historia", nombre: "Historias · Facebook", valor: 18_300_000 },
  { id: "ig-post", nombre: "Publicaciones · Instagram", valor: 12_100_000 },
  { id: "tt-vivo", nombre: "En vivo · TikTok", valor: 4_300_000 },
]

export const EMBUDO = [
  { id: "vistas", nombre: "Vistas", cantidad: 4820 },
  { id: "aceptadas", nombre: "Aceptadas", cantidad: 1312 },
  { id: "entregado", nombre: "Contenido entregado", cantidad: 1240 },
  { id: "publicadas", nombre: "Publicadas", cantidad: 1178 },
  { id: "evidencia", nombre: "Evidencia validada", cantidad: 1105 },
  { id: "metricas", nombre: "Métricas cargadas", cantidad: 1032 },
  { id: "verificadas", nombre: "Verificadas", cantidad: 968 },
  { id: "pagadas", nombre: "Pagadas", cantidad: 721 },
]

export const DEPARTAMENTOS = [
  { id: "05", nombre: "Antioquia", valor: 48_300_000 },
  { id: "11", nombre: "Bogotá, D. C.", valor: 41_900_000 },
  { id: "76", nombre: "Valle del Cauca", valor: 27_400_000 },
  { id: "08", nombre: "Atlántico", valor: 16_800_000 },
  { id: "68", nombre: "Santander", valor: 14_100_000 },
  { id: "25", nombre: "Cundinamarca", valor: 11_600_000 },
  { id: "13", nombre: "Bolívar", valor: 9_800_000 },
  { id: "52", nombre: "Nariño", valor: 7_200_000 },
  { id: "66", nombre: "Risaralda", valor: 6_400_000 },
  { id: "41", nombre: "Huila", valor: 5_100_000 },
  { id: "23", nombre: "Córdoba", valor: 4_600_000 },
  { id: "73", nombre: "Tolima", valor: 3_900_000 },
]

export const MESES_APILADAS = MESES.slice(-6)
export const APILADAS = [
  {
    id: "FACEBOOK",
    nombre: "Facebook",
    valores: [212, 198, 231, 244, 236, 262],
  },
  {
    id: "INSTAGRAM",
    nombre: "Instagram",
    valores: [284, 301, 322, 318, 347, 389],
  },
  { id: "TIKTOK", nombre: "TikTok", valores: [96, 118, 131, 152, 171, 204] },
]

const ruido = azar(11)
export const ACTIVIDAD = Array.from({ length: 7 }, (_, d) =>
  Array.from({ length: 24 }, (_, hora) => {
    const laboral = d < 5
    const manana = Math.exp(-((hora - 10) ** 2) / 6)
    const noche = Math.exp(-((hora - 19.5) ** 2) / 5)
    const base =
      (laboral ? 1 : 0.55) * (manana * 38 + noche * 44) +
      (hora >= 7 && hora <= 22 ? 3 : 0)
    return {
      diaSemana: d + 1,
      hora,
      cantidad: Math.max(0, Math.round(base * (0.8 + ruido() * 0.4) - 1)),
    }
  })
).flat()

function serie(n: number, inicio: number, paso: number, semilla: number) {
  const r = azar(semilla)
  return Array.from(
    { length: n },
    (_, i) => inicio + paso * i + (r() - 0.5) * paso * 6
  )
}

export const KPIS: FilaKpi[] = [
  {
    kpi: "gmv_verificado",
    valor: 231_480_000,
    valor_anterior: 204_120_000,
    variacion: 0.134,
    n: 968,
    unidad: "COP",
    serie: serie(12, 140, 8, 1),
  },
  {
    kpi: "comision",
    valor: 45_601_560,
    valor_anterior: 40_824_000,
    variacion: 0.117,
    n: 968,
    unidad: "COP",
    serie: serie(12, 28, 1.6, 2),
  },
  {
    kpi: "take_rate",
    valor: 0.197,
    valor_anterior: 0.2,
    variacion: -0.015,
    n: 968,
    unidad: "%",
    serie: TAKE_RATE,
  },
  {
    kpi: "negocios_cerrados",
    valor: 968,
    valor_anterior: 804,
    variacion: 0.204,
    n: 968,
    unidad: "conteo",
    serie: serie(12, 600, 30, 3),
  },
  {
    kpi: "tasa_cumplimiento",
    valor: 0.823,
    valor_anterior: 0.881,
    variacion: -0.066,
    n: 1_105,
    unidad: "%",
    serie: serie(12, 0.9, -0.006, 4),
  },
  {
    kpi: "alcance_total",
    valor: 18_420_000,
    valor_anterior: 15_300_000,
    variacion: 0.204,
    n: 968,
    unidad: "personas",
    serie: serie(12, 11, 0.6, 5),
  },
  {
    kpi: "medios_activos",
    valor: 214,
    valor_anterior: 221,
    variacion: -0.032,
    n: 214,
    unidad: "conteo",
    serie: serie(12, 230, -1.2, 6),
  },
  {
    kpi: "tasa_llenado",
    valor: null,
    valor_anterior: 0.64,
    variacion: null,
    n: 12,
    unidad: "%",
    serie: null,
  },
]

export function insightsDeMuestra(): Insight[] {
  return generarInsights({
    periodo: { desde: "2026-09-01", hasta: "2026-09-30" },
    ahora: new Date("2026-09-30T17:00:00Z"),
    kpis: KPIS,
    desgloses: {
      negocios_cerrados: {
        departamento: [
          { clave: "05", nombre: "Antioquia", valor: 312, valorAnterior: 214 },
          {
            clave: "11",
            nombre: "Bogotá, D. C.",
            valor: 251,
            valorAnterior: 236,
          },
          {
            clave: "76",
            nombre: "Valle del Cauca",
            valor: 188,
            valorAnterior: 170,
          },
        ],
        plataforma: [
          {
            clave: "INSTAGRAM",
            nombre: "Instagram",
            valor: 489,
            valorAnterior: 381,
          },
          {
            clave: "FACEBOOK",
            nombre: "Facebook",
            valor: 301,
            valorAnterior: 290,
          },
          { clave: "TIKTOK", nombre: "TikTok", valor: 178, valorAnterior: 133 },
        ],
      },
    },
    vencidas: {
      total: 23,
      porDepartamento: [
        { clave: "23", nombre: "Córdoba", cantidad: 7 },
        { clave: "13", nombre: "Bolívar", cantidad: 5 },
      ],
      porMedio: [
        { clave: "a", nombre: "La Voz del Sinú", cantidad: 4 },
        { clave: "b", nombre: "Montería al Día", cantidad: 3 },
        { clave: "c", nombre: "Radio Mompox", cantidad: 2 },
      ],
    },
    mediosEnRiesgo: {
      cantidad: 12,
      gmvEnJuego: 18_400_000,
      gmvVerificado90d: 612_000_000,
      top: [
        { id: "1", nombre: "Eco Tunja", gmv90d: 4_100_000 },
        { id: "2", nombre: "Pasto Noticias", gmv90d: 3_200_000 },
        { id: "3", nombre: "Neiva Hoy", gmv90d: 2_900_000 },
      ],
    },
    mezclaPlataformas: [
      {
        plataforma: "INSTAGRAM",
        formatoClave: "reel",
        formatoNombre: "Reels",
        asignaciones: 212,
        gmv: 58_400_000,
        cpmEfectivo: 11_200,
      },
      {
        plataforma: "INSTAGRAM",
        formatoClave: "historia",
        formatoNombre: "Historias",
        asignaciones: 160,
        gmv: 31_200_000,
        cpmEfectivo: 17_900,
      },
      {
        plataforma: "FACEBOOK",
        formatoClave: "post",
        formatoNombre: "Publicaciones",
        asignaciones: 188,
        gmv: 46_900_000,
        cpmEfectivo: 19_400,
      },
    ],
    metricasAtipicas: {
      total: 5,
      desviacion: 3,
      multiplo: 2,
      masAntiguaAt: new Date("2026-09-27T14:00:00Z"),
    },
    accesosSospechosos: [
      {
        usuarioId: "u1",
        esInterno: false,
        paisIso2: "RU",
        motivo: "PAIS_INUSUAL",
      },
      {
        usuarioId: "u2",
        esInterno: false,
        paisIso2: "NG",
        motivo: "PAIS_INUSUAL",
      },
      {
        usuarioId: "u2",
        esInterno: false,
        paisIso2: "NG",
        motivo: "PAIS_INUSUAL",
      },
    ],
    config: CONFIG_INSIGHTS_POR_DEFECTO,
  })
}
