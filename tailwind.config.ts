import type { Config } from "tailwindcss";

// Palette bewusst vom Kreuzfahrt/Fjord-Thema abgeleitet statt generischer
// Standardfarben: gedämpftes Fjord-Teal als Primärfarbe, warmer Bernstein
// als Signalfarbe für bestätigende Aktionen, ruhiger Nebel-Hintergrund.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // "analoges Logbuch"-Palette aus dem Design-Handoff
        // (design_handoff_reisegehirn_mobile/README.md). ink/mist/fjord/amber
        // bleiben vorerst bestehen, weil Home/Account/Admin-Seiten noch nicht
        // auf das neue Design umgestellt sind.
        ink: "#1B2B3A",
        mist: "#F3F5F4",
        fjord: {
          DEFAULT: "#2F6F6B",
          dark: "#0B2545",
          light: "#E4EEEC",
        },
        amber: {
          DEFAULT: "#C97F1E",
          light: "#F6E8D3",
        },
        paper: "#F7F1E6",
        "paper-deep": "#EFE7D8",
        canvas: "#EDE4D6",
        card: "#FFFDF7",
        logbook: "#23201B",
        stamp: {
          DEFAULT: "oklch(0.55 0.14 30)",
          deep: "oklch(0.5 0.14 30)",
          tint: "oklch(0.96 0.02 30)",
          "tint-deep": "oklch(0.94 0.03 30)",
        },
        sea: {
          DEFAULT: "oklch(0.55 0.14 235)",
          tint: "oklch(0.96 0.02 235)",
          border: "oklch(0.88 0.04 235)",
        },
        excursion: {
          DEFAULT: "oklch(0.96 0.03 75)",
          border: "oklch(0.85 0.05 75)",
          text: "oklch(0.45 0.1 75)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Für Überschriften (Reisename, Sektionstitel).
        display: ["var(--font-display)", "serif"],
        // Für alle Daten- und Metazeilen: Zeiten, Kabinennummern, Preise,
        // Buchungsnummern, Quellenangaben, Tages-/Kategorie-Labels.
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
