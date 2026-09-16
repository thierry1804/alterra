import xlsx from "node-xlsx";
import { ApiError } from "../../middleware/error-handler.js";
import type { MvolaRawRow } from "./mvola-classify.service.js";

const HEADER_ROW_INDEX = 6;
const FIRST_DATA_ROW_INDEX = 7;

const COLUMN_HEADERS = [
  "DATE - HEURE",
  "REFERENCE",
  "INITIATEUR",
  "DESTINATAIRE",
  "TYPE - TRANSACTION",
  "DESCRIPTION",
  "MONTANT",
] as const;

/** Numéro MVola avec l'apostrophe texte Excel retirée (ex. "'0341234567" → "0341234567"). */
export function normalizeMvolaPhone(value: string): string {
  return value?.replace(/^'/, "").trim() ?? "";
}

/** Montant conservant le signe (débit/crédit) — porteur de sens, ne jamais l'annuler avant classification. */
export function normalizeMvolaAmount(value: string): number {
  return parseFloat(value.replace(/\s/g, ""));
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

export function parseMvolaReleveWorkbook(buffer: Buffer): MvolaRawRow[] {
  const sheets = xlsx.parse(buffer);
  const sheet = sheets[0];
  if (!sheet) {
    throw new ApiError(422, "IMPORT_BADFORMAT", "Le relevé MVola ne contient aucune feuille");
  }

  const headerRow = (sheet.data[HEADER_ROW_INDEX] as unknown[] | undefined) ?? [];
  const headers = headerRow.map(cellText);
  const columnIndex = new Map(COLUMN_HEADERS.map((h) => [h, headers.indexOf(h)]));

  for (const header of COLUMN_HEADERS) {
    if ((columnIndex.get(header) ?? -1) < 0) {
      throw new ApiError(422, "IMPORT_BADFORMAT", `Colonne "${header}" introuvable en ligne 7`, {
        headers,
      });
    }
  }

  const rows: MvolaRawRow[] = [];

  for (let i = FIRST_DATA_ROW_INDEX; i < sheet.data.length; i++) {
    const raw = sheet.data[i] as unknown[] | undefined;
    if (!raw || raw.every((cell) => cell == null || cell === "")) continue;

    const get = (header: (typeof COLUMN_HEADERS)[number]) =>
      cellText(raw[columnIndex.get(header)!]);

    const description = get("DESCRIPTION");

    rows.push({
      dateHeure: get("DATE - HEURE"),
      reference: get("REFERENCE"),
      initiateur: get("INITIATEUR"),
      destinataire: get("DESTINATAIRE"),
      type: get("TYPE - TRANSACTION"),
      description: description || null,
      montant: get("MONTANT"),
    });
  }

  return rows;
}
