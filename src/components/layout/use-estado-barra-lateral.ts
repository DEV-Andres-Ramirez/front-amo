"use client"

import { useState, useSyncExternalStore } from "react"

/** Tablet: entre el cambio a panel móvil (768 px) y el escritorio amplio. */
const CONSULTA_TABLET = "(min-width: 768px) and (max-width: 1279px)"

function suscribir(notificar: () => void): () => void {
  const consulta = window.matchMedia(CONSULTA_TABLET)
  consulta.addEventListener("change", notificar)
  return () => consulta.removeEventListener("change", notificar)
}

const esTablet = () => window.matchMedia(CONSULTA_TABLET).matches

/**
 * Estado abierto/colapsado de la barra lateral. Manda la preferencia guardada
 * en la cookie `sidebar_state` (la escribe el SidebarProvider al alternar);
 * sin preferencia, en tablet arranca colapsada para dar espacio al contenido.
 */
export function useEstadoBarraLateral(preferenciaInicial: boolean | null) {
  const [preferencia, setPreferencia] = useState(preferenciaInicial)
  const tablet = useSyncExternalStore(suscribir, esTablet, () => false)

  return [preferencia ?? !tablet, setPreferencia] as const
}
