const MVOLA_NOM_MAX_LEN = Number(process.env.MVOLA_NOM_MAX_LEN ?? 18);

function toTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function buildMvolaDescription(
  nom: string,
  activite: string,
  semaine: number | string,
  bordereau: number,
  site: string,
  codeActivite: string,
  matricule?: number | string | null,
): string {
  const trimmedNom = toTitleCase(nom).slice(0, MVOLA_NOM_MAX_LEN);
  const parts = [
    trimmedNom,
    activite.trim().toUpperCase(),
    `S${semaine}`,
    String(bordereau),
    site.trim().toUpperCase(),
    codeActivite.trim().toUpperCase(),
    ...(matricule !== undefined && matricule !== null ? [String(matricule)] : []),
  ];
  return parts.filter((part) => part.length > 0).join(" ");
}

export function isValidMvolaNumber(value: string): boolean {
  return /^03[48]\d{7}$/.test(value.trim());
}
