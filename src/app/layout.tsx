import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

// Display-Schrift für Überschriften (Reisename, Sektionstitel) - redaktioneller
// Charakter als Kontrast zur nüchternen Systemschrift für Fließtext/Datenfelder.
// Als CSS-Variable eingebunden, in tailwind.config.ts unter "display" verfügbar.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Reisegehirn",
  description: "Dein automatisierter Reisebegleiter",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={fraunces.variable}>
      <body className="bg-mist text-ink antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
