import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/app/providers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F766E",
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
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
