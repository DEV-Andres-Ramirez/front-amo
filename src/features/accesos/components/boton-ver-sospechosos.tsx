"use client"

import { ArrowRight } from "lucide-react"
import { useQueryStates } from "nuqs"
import { type ReactNode, useTransition } from "react"

import { parseAsPagina } from "@/components/data-table/estado-url"
import { cn } from "@/lib/utils"

import { estadoTablaAccesos, ID_REGISTRO_ACCESOS } from "../estado-accesos"

const parsers = {
  sospechoso: estadoTablaAccesos.parsers.sospechoso,
  pagina: parseAsPagina,
}

/** Filtra el registro a los accesos sospechosos y baja hasta él. */
export function BotonVerSospechosos({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const [, iniciar] = useTransition()
  const [, fijar] = useQueryStates(parsers, {
    shallow: false,
    scroll: false,
    startTransition: iniciar,
  })

  function ver() {
    void fijar({ sospechoso: ["SI"], pagina: null })
    document
      .getElementById(ID_REGISTRO_ACCESOS)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <button
      type="button"
      onClick={ver}
      className={cn(
        "group/ver inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:anillo-foco",
        className
      )}
    >
      {children}
      <ArrowRight
        className="size-3 transition-transform group-hover/ver:translate-x-0.5 motion-reduce:transition-none"
        aria-hidden
      />
    </button>
  )
}
