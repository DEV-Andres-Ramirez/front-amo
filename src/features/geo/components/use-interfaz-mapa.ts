"use client"

import {
  type RefObject,
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
} from "react"

/** Desde este ancho del explorador hay paneles laterales; por debajo, hojas inferiores. */
export const ANCHO_AMPLIO_PX = 960

export type Disposicion = "compacta" | "amplia"

export function disposicionPara(anchoPx: number): Disposicion {
  return anchoPx >= ANCHO_AMPLIO_PX ? "amplia" : "compacta"
}

export interface Tamano {
  readonly ancho: number
  readonly alto: number
}

/** Tamaño del elemento (ResizeObserver); 0 × 0 hasta la primera medición. */
export function useTamanoElemento(ref: RefObject<HTMLElement | null>): Tamano {
  const [tamano, setTamano] = useState<Tamano>({ ancho: 0, alto: 0 })
  useEffect(() => {
    const elemento = ref.current
    if (!elemento) return
    const observador = new ResizeObserver(([entrada]) => {
      const ancho = Math.round(entrada.contentRect.width)
      const alto = Math.round(entrada.contentRect.height)
      setTamano((previo) =>
        previo.ancho === ancho && previo.alto === alto ? previo : { ancho, alto }
      )
    })
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [ref])
  return tamano
}

const CONSULTA_PUNTERO_FINO = "(hover: hover) and (pointer: fine)"

function suscribirPuntero(notificar: () => void): () => void {
  const consulta = window.matchMedia(CONSULTA_PUNTERO_FINO)
  consulta.addEventListener("change", notificar)
  return () => consulta.removeEventListener("change", notificar)
}

/** ¿Ratón o trackpad? (tooltips de hover y atajos de doble clic). */
export function usePunteroFino(): boolean {
  return useSyncExternalStore(
    suscribirPuntero,
    () => window.matchMedia(CONSULTA_PUNTERO_FINO).matches,
    () => true
  )
}

/**
 * Pantalla completa del explorador. El explorador pasa a `fixed inset-0`
 * (así los menús y hojas, que se montan en `body`, siguen visibles) y, si el
 * navegador lo permite, además se oculta su interfaz con la Fullscreen API.
 */
export function usePantallaCompleta() {
  const [activa, setActiva] = useState(false)

  useEffect(() => {
    const alCambiar = () => {
      if (!document.fullscreenElement) setActiva(false)
    }
    document.addEventListener("fullscreenchange", alCambiar)
    return () => document.removeEventListener("fullscreenchange", alCambiar)
  }, [])

  const alternar = useCallback(() => {
    if (activa) {
      setActiva(false)
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
      return
    }
    setActiva(true)
    // Safari en iPhone no la soporta: basta con el modo `fixed`.
    document.documentElement.requestFullscreen?.().catch(() => {})
  }, [activa])

  return { activa, alternar }
}

const SELECTOR_CAPAS_ABIERTAS = [
  '[data-slot="popover-content"]',
  '[data-slot="select-content"]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="drawer-popup"]',
  '[data-slot="dialog-content"]',
  '[data-slot="sheet-content"]',
].join(",")

function esCampoEditable(destino: EventTarget | null): boolean {
  return (
    destino instanceof HTMLElement &&
    (destino.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(destino.tagName))
  )
}

/**
 * Esc del explorador, sin robarlo a los menús, hojas y diálogos abiertos (que
 * lo usan para cerrarse) ni a los campos de texto.
 */
export function useTeclaEscape(habilitada: boolean, alPulsar: () => void) {
  const manejar = useEffectEvent(alPulsar)
  useEffect(() => {
    if (!habilitada) return
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape" || evento.defaultPrevented) return
      if (evento.isComposing || esCampoEditable(evento.target)) return
      if (document.querySelector(SELECTOR_CAPAS_ABIERTAS)) return
      manejar()
    }
    window.addEventListener("keydown", alTeclear)
    return () => window.removeEventListener("keydown", alTeclear)
  }, [habilitada])
}
