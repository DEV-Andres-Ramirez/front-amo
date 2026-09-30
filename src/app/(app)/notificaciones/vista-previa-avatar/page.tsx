// TEMPORAL: prueba visual del editor de foto (bucket aún inexistente). Se borra al terminar.
import { ContenedorPagina } from "@/components/layout/contenedor-pagina"
import { CabeceraPerfil } from "@/features/cuenta/components/cabecera-perfil"
import { perfilPropio } from "@/features/cuenta/queries"
import { requerirPermiso } from "@/lib/auth/dal"

export default async function VistaPreviaAvatar() {
  const usuario = await requerirPermiso("cuenta.gestionar")
  const perfil = await perfilPropio(usuario)
  return (
    <ContenedorPagina ancho="estrecho">
      <CabeceraPerfil perfil={perfil} avataresDisponibles />
    </ContenedorPagina>
  )
}
