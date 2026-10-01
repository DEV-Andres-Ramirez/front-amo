// TEMPORAL (pista geo-datos): vista previa del mapa de ingresos con datos simulados. Se borra al terminar.
import { Building2, Earth } from "lucide-react"

import { ContenedorPagina } from "@/components/layout/contenedor-pagina"
import { RankingUbicaciones } from "@/features/accesos/components/ranking-ubicaciones"
import { TarjetaMapaIngresos } from "@/features/geo/components/tarjeta-mapa-ingresos"
import { crearProveedorSimulado } from "@/features/geo/proveedor-simulado"
import { obtenerPais } from "@/lib/geo/catalogo"
import { requerirPermiso } from "@/lib/auth/dal"

export default async function Pagina() {
  await requerirPermiso("accesos.ver")
  const proveedor = crearProveedorSimulado()
  const base = { metrica: "accesos", desde: "2026-09-01", hasta: "2026-09-30", departamento: null } as const
  const [mundo, colombia] = await Promise.all([
    proveedor.mapa({ ...base, nivel: "internacional" }),
    proveedor.mapa({ ...base, nivel: "nacional" }),
  ])
  const paises = mundo.filas
    .filter((f) => (f.valor ?? 0) > 0)
    .map((f) => {
      const pais = obtenerPais(f.codigo)
      return { codigo: f.codigo, nombre: f.nombre, valor: f.valor ?? 0, centro: pais && !pais.conGeometria ? pais.centroide : undefined }
    })
    .sort((a, b) => b.valor - a.valor)
  const total = paises.reduce((s, p) => s + p.valor, 0)
  const elementos = paises.slice(0, 6).map((p) => ({ clave: p.codigo, etiqueta: p.nombre, detalle: p.codigo, iso2: p.codigo, bandera: null, cantidad: p.valor, proporcion: p.valor / total }))
  return (
    <ContenedorPagina>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <TarjetaMapaIngresos
            datos={{
              paises,
              departamentos: Object.fromEntries(colombia.filas.map((f) => [f.codigo, f.valor ?? 0])),
              total,
              estimado: false,
            }}
          />
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
          <RankingUbicaciones titulo="Países" descripcion="Ingresos exitosos por país de conexión" icono={<Earth aria-hidden />} elementos={elementos} vacio={{ titulo: "", descripcion: "" }} />
          <RankingUbicaciones titulo="Ciudades" descripcion="Municipio en Colombia o ciudad reportada en el exterior" icono={<Building2 aria-hidden />} elementos={elementos} vacio={{ titulo: "", descripcion: "" }} />
        </div>
      </div>
      <section id="registro-accesos" className="h-[60vh]" />
    </ContenedorPagina>
  )
}
