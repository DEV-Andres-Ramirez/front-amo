/**
 * Formatos propios de la operación (módulo puro): NIT con y sin máscara,
 * búsqueda normalizada igual que en la BD, seguidores y multiplicadores.
 */
import { formatearCompacto, formatearNumero } from "@/lib/format"

const PUNTO_OCULTO = "•"

/** "900123456" → "900.123.456" (miles con punto, como en el RUT). */
function agruparMiles(digitos: string): string {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

/** NIT completo con dígito de verificación: "900.123.456-7". */
export function formatearNit(
  nit: string | null,
  digitoVerificacion: string | null
): string | null {
  if (!nit) return null
  const base = /^\d+$/.test(nit) ? agruparMiles(nit) : nit
  return digitoVerificacion ? `${base}-${digitoVerificacion}` : base
}

/** Cantidad de caracteres que se dejan visibles al final de un identificador. */
const VISIBLES = 3

/**
 * Identificador enmascarado: solo los últimos 3 caracteres quedan a la vista
 * ("•••.•••.456-•"). Se aplica en el servidor: el valor completo nunca llega al
 * navegador de quien no tiene `datos_sensibles.ver`.
 */
export function enmascararNit(
  nit: string | null,
  digitoVerificacion: string | null
): string | null {
  const completo = formatearNit(nit, null)
  if (!completo) return null
  let porMostrar = VISIBLES
  const caracteres = [...completo]
  for (let i = caracteres.length - 1; i >= 0; i--) {
    if (!/[0-9A-Za-z]/.test(caracteres[i])) continue
    if (porMostrar > 0) porMostrar--
    else caracteres[i] = PUNTO_OCULTO
  }
  const enmascarado = caracteres.join("")
  return digitoVerificacion ? `${enmascarado}-${PUNTO_OCULTO}` : enmascarado
}

/**
 * Misma normalización que `private.normalizar_texto` (minúsculas, sin tildes
 * ni puntuación, espacios colapsados) para buscar en `nombre_normalizado`. El
 * resultado solo tiene letras, números y espacios: no admite comodines.
 */
export function normalizarBusqueda(texto: string): string {
  return texto
    .replace(/¥/g, "ñ")
    .replace(/&/g, " y ")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[.'’‘`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

/** Patrón `ilike` para PostgREST a partir de una búsqueda ya normalizada. */
export function patronContiene(normalizado: string): string | null {
  return normalizado ? `%${normalizado.replace(/\s+/g, "%")}%` : null
}

/**
 * Texto libre para un `ilike` dentro de un `or(...)` de PostgREST: sin comas,
 * paréntesis, comillas, puntos ni comodines, que romperían o ampliarían el
 * filtro. Conserva tildes (la columna no está normalizada).
 */
export function textoParaFiltro(texto: string): string {
  return texto
    .replace(/[,()*%_\\"'.:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** "58,2 mil seguidores" en texto completo; la cifra corta para chips. */
export function formatearSeguidores(valor: number | null | undefined): string {
  return formatearCompacto(valor)
}

/** Multiplicador de precio o de calidad: "1,15 ×". */
export function formatearMultiplicador(
  valor: number | null | undefined
): string {
  return valor === null || valor === undefined
    ? "—"
    : `${formatearNumero(valor, 3)} ×`
}

/** "@noticias.pasto" (el handle se guarda sin arroba). */
export function formatearHandle(handle: string): string {
  return handle.startsWith("@") ? handle : `@${handle}`
}

/** Calificación promedio 1–5 con un decimal: "4,3". */
export function formatearCalificacion(valor: number | null): string {
  return valor === null ? "—" : formatearNumero(valor, 1)
}
