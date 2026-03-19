import type { Metadata } from "next";
import { IBM_Plex_Mono, Syne } from "next/font/google";
import "./globals.css";

const displaySans = Syne({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const bodyMono = IBM_Plex_Mono({
  variable: "--font-geist-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "startup compiler visualizer",
  description: "Deterministic AST-walk compiler timeline visualizer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${displaySans.variable} ${bodyMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
