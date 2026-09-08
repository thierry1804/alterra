#!/usr/bin/env tsx
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const templatesDir = join(repoRoot, "docs/import/templates");

async function writeWorkbook(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  notes: string[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("data");

  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row);
  }

  const readme = workbook.addWorksheet("README");
  readme.addRow(["Colonne", "Obligatoire", "Description"]);
  readme.getRow(1).font = { bold: true };
  for (const note of notes) {
    const [column, required, description] = note.split("|");
    readme.addRow([column, required, description]);
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await writeFile(join(templatesDir, filename), buffer);
}

async function main() {
  await mkdir(templatesDir, { recursive: true });

  await writeWorkbook(
    "sites.xlsx",
    ["shortCode", "name", "location"],
    [
      ["MNK", "Manankazo", "Région A"],
      ["ANT", "Antsampanana", "Région B"],
    ],
    [
      "shortCode|Oui|Code site 2-3 lettres majuscules (ex. MNK)",
      "name|Oui|Nom du site",
      "location|Non|Localisation texte libre",
    ],
  );

  await writeWorkbook(
    "activities.xlsx",
    ["label", "unit", "unitRate", "validFrom", "siteShortCode"],
    [
      ["Plantation", "plant", 250, "2026-01-01", "MNK"],
      ["Désherbage", "m2", 150, "2026-01-01", ""],
    ],
    [
      "label|Oui|Libellé activité",
      "unit|Oui|Unité (plant, m2, trou, kg…)",
      "unitRate|Oui|Tarif unitaire en Ariary",
      "validFrom|Oui|Date début validité (YYYY-MM-DD)",
      "siteShortCode|Non|Code site ou vide = activité globale",
    ],
  );

  await writeWorkbook(
    "workers.xlsx",
    [
      "matricule",
      "legacyMocId",
      "firstName",
      "lastName",
      "mvolaNumber",
      "siteShortCode",
      "teamName",
      "hiredAt",
      "cinNumber",
      "status",
    ],
    [
      ["MOC-MNK-01", "", "Jean", "Rakoto", "0340000001", "MNK", "MNK-1", "2025-01-01", "", "ACTIVE"],
      ["MOC-MNK-02", "", "Marie", "Rasoa", "0340000002", "MNK", "MNK-1", "2025-01-01", "", "ACTIVE"],
    ],
    [
      "matricule|Oui|Identifiant unique MOC",
      "legacyMocId|Non|ID MOT du fichier MOC historique (nombre), doublons possibles",
      "firstName|Oui|Prénom",
      "lastName|Oui|Nom",
      "mvolaNumber|Oui|Numéro MVola (min 9 chiffres, format texte)",
      "siteShortCode|Oui|Code site existant",
      "teamName|Non|Nom équipe existante sur le site",
      "hiredAt|Oui|Date embauche (YYYY-MM-DD)",
      "cinNumber|Non|Numéro CIN",
      "status|Non|ACTIVE ou INACTIVE (défaut ACTIVE)",
    ],
  );

  await writeFile(
    join(templatesDir, "README.md"),
    `# Templates import campagne ALTERRA

Fichiers générés par \`npm run import:templates -w backend\`.

| Fichier | Contenu |
| ------- | ------- |
| \`sites.xlsx\` | Sites (shortCode, name, location) |
| \`activities.xlsx\` | Activités et tarifs |
| \`workers.xlsx\` | MOC (matricule, MVola, site, équipe) |

## Import

\`\`\`bash
npm run import:initial -w backend -- --dir docs/import/templates --dry-run
npm run import:initial -w backend -- --dir docs/import/templates
\`\`\`

Ordre d'import : sites → activités → MOC. Le rapport JSON est archivé dans \`docs/import/reports/\` et MinIO (\`rapports-pdf/imports/\`).
`,
    "utf-8",
  );

  console.log(`Templates générés dans ${templatesDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
