import type { Config } from "tailwindcss";

// Palette bewusst vom Kreuzfahrt/Fjord-Thema abgeleitet statt generischer
// Standardfarben: gedämpftes Fjord-Teal als Primärfarbe, warmer Bernstein
// als Signalfarbe für bestätigende Aktionen, ruhiger Nebel-Hintergrund.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B2B3A",
        mist: "#F3F5F4",
        fjord: {
          DEFAULT: "#2F6F6B",
          // Marineblau statt des ursprünglichen dunklen Fjord-Grüns - für den
          // Hero-Banner sollte es maritimer/nautischer wirken, siehe
          // Trip-Detail-Redesign.
          dark: "#0B2545",
          light: "#E4EEEC",
        },
        amber: {
          DEFAULT: "#C97F1E",
          light: "#F6E8D3",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
        // Für Überschriften (Reisename, Sektionstitel) - Fließtext und
        // Datenfelder (Kabinennummern, Zeiten, Preise) bleiben bei "sans".
        display: ["var(--font-display)", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
