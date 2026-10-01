"use client"

import { catchError, type ErrorInfo } from "next/error"

import { EstadoError } from "@/components/feedback/estado-error"
import { cn } from "@/lib/utils"

interface PropsLimite {
  /** Nombre del bloque ("Tendencia del GMV"). */
  titulo: string
  className?: string
}

function FallaBloque({ titulo, className }: PropsLimite, { error, retry }: ErrorInfo) {
  const digest =
    error instanceof Error && "digest" in error
      ? String(error.digest)
      : undefined
  return (
    <div
      className={cn(
        "flex h-full min-h-56 items-center rounded-xl border border-dashed bg-card/60",
        className
      )}
    >
      <EstadoError
        compacto
        nivelTitulo="h2"
        titulo={`No pudimos cargar «${titulo}»`}
        descripcion="El resto del panel sigue disponible. Reintenta en unos segundos."
        onReintentar={() => retry()}
        digest={digest}
      />
    </div>
  )
}

/**
 * Límite de error de un bloque del panel: una consulta que falla (permiso,
 * red, BD) no tumba los demás bloques; `retry()` vuelve a pedir solo este
 * contenido al servidor dentro de una transición.
 */
export const LimiteErrorBloque = catchError(FallaBloque)
