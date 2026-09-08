export type WorkerImportFieldKey =
  | "legacyMocId"
  | "matricule"
  | "firstName"
  | "lastName"
  | "mvolaNumber"
  | "siteShortCode"
  | "hiredAt"
  | "teamId"
  | "cinNumber"
  | "address"
  | "status";

export interface WorkerImportField {
  key: WorkerImportFieldKey;
  label: string;
  required: boolean;
}

export const WORKER_IMPORT_FIELDS: WorkerImportField[] = [
  { key: "legacyMocId", label: "ID MOC historique (legacy)", required: false },
  { key: "matricule", label: "Matricule (généré si absent)", required: false },
  { key: "firstName", label: "Prénom", required: true },
  { key: "lastName", label: "Nom", required: true },
  { key: "mvolaNumber", label: "Numéro MVola", required: true },
  { key: "siteShortCode", label: "Code site (ex. MNK)", required: true },
  { key: "hiredAt", label: "Date d'embauche (défaut : date du jour)", required: false },
  { key: "teamId", label: "Équipe (UUID)", required: false },
  { key: "cinNumber", label: "Numéro CIN", required: false },
  { key: "address", label: "Adresse", required: false },
  { key: "status", label: "Statut (ACTIVE/INACTIVE)", required: false },
];

export const WORKER_IMPORT_REQUIRED_FIELDS: WorkerImportFieldKey[] = WORKER_IMPORT_FIELDS.filter(
  (f) => f.required,
).map((f) => f.key);

export const WORKER_IMPORT_FIELD_ALIASES: Record<WorkerImportFieldKey, string[]> = {
  legacyMocId: ["id moc", "id moc historique", "legacy", "legacy moc", "id historique"],
  matricule: ["matricule"],
  firstName: ["prénom", "prenom", "first name", "firstname", "first_name"],
  lastName: ["nom", "nom de famille", "last name", "lastname", "last_name"],
  mvolaNumber: [
    "mvola",
    "numéro mvola",
    "numero mvola",
    "num mvola",
    "téléphone",
    "telephone",
    "phone",
  ],
  siteShortCode: ["code site", "site", "shortcode", "site code", "codesite"],
  hiredAt: ["date d'embauche", "date embauche", "hired at", "hiredat", "date embauche"],
  teamId: ["équipe", "equipe", "team", "team id", "teamid"],
  cinNumber: ["cin", "numéro cin", "numero cin", "cin number"],
  address: ["adresse", "address"],
  status: ["statut", "status"],
};

export type WorkerImportColumnMapping = Partial<Record<WorkerImportFieldKey, string>>;
