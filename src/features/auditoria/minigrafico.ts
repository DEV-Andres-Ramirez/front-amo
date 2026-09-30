/**
 * Geometría del minigráfico de un indicador (módulo puro): trazos SVG de la
 * línea y del área bajo ella en un lienzo fijo, con la escala desde cero.
 */

export interface GeometriaMinigrafico {
  linea: string
  area: string
  /** Último punto (el periodo actual), que se marca con un punto. */
  ultimo: { x: number; y: number }
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

/**
 * `null` con menos de dos puntos o si todos son cero (una línea plana en el
 * suelo no informa nada: el indicador ya dice "0").
 */
export function geometriaMinigrafico(
  valores: readonly number[],
  ancho: number,
  alto: number,
  margen = 2
): GeometriaMinigrafico | null {
  const finitos = valores.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0))
  const maximo = Math.max(...finitos, 0)
  if (finitos.length < 2 || maximo === 0) return null

  const util = { ancho: ancho - margen * 2, alto: alto - margen * 2 }
  const paso = util.ancho / (finitos.length - 1)
  const puntos = finitos.map((valor, indice) => ({
    x: redondear(margen + indice * paso),
    y: redondear(margen + util.alto - (valor / maximo) * util.alto),
  }))
  const linea = puntos
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`)
    .join(" ")
  const base = redondear(alto - margen)
  const primero = puntos[0]
  const ultimo = puntos[puntos.length - 1]
  return {
    linea,
    area: `${linea} L${ultimo.x} ${base} L${primero.x} ${base} Z`,
    ultimo,
  }
}
