/**
 * Affichage des montants de paiement (Ariary) : le nombre de décimales est un réglage de l'application
 * (Paramètres, « Montants »), lu au chargement par `useAppSettings`. Un module partagé évite de le faire
 * passer par chaque composant et garde les écrans, les exports et les PDF alignés.
 */
let amountDecimals = 0;

export const MAX_AMOUNT_DECIMALS = 2;

export function setAmountDecimals(value: number): void {
  amountDecimals = Number.isInteger(value) ? Math.min(Math.max(value, 0), MAX_AMOUNT_DECIMALS) : 0;
}

export function getAmountDecimals(): number {
  return amountDecimals;
}

/** Montant avec le nombre de décimales réglé : « 1 234,50 » (sans unité). */
export function formatAmount(value: string | number | null | undefined): string {
  const number = Number(value ?? 0);
  return (Number.isFinite(number) ? number : 0).toLocaleString("fr-FR", {
    minimumFractionDigits: amountDecimals,
    maximumFractionDigits: amountDecimals,
  });
}

/** Montant suivi de l'unité : « 1 234,50 Ar ». */
export function formatAr(value: string | number | null | undefined): string {
  return `${formatAmount(value)} Ar`;
}
