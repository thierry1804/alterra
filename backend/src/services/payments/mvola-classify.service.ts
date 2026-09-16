/** Compte ALTERRA (LOHASAHA MADAGASCO ALTERRA) émetteur des virements salaires. */
export const ALTERRA_ACCOUNT = "0382019280";

/** Ligne de frais rattachée à une transaction mère par sa référence — jamais un paiement. */
export const FEE_RX = /^Frais de transfert réf (\d+)$/;

/**
 * Grammaire du libellé salaire ALTERRA : <nom tronqué> <activité> S<semaine> <bordereau> <site> [<code activité>] [<matricule>].
 * Le code activité est optionnel comme le matricule : `Activity.code` n'est pas toujours renseigné
 * (ex. "Trouaison", "Taille" en base n'en ont pas), auquel cas `buildMvolaDescription` l'omet du libellé.
 */
export const SALARY_RX =
  /^(?<nom>.+?)\s+(?<activite>[a-zà-ÿ]+(?:\s[a-zà-ÿ]+)?)\s+s(?<semaine>\d{1,2})\s+(?<bordereau>\d+)\s+(?<site>[a-z]{3})(?:\s+(?<code>act\d{2}))?(?:\s+(?<matricule>\d+))?$/;

/** Une ligne brute du relevé `TRANSACTION MVOLA_PAIEMENT.xls`, colonnes non normalisées. */
export interface MvolaRawRow {
  dateHeure: string;
  reference: string;
  initiateur: string;
  destinataire: string;
  type: string;
  description: string | null;
  /** Signe + espaces, ex. "- 450000.00" : le signe est porteur de sens, ne pas prendre la valeur absolue avant classification. */
  montant: string;
}

/**
 * FEE : coût de transfert rattaché au virement (Payment.transferFee), pas un paiement.
 * SALARY : libellé conforme à la grammaire ALTERRA, candidat au rapprochement.
 * INTERNAL : dépense interne légitime (virement sortant ALTERRA hors salaire), à loguer, jamais rapprochée.
 * IGNORED : pas un virement sortant ALTERRA (encaissement, approvisionnement, autre type de transaction).
 */
export type MvolaRowClass = "FEE" | "SALARY" | "INTERNAL" | "IGNORED";

export function classifyMvolaRow(row: MvolaRawRow): MvolaRowClass {
  if (FEE_RX.test(row.type)) return "FEE";

  const amount = parseFloat(row.montant.replace(/\s/g, ""));

  if (row.type !== "Transfert d'argent") return "IGNORED";
  if (amount >= 0) return "IGNORED";
  if (row.initiateur.replace(/^'/, "").trim() !== ALTERRA_ACCOUNT) return "IGNORED";

  return SALARY_RX.test((row.description ?? "").trim().toLowerCase()) ? "SALARY" : "INTERNAL";
}

/** Composants stables du libellé (site/semaine/bordereau/matricule) — nom et activité toujours ignorés. */
export interface SalaryLabel {
  site: string;
  semaine: number;
  bordereau: number;
  matricule: number | null;
}

/** Référence de la transaction mère portée par une ligne FEE (`Frais de transfert réf <reference>`). */
export function parseFeeReference(type: string): string | null {
  return FEE_RX.exec(type)?.[1] ?? null;
}

export function parseSalaryLabel(description: string): SalaryLabel | null {
  const match = SALARY_RX.exec(description.trim().toLowerCase());
  if (!match?.groups) return null;

  return {
    site: match.groups.site,
    semaine: Number(match.groups.semaine),
    bordereau: Number(match.groups.bordereau),
    matricule: match.groups.matricule != null ? Number(match.groups.matricule) : null,
  };
}
