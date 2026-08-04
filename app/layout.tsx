import type { Metadata, Viewport } from "next";
import { Cinzel, Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerProvider } from "@/components/pwa/ServiceWorkerProvider";

/* Titulos */
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

/* Subtitulos */
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

/* Textos */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portal Oficial | Escola Bíblica Dominical — IEADPE Campo de Betânia",
  description:
    "Portal Oficial da Escola Bíblica Dominical da IEADPE — Campo de Betânia, Pernambuco. Ensinando a Palavra. Transformando vidas.",
  applicationName: "EBD IEADPE Betânia",
  authors: [{ name: "IEADPE Campo de Betânia" }],
  keywords: ["EBD", "Escola Bíblica Dominical", "IEADPE", "Betânia", "Pernambuco"],
  robots: { index: false, follow: false }, // portal interno

  /*
   * O iOS ignora boa parte do manifest.webmanifest e le estas meta tags no
   * lugar. Sem elas, "Adicionar a Tela de Inicio" no iPhone gera um atalho que
   * abre no Safari com a barra de endereco — ou seja, nao vira aplicativo.
   */
  appleWebApp: {
    capable: true,
    title: "EBD Betânia",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Portal Oficial | Escola Bíblica Dominical",
    description: "IEADPE — Campo de Betânia. Ensinando a Palavra. Transformando vidas.",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  themeColor: "#030817",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover", // respeita o notch do iPhone
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${cinzel.variable} ${playfair.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-brand-990 font-sans antialiased">
        {children}
        <ServiceWorkerProvider />
      </body>
    </html>
  );
}
