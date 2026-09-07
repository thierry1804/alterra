const MVOLA_DESC_MAX_LEN = Number(process.env.MVOLA_DESC_MAX_LEN ?? 30);

export function buildMvolaDescription(
  firstName: string,
  periodShort: string,
  siteShortCode: string,
  activityLabel?: string | null,
  quantity?: string | number | null,
): string {
  const middleParts = [
    ...(activityLabel ? [activityLabel] : []),
    periodShort,
    ...(quantity !== undefined && quantity !== null ? [String(quantity)] : []),
    siteShortCode,
  ];
  const suffix = ` ${middleParts.join(" ")}`;
  const maxFirstNameLen = MVOLA_DESC_MAX_LEN - suffix.length;

  if (maxFirstNameLen < 1) {
    return suffix.trim().slice(0, MVOLA_DESC_MAX_LEN);
  }

  const trimmedName =
    firstName.length > maxFirstNameLen ? firstName.slice(0, maxFirstNameLen) : firstName;

  return `${trimmedName}${suffix}`;
}

export function isValidMvolaNumber(value: string): boolean {
  return /^03[48]\d{7}$/.test(value.trim());
}
