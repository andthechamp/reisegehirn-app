// Schalter, die steuern, WIE VIEL die App von sich aus an kostenpflichtiger
// Recherche auslöst. Bewusst in einer eigenen Datei ohne SDK-Import: die
// Flags werden auch außerhalb der API-Routen gelesen (z. B. von der
// Server-Komponente ResearchGapList im Admin-Bereich), und dort soll nicht
// nebenbei der Anthropic-Client instanziiert werden.

// Hauptschalter für die komplette Websuche-Recherche (Schiff/Kabine/Hafen),
// egal ob manuell über die Admin-Endpunkte oder automatisch. Auf false steht
// die Recherche komplett still, auch für Admins.
export const RESEARCH_ENABLED = true;

// Schalter NUR für die automatische Recherche zur Laufzeit, also die Aufrufe,
// die ohne bewusste Entscheidung eines Menschen Geld kosten: beim Hochladen
// einer Reise (/api/confirm) und beim Laden einer Reiseseite (/api/trips/[id]).
//
// Aus (aktuell): Die App löst von sich aus keinen einzigen kostenpflichtigen
// Recherche-Aufruf mehr aus. Fehlende Themen werden stattdessen in
// research_gaps protokolliert und im Admin-Bereich aufgelistet, damit sie
// redaktionell (Seed-Skript) oder per bewusstem Klick auf "Jetzt
// recherchieren" gefüllt werden können, bevor jemand die Reise öffnet.
// Kostenlose Anreicherung (Wetter aus Open-Meteo, Wikipedia-Bilder,
// Geocoding, Hafenfotos) läuft davon unberührt weiter.
//
// An: Die frühere Automatik lebt wieder auf - fehlende Themen werden beim
// Hochladen/Laden im Hintergrund nachrecherchiert. Dabei greift die
// Versuchsobergrenze aus research_gaps (siehe MAX_AUTO_ATTEMPTS in
// lib/research-gaps.ts), damit ein Thema, das die Recherche partout nicht
// liefert, nicht bei jedem Seitenaufruf einen neuen Sonnet-Lauf auslöst.
export const RESEARCH_AUTO = false;
