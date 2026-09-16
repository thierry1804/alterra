import {
  WORKER_IMPORT_FIELD_ALIASES,
  WORKER_IMPORT_FIELDS,
  type WorkerImportFieldKey,
} from "./worker-import-fields.js";

const FUZZY_THRESHOLD = 0.72;

export function normalizeImportLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i]![0] = i;
  for (let j = 0; j < cols; j++) dp[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[a.length]![b.length]!;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  // Header containing a full alias (e.g. "prenomdumoc" ⊃ "prenom") is a strong signal.
  if (longer.includes(shorter) && shorter.length >= 4) {
    return Math.max(0.85, shorter.length / longer.length);
  }
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function bestScoreForField(
  fieldKey: string,
  fields: Array<{ key: string; label: string }>,
  aliases: Record<string, string[]>,
  columnLabelNorm: string,
): number {
  const field = fields.find((f) => f.key === fieldKey)!;
  const candidates = [field.key, field.label, ...(aliases[fieldKey] ?? [])].map(
    normalizeImportLabel,
  );

  let best = 0;
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === columnLabelNorm) return 1;
    best = Math.max(best, similarity(candidate, columnLabelNorm));
  }
  return best;
}

/** Associe chaque colonne détectée au champ dont le libellé/alias se rapproche le plus (fuzzy match). */
export function suggestColumnMappingGeneric<K extends string>(
  columns: Array<{ column: string; label: string }>,
  fields: Array<{ key: K; label: string }>,
  aliases: Record<K, string[]>,
): Partial<Record<K, string>> {
  type Candidate = { fieldKey: K; column: string; score: number };
  const candidates: Candidate[] = [];

  for (const col of columns) {
    const labelNorm = normalizeImportLabel(col.label);
    if (!labelNorm) continue;
    for (const field of fields) {
      const score = bestScoreForField(field.key, fields, aliases, labelNorm);
      if (score >= FUZZY_THRESHOLD) {
        candidates.push({ fieldKey: field.key, column: col.column, score });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.fieldKey.localeCompare(b.fieldKey));

  const mapping: Partial<Record<K, string>> = {};
  const usedColumns = new Set<string>();
  const usedFields = new Set<K>();

  for (const c of candidates) {
    if (usedFields.has(c.fieldKey) || usedColumns.has(c.column)) continue;
    mapping[c.fieldKey] = c.column;
    usedFields.add(c.fieldKey);
    usedColumns.add(c.column);
  }

  return mapping;
}

export function suggestColumnMapping(
  columns: Array<{ column: string; label: string }>,
): Partial<Record<WorkerImportFieldKey, string>> {
  return suggestColumnMappingGeneric(columns, WORKER_IMPORT_FIELDS, WORKER_IMPORT_FIELD_ALIASES);
}
