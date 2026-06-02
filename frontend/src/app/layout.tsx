import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "CampusGPT | AI Knowledge OS",
  description:
    "CampusGPT is a production-grade RAG assistant for academic teams to search, cite, and chat with institutional knowledge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
