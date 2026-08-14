/**
 * Formatiert eine Uhrzeit-Eingabe progressiv als HH:MM, während getippt wird
 * (z. B. "0800" -> "08:00"), damit man den Doppelpunkt nicht manuell setzen
 * muss. Ignoriert alles außer Ziffern und begrenzt auf 4 Stellen.
 */
export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
