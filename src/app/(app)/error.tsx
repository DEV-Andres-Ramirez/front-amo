"use client"

import { House } from "lucide-react"
import Link from "next/link"

import { EstadoError } from "@/components/feedback/estado-error"
import { ContenedorPagina } from "@/components/layout/contenedor-pagina"
import { Button } from "@/components/ui/button"
import { RUTA_INICIO } from "@/lib/auth/navegacion"

interface ErrorAplicacionProps {
  error: Error & { digest?: string }
  retry: () => void
}

/** Error de una sección: el AppShell sigue disponible para navegar a otra parte. */
export default function ErrorAplicacion({
  error,
  retry,
}: ErrorAplicacionProps) {
  return (
    <ContenedorPagina ancho="estrecho" className="justify-center">
      <title>Error · AMO</title>
      <EstadoError
        nivelTitulo="h1"
        titulo="No pudimos cargar esta sección"
        descripcion="Ocurrió un problema inesperado y ya quedó registrado. Intenta de nuevo o vuelve al inicio."
        onReintentar={retry}
        digest={error.digest}
        className="rounded-2xl border bg-card/40 py-12"
      >
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={RUTA_INICIO} />}
        >
          <House data-icon="inline-start" aria-hidden />
          Ir al inicio
        </Button>
      </EstadoError>
    </ContenedorPagina>
  )
}
