export type MvolaReleveFieldKey =
  "dateHeure" | "reference" | "initiateur" | "destinataire" | "type" | "description" | "montant";

export interface MvolaReleveField {
  key: MvolaReleveFieldKey;
  label: string;
  required: boolean;
}

export const MVOLA_RELEVE_FIELDS: MvolaReleveField[] = [
  { key: "dateHeure", label: "Date - heure", required: true },
  { key: "reference", label: "Référence", required: true },
  { key: "initiateur", label: "Initiateur", required: true },
  { key: "destinataire", label: "Destinataire", required: true },
  { key: "type", label: "Type de transaction", required: true },
  { key: "description", label: "Description", required: true },
  { key: "montant", label: "Montant", required: true },
];

export const MVOLA_RELEVE_FIELD_ALIASES: Record<MvolaReleveFieldKey, string[]> = {
  dateHeure: ["date heure", "date - heure", "date", "datetransaction"],
  reference: ["reference", "référence", "ref"],
  initiateur: ["initiateur", "emetteur", "expediteur"],
  destinataire: ["destinataire", "beneficiaire", "recepteur"],
  type: ["type transaction", "type - transaction", "type", "typetransaction"],
  description: ["description", "libelle", "libellé"],
  montant: ["montant", "amount"],
};
