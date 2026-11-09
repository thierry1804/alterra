/** Identité fiscale du client facturé ("Doit :") — reprise telle quelle du modèle de référence
 * FORMAT FACTURE ISI.xlsx, pas une donnée qu'ALTERRA calcule ou stocke par ailleurs. Partagée par
 * toutes les factures PDF (par activité et hebdomadaire) pour rester cohérente entre elles. */
export const INVOICE_CLIENT = {
  name: "LOHASAHA MADAGASCO",
  nif: "2001423709",
  stat: "02101 11 2009 0 10596",
  addressLine1: "BAT KUBE D 2EME ETAGE, ZONE GALAXY ANDRAHARO",
  addressLine2: "101 ANTANANARIVO MADAGASCAR",
};

/** Retenue appliquée sur chaque ligne ("ISI 5%" du modèle de référence) — calculée à l'affichage,
 * jamais stockée : le format de référence l'exprime lui-même comme une formule, pas une donnée. */
export const ISI_WITHHOLDING_RATE = 0.05;
