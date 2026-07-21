import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUCKETS, minioClient } from "../storage/minio.js";
import type { ImportRowError } from "./excel-utils.js";

export interface ImportSectionResult {
  file: string;
  validCount: number;
  importedCount: number;
  errorCount: number;
}

export interface InitialImportReport {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  success: boolean;
  sections: ImportSectionResult[];
  errors: ImportRowError[];
  reportPath?: string;
  minioKey?: string;
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

export function defaultReportDir(): string {
  return join(repoRoot, "docs/import/reports");
}

export async function archiveImportReport(
  report: InitialImportReport,
  reportDir = defaultReportDir(),
): Promise<{ reportPath: string; minioKey?: string }> {
  await mkdir(reportDir, { recursive: true });

  const stamp = report.startedAt.replace(/[:.]/g, "-");
  const filename = `import-${stamp}.json`;
  const reportPath = join(reportDir, filename);

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");

  const minioKey = `imports/${filename}`;
  try {
    const buffer = Buffer.from(JSON.stringify(report, null, 2), "utf-8");
    await minioClient.putObject(BUCKETS.reports, minioKey, buffer, buffer.length, {
      "Content-Type": "application/json",
    });
    return { reportPath, minioKey };
  } catch {
    return { reportPath };
  }
}
