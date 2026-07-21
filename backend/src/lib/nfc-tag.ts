/** Normalise un identifiant NFC (UID hex sans séparateurs). */
export function normalizeNfcTagId(raw: string): string {
  return raw.replace(/[^a-fA-F0-9]/g, "").toLowerCase();
}
