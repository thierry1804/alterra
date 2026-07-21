const MVOLA_DESC_MAX_LEN = Number(process.env.MVOLA_DESC_MAX_LEN ?? 30);

/** RG-09 — « Prénom Paiement Code_site », tronqué si nécessaire. */
export function buildMvolaDescription(firstName: string, siteShortCode: string): string {
  const suffix = ` Paiement ${siteShortCode}`;
  const maxFirstNameLen = MVOLA_DESC_MAX_LEN - suffix.length;

  if (maxFirstNameLen < 1) {
    return siteShortCode.slice(0, MVOLA_DESC_MAX_LEN);
  }

  const trimmedName =
    firstName.length > maxFirstNameLen ? firstName.slice(0, maxFirstNameLen) : firstName;

  return `${trimmedName}${suffix}`;
}

/** MVola Madagascar — 10 chiffres commençant par 034. */
export function isValidMvolaNumber(value: string): boolean {
  return /^034\d{7}$/.test(value.trim());
}
