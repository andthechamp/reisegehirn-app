import type { Metadata } from "next";
import { Instrument_Serif, Karla, Courier_Prime } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

// Schrift-Trio aus dem Design-Handoff (design_handoff_reisegehirn_mobile/README.md):
// Instrument Serif für Überschriften, Karla für Fließtext/UI, Courier Prime für
// alle Daten-/Metazeilen (Zeiten, Preise, Kabinennummern, Quellenangaben).
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const courierPrime = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Reisegehirn",
  description: "Dein automatisierter Reisebegleiter",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="de"
      className={`${instrumentSerif.variable} ${karla.variable} ${courierPrime.variable}`}
    >
      <body className="bg-paper font-sans text-ink antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
