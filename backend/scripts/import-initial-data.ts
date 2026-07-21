#!/usr/bin/env tsx
import "dotenv/config";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { runInitialImport } from "../src/services/import/initial-import.service.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "../..");

function usage(): never {
  console.error(`Usage:
  npm run import:initial -- --dir docs/import/templates [--dry-run]
  npm run import:initial -- --sites path --activities path --workers path [--dry-run]

Options:
  --dir           Dossier contenant sites.xlsx, activities.xlsx, workers.xlsx
  --sites         Fichier Excel sites
  --activities    Fichier Excel activités
  --workers       Fichier Excel MOC
  --dry-run       Validation seule, sans écriture
  --report-dir    Dossier rapport JSON (défaut: docs/import/reports)
`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const options: {
    dir?: string;
    sites?: string;
    activities?: string;
    workers?: string;
    dryRun: boolean;
    reportDir?: string;
  } = { dryRun: false };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    switch (arg) {
      case "--dir":
        options.dir = argv[++index];
        break;
      case "--sites":
        options.sites = argv[++index];
        break;
      case "--activities":
        options.activities = argv[++index];
        break;
      case "--workers":
        options.workers = argv[++index];
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--report-dir":
        options.reportDir = argv[++index];
        break;
      case "--help":
      case "-h":
        usage();
      default:
        break;
    }
  }

  if (options.dir) {
    const base = resolve(repoRoot, options.dir);
    options.sites = join(base, "sites.xlsx");
    options.activities = join(base, "activities.xlsx");
    options.workers = join(base, "workers.xlsx");
  }

  if (!options.sites || !options.activities || !options.workers) {
    usage();
  }

  return {
    sitesFile: resolve(repoRoot, options.sites),
    activitiesFile: resolve(repoRoot, options.activities),
    workersFile: resolve(repoRoot, options.workers),
    dryRun: options.dryRun,
    reportDir: options.reportDir ? resolve(repoRoot, options.reportDir) : undefined,
  };
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log(
      `Import initial ALTERRA — dryRun=${input.dryRun}\nSites: ${input.sitesFile}\nActivités: ${input.activitiesFile}\nMOC: ${input.workersFile}`,
    );

    const result = await runInitialImport(input);

    console.log("\n--- Résultat ---");
    for (const section of result.report.sections) {
      console.log(
        `${section.file}: ${section.validCount} valide(s), ${section.importedCount} importé(s), ${section.errorCount} erreur(s)`,
      );
    }

    if (result.report.errors.length > 0) {
      console.error(`\n${result.report.errors.length} erreur(s) — import annulé après validation.`);
      for (const error of result.report.errors.slice(0, 20)) {
        console.error(
          `  [${error.sheet ?? "?"}] L${error.row} ${error.field}: ${error.message}`,
        );
      }
      process.exitCode = 1;
    } else {
      console.log(`\nSuccès${input.dryRun ? " (dry-run)" : ""}.`);
    }

    console.log(`Rapport archivé : ${result.reportPath}`);
    if (result.minioKey) console.log(`MinIO : ${result.minioKey}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
