# Import Excel MOC — auto-map + import partiel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Préremplir le mapping colonnes (alias + fuzzy), permettre l’import des seules lignes valides, et afficher « Import en cours… » puis un récap final.

**Architecture:** Le backend expose `suggestedMapping` sur `POST /workers/import/columns` via un helper de scoring isolé. Le commit `POST /workers/import?dryRun=false` importe `preview.valid` même s’il y a des erreurs (422 seulement si zéro ligne valide). Le dialog admin consomme les suggestions, débloque le bouton partiel, et montre l’état pending + toast enrichi.

**Tech Stack:** Node/Express, Vitest, ExcelJS, React + TanStack Query, Axios.

**Spec:** `docs/superpowers/specs/2026-09-08-import-moc-auto-map-partial-design.md`

## Global Constraints

- Progression = texte « Import en cours… » + récap final (pas de job async / SSE / barre %).
- Auto-map seulement si `hasHeaderRow === true`.
- Une colonne Excel → au plus un champ ALTERRA.
- Import partiel : bouton « Importer les X ligne(s) valide(s) » si `valid.length > 0`.
- Hors scope : import initial CLI, correction auto des lignes en erreur.
- Commits : uniquement si l’utilisateur le demande explicitement (sinon skip les steps Commit).

---

## File Structure

| Fichier | Rôle |
|---|---|
| `backend/src/services/import/suggest-column-mapping.ts` | Normalize, alias, fuzzy score, `suggestColumnMapping` |
| `backend/src/services/import/worker-import-fields.ts` | Alias par champ (`WORKER_IMPORT_FIELD_ALIASES`) |
| `backend/src/services/import/workers-import.service.ts` | Branche `suggestedMapping` dans `detectWorkersImportColumns` |
| `backend/src/routes/workers.routes.ts` | Import partiel + réponse `skippedErrors` |
| `backend/src/__tests__/suggest-column-mapping.test.ts` | Tests unitaires scoring |
| `backend/src/__tests__/referentials.test.ts` | Tests route import partiel / columns |
| `admin/src/lib/referentials.ts` | Types `suggestedMapping`, réponse import |
| `admin/src/components/workers/ImportDialog.tsx` | Prefill mapping, bouton partiel, pending UI |

---

### Task 1: Helper suggestColumnMapping (TDD)

**Files:**
- Create: `backend/src/services/import/suggest-column-mapping.ts`
- Modify: `backend/src/services/import/worker-import-fields.ts`
- Test: `backend/src/__tests__/suggest-column-mapping.test.ts`

**Interfaces:**
- Consumes: `WORKER_IMPORT_FIELDS`, `WorkerImportFieldKey` from `worker-import-fields.ts`
- Produces:
  - `WORKER_IMPORT_FIELD_ALIASES: Record<WorkerImportFieldKey, string[]>`
  - `normalizeImportLabel(value: string): string`
  - `suggestColumnMapping(columns: Array<{ column: string; label: string }>): Partial<Record<WorkerImportFieldKey, string>>`

- [ ] **Step 1: Ajouter les alias dans `worker-import-fields.ts`**

À la fin du fichier, après `WORKER_IMPORT_REQUIRED_FIELDS` :

```ts
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
```

- [ ] **Step 2: Écrire les tests unitaires (échouent)**

Créer `backend/src/__tests__/suggest-column-mapping.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  normalizeImportLabel,
  suggestColumnMapping,
} from "../services/import/suggest-column-mapping.js";

describe("suggestColumnMapping", () => {
  it("normalizeImportLabel lowercases, strips accents and spaces/punct", () => {
    expect(normalizeImportLabel("  Prénom ")).toBe("prenom");
    expect(normalizeImportLabel("Numéro MVola")).toBe("numeromvola");
    expect(normalizeImportLabel("Code site (ex. MNK)")).toBe("codesiteexmnk");
  });

  it("maps exact aliases to column letters", () => {
    const mapping = suggestColumnMapping([
      { column: "A", label: "Prénom" },
      { column: "B", label: "Nom" },
      { column: "C", label: "Numéro MVola" },
      { column: "D", label: "Code site" },
    ]);
    expect(mapping.firstName).toBe("A");
    expect(mapping.lastName).toBe("B");
    expect(mapping.mvolaNumber).toBe("C");
    expect(mapping.siteShortCode).toBe("D");
  });

  it("fuzzy-maps close labels (substring / high similarity)", () => {
    const mapping = suggestColumnMapping([
      { column: "A", label: "Prenom du MOC" },
      { column: "B", label: "Nom famille" },
      { column: "C", label: "Tel Mvola" },
      { column: "D", label: "CodeSite" },
    ]);
    expect(mapping.firstName).toBe("A");
    expect(mapping.lastName).toBe("B");
    expect(mapping.mvolaNumber).toBe("C");
    expect(mapping.siteShortCode).toBe("D");
  });

  it("never assigns the same column to two fields", () => {
    const mapping = suggestColumnMapping([{ column: "A", label: "Nom" }]);
    const values = Object.values(mapping);
    expect(new Set(values).size).toBe(values.length);
  });

  it("returns empty object when labels are unrelated", () => {
    const mapping = suggestColumnMapping([
      { column: "A", label: "Couleur préférée" },
      { column: "B", label: "XYZ" },
    ]);
    expect(mapping).toEqual({});
  });
});
```

- [ ] **Step 3: Lancer les tests — doit échouer**

Run: `cd backend && npx vitest run src/__tests__/suggest-column-mapping.test.ts`

Expected: FAIL (module introuvable).

- [ ] **Step 4: Implémenter `suggest-column-mapping.ts`**

```ts
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
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[a.length]![b.length]!;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return shorter / longer;
  }
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function bestScoreForField(fieldKey: WorkerImportFieldKey, columnLabelNorm: string): number {
  const field = WORKER_IMPORT_FIELDS.find((f) => f.key === fieldKey)!;
  const candidates = [
    field.key,
    field.label,
    ...(WORKER_IMPORT_FIELD_ALIASES[fieldKey] ?? []),
  ].map(normalizeImportLabel);

  let best = 0;
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === columnLabelNorm) return 1;
    best = Math.max(best, similarity(candidate, columnLabelNorm));
  }
  return best;
}

export function suggestColumnMapping(
  columns: Array<{ column: string; label: string }>,
): Partial<Record<WorkerImportFieldKey, string>> {
  type Candidate = { fieldKey: WorkerImportFieldKey; column: string; score: number };
  const candidates: Candidate[] = [];

  for (const col of columns) {
    const labelNorm = normalizeImportLabel(col.label);
    if (!labelNorm) continue;
    for (const field of WORKER_IMPORT_FIELDS) {
      const score = bestScoreForField(field.key, labelNorm);
      if (score >= FUZZY_THRESHOLD) {
        candidates.push({ fieldKey: field.key, column: col.column, score });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.fieldKey.localeCompare(b.fieldKey));

  const mapping: Partial<Record<WorkerImportFieldKey, string>> = {};
  const usedColumns = new Set<string>();
  const usedFields = new Set<WorkerImportFieldKey>();

  for (const c of candidates) {
    if (usedFields.has(c.fieldKey) || usedColumns.has(c.column)) continue;
    mapping[c.fieldKey] = c.column;
    usedFields.add(c.fieldKey);
    usedColumns.add(c.column);
  }

  return mapping;
}
```

- [ ] **Step 5: Relancer les tests — doit passer**

Run: `cd backend && npx vitest run src/__tests__/suggest-column-mapping.test.ts`

Expected: PASS (tous les tests).

Si un cas fuzzy échoue à cause du seuil, ajuster uniquement le label de test ou `FUZZY_THRESHOLD` (±0.05) en documentant la raison dans le commit message / commentaire court.

- [ ] **Step 6: Commit (si demandé)**

```bash
git add backend/src/services/import/worker-import-fields.ts backend/src/services/import/suggest-column-mapping.ts backend/src/__tests__/suggest-column-mapping.test.ts
git commit -m "$(cat <<'EOF'
feat(import): add fuzzy column mapping suggestions for MOC Excel

EOF
)"
```

---

### Task 2: Brancher suggestedMapping sur /workers/import/columns

**Files:**
- Modify: `backend/src/services/import/workers-import.service.ts` (`DetectWorkersColumnsResult`, `detectWorkersImportColumns`)
- Modify: `backend/src/__tests__/referentials.test.ts` (ajouter un test columns)

**Interfaces:**
- Consumes: `suggestColumnMapping` from Task 1
- Produces: `DetectWorkersColumnsResult.suggestedMapping: Partial<Record<WorkerImportFieldKey, string>>`

- [ ] **Step 1: Étendre le type et la fonction de détection**

Dans `workers-import.service.ts` :

1. Importer `suggestColumnMapping` et `WorkerImportFieldKey`.
2. Remplacer l’interface :

```ts
export interface DetectWorkersColumnsResult {
  columns: DetectedColumn[];
  fields: typeof WORKER_IMPORT_FIELDS;
  suggestedMapping: Partial<Record<WorkerImportFieldKey, string>>;
}
```

3. Dans `detectWorkersImportColumns` :

```ts
export async function detectWorkersImportColumns(
  buffer: Buffer,
  hasHeaderRow: boolean,
  referenceRowNumber = 1,
): Promise<DetectWorkersColumnsResult> {
  const workbook = await loadXlsxWorkbook(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { columns: [], fields: WORKER_IMPORT_FIELDS, suggestedMapping: {} };
  }
  const columns = detectColumns(sheet, hasHeaderRow, referenceRowNumber);
  const suggestedMapping = hasHeaderRow ? suggestColumnMapping(columns) : {};
  return {
    columns,
    fields: WORKER_IMPORT_FIELDS,
    suggestedMapping,
  };
}
```

- [ ] **Step 2: Ajouter un test d’intégration columns**

Dans `referentials.test.ts`, ajouter un helper + test (près des autres tests import) :

```ts
async function buildFrenchHeaderImportBuffer() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("workers");
  sheet.addRow(["Prénom", "Nom", "Numéro MVola", "Code site"]);
  sheet.addRow(["Jean", "Rakoto", "0340000001", "MNK"]);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

it("POST /workers/import/columns returns suggestedMapping for French headers", async () => {
  const buffer = await buildFrenchHeaderImportBuffer();
  const app = createApp();
  const res = await request(app)
    .post("/api/v1/workers/import/columns")
    .set("Authorization", adminAuthHeader())
    .send({ contentBase64: buffer.toString("base64"), hasHeaderRow: true, referenceRowNumber: 1 });

  expect(res.status).toBe(200);
  expect(res.body.suggestedMapping.firstName).toBeTruthy();
  expect(res.body.suggestedMapping.lastName).toBeTruthy();
  expect(res.body.suggestedMapping.mvolaNumber).toBeTruthy();
  expect(res.body.suggestedMapping.siteShortCode).toBeTruthy();
});
```

- [ ] **Step 3: Lancer le test**

Run: `cd backend && npx vitest run src/__tests__/referentials.test.ts -t "suggestedMapping"`

Expected: PASS.

- [ ] **Step 4: Commit (si demandé)**

```bash
git add backend/src/services/import/workers-import.service.ts backend/src/__tests__/referentials.test.ts
git commit -m "$(cat <<'EOF'
feat(import): return suggestedMapping from workers import columns

EOF
)"
```

---

### Task 3: Import partiel côté API

**Files:**
- Modify: `backend/src/routes/workers.routes.ts` (bloc `POST /workers/import` commit)
- Modify: `backend/src/__tests__/referentials.test.ts`

**Interfaces:**
- Consumes: `parseWorkersWorkbook`, `importWorkersRows` (existants)
- Produces: réponse 201 `{ imported, created, updated, skippedErrors, data }` ; 422 si `valid.length === 0`

- [ ] **Step 1: Écrire les tests (échouent / comportement actuel)**

Ajouter dans `referentials.test.ts` :

```ts
it("POST /workers/import?dryRun=false imports valid rows and reports skippedErrors", async () => {
  vi.mocked(prisma.site.findMany).mockResolvedValue([
    { id: MOCK_SITE_ID, shortCode: "MNK" },
  ] as never);
  vi.mocked(prisma.worker.create).mockImplementation(async ({ data }) => ({
    id: "00000000-0000-4000-8000-000000000111",
    ...data,
  }) as never);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("workers");
  sheet.addRow(["Prénom", "Nom", "Numéro MVola", "Code site"]);
  sheet.addRow(["Jean", "Rakoto", "0340000001", "MNK"]); // valid
  sheet.addRow(["", "Rabe", "0340000002", "MNK"]); // invalid: missing firstName
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const mapping = {
    firstName: "A",
    lastName: "B",
    mvolaNumber: "C",
    siteShortCode: "D",
  };

  const app = createApp();
  const res = await request(app)
    .post("/api/v1/workers/import?dryRun=false")
    .set("Authorization", adminAuthHeader())
    .send({
      contentBase64: buffer.toString("base64"),
      hasHeaderRow: true,
      referenceRowNumber: 1,
      mapping,
    });

  expect(res.status).toBe(201);
  expect(res.body.created).toBeGreaterThanOrEqual(1);
  expect(res.body.skippedErrors).toBeGreaterThanOrEqual(1);
});

it("POST /workers/import?dryRun=false returns 422 when no valid rows", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("workers");
  sheet.addRow(["Prénom", "Nom", "Numéro MVola", "Code site"]);
  sheet.addRow(["", "Rabe", "12", "ZZ"]); // invalid
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const app = createApp();
  const res = await request(app)
    .post("/api/v1/workers/import?dryRun=false")
    .set("Authorization", adminAuthHeader())
    .send({
      contentBase64: buffer.toString("base64"),
      hasHeaderRow: true,
      referenceRowNumber: 1,
      mapping: { firstName: "A", lastName: "B", mvolaNumber: "C", siteShortCode: "D" },
    });

  expect(res.status).toBe(422);
  expect(res.body.code).toBe("IMPORT_VALIDATION_FAILED");
});
```

Note: si `parseWorkersWorkbook` avec `siteShortCode` nécessite un mock `shortCode` précis, aligner le mock `prisma.site.findMany` sur le shape réel utilisé dans `resolveSiteShortCodes` (lire la fonction avant d’écrire le mock).

- [ ] **Step 2: Lancer — le premier doit échouer (422 actuel)**

Run: `cd backend && npx vitest run src/__tests__/referentials.test.ts -t "skippedErrors|no valid rows"`

Expected: premier FAIL (status 422 au lieu de 201), second peut déjà PASS.

- [ ] **Step 3: Modifier la route commit**

Remplacer le bloc actuel :

```ts
if (preview.errors.length > 0) {
  throw new ApiError(422, "IMPORT_VALIDATION_FAILED", "Corrigez les erreurs avant import", {
    errors: preview.errors,
  });
}

const { created, updated } = await importWorkersRows(preview.valid);
await writeAuditLog({
  userId: req.user!.sub,
  action: "IMPORT",
  entityType: "Worker",
  after: { created: created.length, updated: updated.length },
  ip: req.ip,
  userAgent: req.headers["user-agent"],
});
res.status(201).json({
  imported: created.length + updated.length,
  created: created.length,
  updated: updated.length,
  data: [...created, ...updated],
});
```

Par :

```ts
if (preview.valid.length === 0) {
  throw new ApiError(422, "IMPORT_VALIDATION_FAILED", "Aucune ligne valide à importer", {
    errors: preview.errors,
  });
}

const { created, updated } = await importWorkersRows(preview.valid);
const skippedErrors = preview.errors.length;
await writeAuditLog({
  userId: req.user!.sub,
  action: "IMPORT",
  entityType: "Worker",
  after: {
    created: created.length,
    updated: updated.length,
    skippedErrors,
  },
  ip: req.ip,
  userAgent: req.headers["user-agent"],
});
res.status(201).json({
  imported: created.length + updated.length,
  created: created.length,
  updated: updated.length,
  skippedErrors,
  data: [...created, ...updated],
});
```

- [ ] **Step 4: Relancer les tests**

Run: `cd backend && npx vitest run src/__tests__/referentials.test.ts -t "import"`

Expected: PASS (y compris les anciens dry-run).

- [ ] **Step 5: Commit (si demandé)**

```bash
git add backend/src/routes/workers.routes.ts backend/src/__tests__/referentials.test.ts
git commit -m "$(cat <<'EOF'
feat(import): allow partial worker Excel import skipping invalid rows

EOF
)"
```

---

### Task 4: Types + UI ImportDialog

**Files:**
- Modify: `admin/src/lib/referentials.ts`
- Modify: `admin/src/components/workers/ImportDialog.tsx`

**Interfaces:**
- Consumes: `ImportColumnsResult.suggestedMapping`, import response `skippedErrors`
- Produces: mapping prérempli, bouton partiel, UI « Import en cours… »

- [ ] **Step 1: Mettre à jour les types**

Dans `admin/src/lib/referentials.ts` :

```ts
export interface ImportColumnsResult {
  columns: ImportDetectedColumn[];
  fields: ImportColumnField[];
  suggestedMapping?: Record<string, string>;
}

export interface ImportCommitResult {
  imported: number;
  created: number;
  updated: number;
  skippedErrors: number;
}
```

- [ ] **Step 2: Prefill mapping depuis suggestedMapping**

Dans `ImportDialog.tsx`, dans `columnsMutation.onSuccess` :

```ts
onSuccess: (data) => {
  setColumnsResult(data);
  setMapping(data.suggestedMapping ?? {});
  setStep("mapping");
},
```

Retirer le `setMapping({})` dans `loadColumns` **avant** le mutate (garder le reset preview seulement) :

```ts
function loadColumns(base64: string, withHeader: boolean, rowNumber: number) {
  setPreview(null);
  columnsMutation.mutate({ base64, withHeader, rowNumber });
}
```

- [ ] **Step 3: Étape preview — bouton partiel + pending**

Remplacer le bloc `step === "preview"` actions / importMutation :

1. Typer la mutation :

```ts
const importMutation = useMutation({
  mutationFn: async () => {
    const res = await api.post<ImportCommitResult>(
      "/workers/import?dryRun=false",
      { contentBase64, hasHeaderRow, referenceRowNumber, mapping },
    );
    return res.data;
  },
  onSuccess: (data) => {
    const skipped =
      data.skippedErrors > 0 ? `, ${data.skippedErrors} ligne(s) en erreur ignorée(s)` : "";
    toast({
      title: "Import terminé",
      description: `${data.created} créé(s), ${data.updated} mis à jour${skipped}`,
    });
    onImported();
    onOpenChange(false);
    reset();
  },
  // onError inchangé
});
```

Importer `ImportCommitResult` depuis `../../lib/referentials`.

2. Dans le JSX preview :

```tsx
{step === "preview" && preview && (
  <div className="space-y-4">
    <p className="text-sm text-zinc-700">
      {preview.valid.filter((r) => !r.existingWorkerId).length} à créer,{" "}
      {preview.valid.filter((r) => r.existingWorkerId).length} à mettre à jour (MVola déjà
      en base), {preview.errors.length} erreur(s).
    </p>
    {importMutation.isPending && (
      <p className="text-sm text-zinc-500">Import en cours…</p>
    )}
    {preview.errors.length > 0 && (
      {/* table erreurs inchangée */}
    )}
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={importMutation.isPending}
        onClick={() => setStep("mapping")}
      >
        Retour au mapping
      </Button>
      <Button
        type="button"
        disabled={!contentBase64 || preview.valid.length === 0 || importMutation.isPending}
        onClick={() => importMutation.mutate()}
      >
        Importer les {preview.valid.length} ligne(s) valide(s)
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Vérifier manuellement / typecheck**

Run: `cd admin && npx tsc --noEmit` (ou le script typecheck du package si présent).

Vérifier aussi que le bouton Continuer du mapping reste bloqué si champs requis manquants après auto-map incomplet.

- [ ] **Step 5: Commit (si demandé)**

```bash
git add admin/src/lib/referentials.ts admin/src/components/workers/ImportDialog.tsx
git commit -m "$(cat <<'EOF'
feat(admin): auto-map MOC Excel columns and allow partial import UI

EOF
)"
```

---

### Task 5: Vérification finale

**Files:** aucun nouveau fichier

- [ ] **Step 1: Suite tests backend import**

Run: `cd backend && npx vitest run src/__tests__/suggest-column-mapping.test.ts src/__tests__/referentials.test.ts`

Expected: PASS.

- [ ] **Step 2: Checklist manuelle UI**

1. Ouvrir Admin → MOC → Import Excel.
2. Charger un `.xlsx` avec en-têtes FR proches → selects préremplis.
3. Continuer → preview avec mix OK/erreurs → bouton « Importer les N ligne(s) valide(s) » actif.
4. Cliquer → « Import en cours… » puis toast avec créés / mis à jour / erreurs ignorées.
5. Fichier sans aucune ligne valide → 422 / toast erreur.

---

## Spec coverage (self-review)

| Exigence spec | Task |
|---|---|
| Fuzzy + alias suggestedMapping | 1, 2 |
| Pas d’auto-map sans header | 2 |
| Une colonne / un champ | 1 |
| Import `valid` malgré errors | 3 |
| 422 si zéro valid | 3 |
| `skippedErrors` réponse + audit | 3 |
| Prefill selects éditable | 4 |
| Bouton « Importer les X… » | 4 |
| « Import en cours… » + récap | 4 |
| Hors scope CLI / job async | respecté |

**Placeholder scan:** aucun TBD.  
**Type consistency:** `suggestedMapping`, `skippedErrors`, `ImportCommitResult` alignés front/back.
