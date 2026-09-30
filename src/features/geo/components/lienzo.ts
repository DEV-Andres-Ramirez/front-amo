/**
 * Alto del explorador dentro del AppShell: la ventana menos la barra superior
 * (3,5 rem) y, desde `md`, los márgenes del contenedor "inset" (2 × 0,5 rem).
 */
export const CLASE_LIENZO =
  "h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4.5rem)] md:rounded-b-xl"

/** Panel flotante de vidrio sobre el mapa. */
export const CLASE_PANEL =
  "vidrio pointer-events-auto rounded-2xl shadow-[0_12px_40px_-16px_rgb(0_0_0/0.45)]"
