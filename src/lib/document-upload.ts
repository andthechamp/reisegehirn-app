// Geteilte Logik zum Validieren und Umwandeln hochgeladener Dokumente
// (Fotos/PDFs) in Claude-API-Content-Blöcke - genutzt von allen
// Extraktions-Routen (Hauptbuchung, Ausflüge).

export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];
export const PDF_TYPE = "application/pdf" as const;

function isSupportedImageType(type: string): type is SupportedImageType {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(type);
}

export function isSupportedFileType(type: string): boolean {
  return isSupportedImageType(type) || type === PDF_TYPE;
}

/**
 * Claude akzeptiert Bilder (JPEG/PNG/WEBP/GIF) und PDFs. HEIC (iPhone-
 * Standardformat) wird vom Browser oft als "image/heic" gemeldet und von
 * der API abgelehnt - das früh und verständlich melden statt einen
 * kryptischen API-Fehler durchzureichen.
 */
export function findUnsupportedFile(files: File[]): File | null {
  return files.find((file) => !isSupportedFileType(file.type)) ?? null;
}

export function unsupportedFileTypeMessage(file: File): string {
  return `Dateiformat "${file.type || "unbekannt"}" wird nicht unterstützt (Datei: ${file.name}). Bitte als JPG, PNG oder PDF hochladen - HEIC-Fotos vorher umwandeln, z. B. über die "Teilen"-Funktion des iPhones.`;
}

// Bilder/PDFs in Base64 umwandeln - so verlangt es die Claude API.
// PDFs laufen technisch als "document"-Block statt "image"-Block.
export async function filesToContentBlocks(files: File[]) {
  return Promise.all(
    files.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");

      if (file.type === PDF_TYPE) {
        return {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: PDF_TYPE,
            data: base64,
          },
        };
      }

      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: file.type as SupportedImageType,
          data: base64,
        },
      };
    })
  );
}
