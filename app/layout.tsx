import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance Control",
  description: "Gestion financiera personal y familiar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
