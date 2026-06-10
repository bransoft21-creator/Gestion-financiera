import type { Metadata, Viewport } from "next";
import { DM_Mono, Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";

const geistUI = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const financialMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-financial",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0E9080",
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Meridian",
  description: "Tu dinero, con perspectiva.",
  applicationName: "Meridian",
  manifest: "/manifest.json",

  openGraph: {
    title: "Meridian",
    description: "Tu dinero, con perspectiva.",
    type: "website",
    siteName: "Meridian",
    locale: "es_AR",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Meridian — Tu dinero, con perspectiva." }],
  },

  twitter: {
    card: "summary_large_image",
    title: "Meridian",
    description: "Tu dinero, con perspectiva.",
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Meridian",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${geistUI.variable} ${financialMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
