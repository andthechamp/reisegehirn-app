"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// MapLibre lädt seinen Renderer in einem eigenen Web Worker über ein
// bundler-abhängiges new-Worker(new URL(...))-Muster, das Turbopack nicht
// auflöst (der Worker-Request kommt als HTML-Fallback statt als JS zurück,
// die Karte bleibt leer ohne Fehler). Der Worker wird deshalb als statische
// Datei ausgeliefert (siehe "postinstall" in package.json). Die Originaldatei
// importiert intern noch ein zweites Modul (maplibre-gl-shared.mjs) - Safari
// lädt verschachtelte ES-Module innerhalb eines Module-Workers nicht
// zuverlässig, die Karte blieb dort leer. esbuild bündelt beide Dateien beim
// npm install zu einer einzigen, importfreien Datei zusammen, das umgeht das.
maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

export interface RouteMapPort {
  port_name: string;
  lat: number;
  lon: number;
  day_number: number;
  state: "done" | "today" | "upcoming";
}

interface RouteMapProps {
  ports: RouteMapPort[];
  onSelectPort?: (port: RouteMapPort) => void;
  selectedDayNumber?: number;
}

// Kein Verbindungslinie zwischen den Häfen: die kostenlosen Seerouten-
// Bibliotheken, die wir getestet haben, haben entlang der norwegischen
// Küste Lücken im Schifffahrtsnetz und erzeugen dadurch teils Luftlinien,
// die sichtbar über Land verlaufen (siehe Nutzer-Feedback). Die Tagesnummer
// auf jedem Marker macht die Reihenfolge trotzdem klar, ganz ohne die
// Unsicherheit einer möglicherweise falschen Route.
const DOT_COLOR: Record<RouteMapPort["state"], string> = {
  done: "#0B2545",
  today: "#C97F1E",
  upcoming: "#2F6F6B",
};

const SELECTED_RING = "0 0 0 3px rgba(11,37,69,0.4), 0 1px 3px rgba(0,0,0,0.35)";
const DEFAULT_SHADOW = "0 1px 3px rgba(0,0,0,0.35)";

export default function RouteMap({ ports, onSelectPort, selectedDayNumber }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Hält die zuletzt übergebenen Callback-/Auswahl-Props für die Marker-
  // Click-Handler bereit, ohne dass die Karte (siehe deps unten) bei jedem
  // Render neu aufgebaut werden muss.
  const onSelectPortRef = useRef(onSelectPort);
  onSelectPortRef.current = onSelectPort;
  const markerElsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!containerRef.current || ports.length === 0) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      interactive: true,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    map.on("error", (e) => console.error("[RouteMap] maplibre error", e.error));

    markerElsRef.current = new Map();

    // Marker hängen bewusst NICHT am "load"-Event - das wartet auf alle
    // Kacheln aller Quellen (inkl. der Vektor-Quelle für Straßen/
    // Beschriftungen) und kann bei einer lahmenden Quelle ausbleiben, obwohl
    // Marker als DOM-Overlays davon unabhängig sind.
    for (const port of ports) {
      const el = document.createElement("div");
      el.title = `Tag ${port.day_number}: ${port.port_name}`;
      const size = port.state === "today" ? 26 : 20;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = "999px";
      el.style.background = DOT_COLOR[port.state];
      el.style.border = "2px solid white";
      el.style.boxShadow = port.day_number === selectedDayNumber ? SELECTED_RING : DEFAULT_SHADOW;
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.color = "white";
      el.style.fontFamily = "ui-sans-serif, system-ui, sans-serif";
      el.style.fontWeight = "700";
      el.style.fontSize = port.state === "today" ? "12px" : "10px";
      el.textContent = String(port.day_number);
      if (onSelectPortRef.current) {
        el.style.cursor = "pointer";
        el.addEventListener("click", () => onSelectPortRef.current?.(port));
      }
      new maplibregl.Marker({ element: el }).setLngLat([port.lon, port.lat]).addTo(map);
      markerElsRef.current.set(port.day_number, el);
    }

    const bounds = new maplibregl.LngLatBounds();
    for (const port of ports) bounds.extend([port.lon, port.lat]);
    map.fitBounds(bounds, { padding: 40, maxZoom: 9, animate: false });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auswahl-Ring separat aktualisieren, statt die Karte (inkl. Zoom/Pan-
  // Zustand) bei jedem Tageswechsel neu aufzubauen.
  useEffect(() => {
    for (const [dayNumber, el] of markerElsRef.current) {
      el.style.boxShadow = dayNumber === selectedDayNumber ? SELECTED_RING : DEFAULT_SHADOW;
    }
  }, [selectedDayNumber]);

  if (ports.length === 0) return null;

  return <div ref={containerRef} className="h-full w-full" />;
}
