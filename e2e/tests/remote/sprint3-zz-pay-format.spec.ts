import { test, expect } from "@playwright/test";
import { stLoad } from "./support/state.js";

/**
 * UC-FE-ADM-PAY-EXP — conformité du fichier exporté avec docs/cadrage/mvola-format.md §3.2
 * (5 colonnes : Numéro téléphone, Description, Période, Montant, Bio Validée).
 * Lit l'en-tête relevé pendant l'export de sprint3-pay.spec.ts (test indépendant : un écart n'interrompt pas la chaîne).
 */
test("UC-FE-ADM-PAY-IMP › un fichier qui n'est pas un classeur Excel est refusé à la lecture des colonnes", async () => {
  const st = stLoad<{ status?: number }>("pay-import-garbage");
  test.skip(st.status === undefined, "test d'import non exécuté");
  expect(st.status, `fichier texte accepté par /payments/import-status/columns (HTTP ${st.status}) : lu comme CSV au lieu d'être rejeté`).toBeGreaterThanOrEqual(400);
});

test("UC-FE-ADM-PAY-EXP › l'en-tête du fichier exporté respecte la spécification MVola (5 colonnes)", async () => {
  const st = stLoad<{ header?: string[]; columns?: number }>("pay-format");
  test.skip(!st.header, "aucun export réalisé (semaine vierge indisponible)");
  expect(
    st.header,
    `En-tête exporté ${JSON.stringify(st.header)} (${st.columns} colonnes) ≠ spécification (Numéro téléphone, Description, Période, Montant, Bio Validée)`,
  ).toEqual(["Numéro téléphone", "Description", "Période", "Montant", "Bio Validée"]);
});
