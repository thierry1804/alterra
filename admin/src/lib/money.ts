import { useSyncExternalStore } from "react";

/**
 * Affichage des montants de paiement (Ariary) : le nombre de décimales est un réglage de l'application
 * (Paramètres, « Montants »), lu au chargement par `useAppSettings`. Un module partagé évite de le faire
 * passer par chaque composant et garde les écrans alignés sur les exports et les PDF.
 */
export const MAX_AMOUNT_DECIMALS = 2;

const STORAGE_KEY = "alterra:amountDecimals";

function clamp(value: number): number {
  return Number.isInteger(value) ? Math.min(Math.max(value, 0), MAX_AMOUNT_DECIMALS) : 0;
}

function readStored(): number {
  try {
    return clamp(Number(localStorage.getItem(STORAGE_KEY) ?? 0));
  } catch {
    return 0;
  }
}

// Dernière valeur connue d'une session précédente : évite un premier affichage à 0 décimale qui se corrige ensuite.
let amountDecimals = readStored();
const listeners = new Set<() => void>();

export function setAmountDecimals(value: number): void {
  const next = clamp(value);
  if (next === amountDecimals) return;
  amountDecimals = next;
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Stockage indisponible : le réglage reste valable pour la session.
  }
  listeners.forEach((listener) => listener());
}

export function getAmountDecimals(): number {
  return amountDecimals;
}

/** Abonne un composant au réglage : il se re-rend quand le nombre de décimales change. */
export function useAmountDecimals(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getAmountDecimals,
    getAmountDecimals,
  );
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
