import { beforeEach, describe, expect, it } from "vitest";
import { formatAmount, formatAr, getAmountDecimals, setAmountDecimals } from "./money";

describe("montants de paiement", () => {
  beforeEach(() => {
    localStorage.clear();
    setAmountDecimals(0);
  });

  it("n'affiche aucune décimale par défaut, avec séparateur de milliers", () => {
    expect(formatAmount("118750")).toMatch(/^118\s750$/);
    expect(formatAmount(1234.6)).toMatch(/^1\s235$/);
  });

  it("affiche toujours le nombre de décimales réglé, même pour un montant entier", () => {
    setAmountDecimals(2);
    expect(formatAmount("118750")).toMatch(/^118\s750,00$/);
    expect(formatAmount("12.5")).toBe("12,50");
    setAmountDecimals(1);
    expect(formatAmount("12.54")).toBe("12,5");
  });

  it("ajoute l'unité", () => {
    setAmountDecimals(2);
    expect(formatAr("10")).toBe("10,00 Ar");
  });

  it("borne le réglage à 0-2 et ignore les valeurs invalides", () => {
    setAmountDecimals(9);
    expect(getAmountDecimals()).toBe(2);
    setAmountDecimals(-3);
    expect(getAmountDecimals()).toBe(0);
    setAmountDecimals(1.5);
    expect(getAmountDecimals()).toBe(0);
  });

  it("garde le dernier réglage pour la session suivante", () => {
    setAmountDecimals(2);
    expect(localStorage.getItem("alterra:amountDecimals")).toBe("2");
  });

  it("tolère une valeur absente ou non numérique", () => {
    expect(formatAmount(null)).toBe("0");
    expect(formatAmount("abc")).toBe("0");
  });
});
