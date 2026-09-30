import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"
import { headers } from "next/headers"

import { SaltoAlContenido } from "@/components/feedback/salto-contenido"
import { Proveedores } from "@/components/providers/proveedores"
import { envCliente } from "@/lib/env"
import { cn } from "@/lib/utils"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  // Fuente variable: un solo archivo cubre los pesos 500–800 que usa la marca.
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(envCliente.NEXT_PUBLIC_SITE_URL),
  title: { default: "AMO", template: "%s · AMO" },
  description:
    "AMO — Advertising Market Optimization. Marketplace de pauta en medios hiperlocales.",
  applicationName: "AMO",
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0E0B16" },
    { media: "(prefers-color-scheme: light)", color: "#FAF9FD" },
  ],
  colorScheme: "dark light",
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // El proxy genera un nonce por solicitud para la CSP.
  const nonce = (await headers()).get("x-nonce") ?? undefined

  return (
    <html
      lang="es-CO"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn(
        geistSans.variable,
        geistMono.variable,
        jakarta.variable,
        "h-full"
      )}
    >
      <body className="min-h-full">
        <SaltoAlContenido />
        <Proveedores nonce={nonce}>{children}</Proveedores>
      </body>
    </html>
  )
}
