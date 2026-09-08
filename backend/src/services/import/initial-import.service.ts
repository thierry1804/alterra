import { readFile } from "node:fs/promises";
import { prisma } from "../../lib/prisma.js";
import {
  parseActivitiesWorkbook,
  type ValidActivityRow,
} from "./activities-import.service.js";
import type { ImportRowError } from "./excel-utils.js";
import {
  archiveImportReport,
  type ImportSectionResult,
  type InitialImportReport,
} from "./import-report.service.js";
import { parseSitesWorkbook, type ValidSiteRow } from "./sites-import.service.js";
import {
  parseInitialWorkersWorkbook,
  type ValidInitialWorkerRow,
} from "./workers-initial-import.service.js";

export interface InitialImportInput {
  sitesFile: string;
  activitiesFile: string;
  workersFile: string;
  dryRun?: boolean;
  reportDir?: string;
}

export interface InitialImportOutput {
  report: InitialImportReport;
  reportPath: string;
  minioKey?: string;
}

async function loadFile(path: string): Promise<Buffer> {
  return readFile(path);
}

function sectionResult(
  file: string,
  validCount: number,
  importedCount: number,
  errorCount: number,
): ImportSectionResult {
  return { file, validCount, importedCount, errorCount };
}

async function commitImport(
  sites: ValidSiteRow[],
  activities: ValidActivityRow[],
  workers: ValidInitialWorkerRow[],
) {
  return prisma.$transaction(async (tx) => {
    const siteResults = [];
    for (const row of sites) {
      const site = await tx.site.upsert({
        where: { shortCode: row.shortCode },
        update: { name: row.name, location: row.location ?? null },
        create: {
          shortCode: row.shortCode,
          name: row.name,
          location: row.location ?? null,
        },
      });
      siteResults.push(site);
    }

    const siteByCode = new Map(siteResults.map((site) => [site.shortCode, site.id]));

    const activityResults = [];
    for (const row of activities) {
      const activity = await tx.activity.create({
        data: {
          label: row.label,
          unit: row.unit,
          unitRate: row.unitRate,
          validFrom: row.validFrom,
          siteId: row.siteShortCode ? siteByCode.get(row.siteShortCode) ?? null : null,
        },
      });
      activityResults.push(activity);
    }

    const teams = await tx.team.findMany({
      where: { siteId: { in: [...siteByCode.values()] } },
      select: { id: true, name: true, siteId: true },
    });
    const teamBySiteAndName = new Map(teams.map((team) => [`${team.siteId}::${team.name}`, team.id]));

    const workerResults = [];
    for (const row of workers) {
      const siteId = siteByCode.get(row.siteShortCode)!;
      const worker = await tx.worker.create({
        data: {
          matricule: row.matricule,
          legacyMocId: row.legacyMocId,
          firstName: row.firstName,
          lastName: row.lastName,
          mvolaNumber: row.mvolaNumber,
          siteId,
          teamId: row.teamName ? teamBySiteAndName.get(`${siteId}::${row.teamName}`) : undefined,
          cinNumber: row.cinNumber,
          hiredAt: row.hiredAt,
          status: row.status,
        },
      });
      workerResults.push(worker);
    }

    return {
      sites: siteResults.length,
      activities: activityResults.length,
      workers: workerResults.length,
    };
  });
}

export async function runInitialImport(input: InitialImportInput): Promise<InitialImportOutput> {
  const startedAt = new Date().toISOString();
  const dryRun = input.dryRun ?? false;

  const [sitesBuffer, activitiesBuffer, workersBuffer] = await Promise.all([
    loadFile(input.sitesFile),
    loadFile(input.activitiesFile),
    loadFile(input.workersFile),
  ]);

  const sitesPreview = await parseSitesWorkbook(sitesBuffer);
  const knownSiteCodes = sitesPreview.valid.map((row) => row.shortCode);

  const [activitiesPreview, workersPreview] = await Promise.all([
    parseActivitiesWorkbook(activitiesBuffer, { knownSiteCodes }),
    parseInitialWorkersWorkbook(workersBuffer, { knownSiteCodes }),
  ]);

  const allErrors: ImportRowError[] = [
    ...sitesPreview.errors,
    ...activitiesPreview.errors,
    ...workersPreview.errors,
  ];

  const sections: ImportSectionResult[] = [
    sectionResult(
      input.sitesFile,
      sitesPreview.valid.length,
      0,
      sitesPreview.errors.length,
    ),
    sectionResult(
      input.activitiesFile,
      activitiesPreview.valid.length,
      0,
      activitiesPreview.errors.length,
    ),
    sectionResult(
      input.workersFile,
      workersPreview.valid.length,
      0,
      workersPreview.errors.length,
    ),
  ];

  let imported = { sites: 0, activities: 0, workers: 0 };

  if (allErrors.length === 0) {
    if (dryRun) {
      imported = {
        sites: sitesPreview.valid.length,
        activities: activitiesPreview.valid.length,
        workers: workersPreview.valid.length,
      };
    } else {
      const result = await commitImport(
        sitesPreview.valid,
        activitiesPreview.valid,
        workersPreview.valid,
      );
      imported = result;
    }

    sections[0]!.importedCount = imported.sites;
    sections[1]!.importedCount = imported.activities;
    sections[2]!.importedCount = imported.workers;
  }

  const finishedAt = new Date().toISOString();
  const report: InitialImportReport = {
    startedAt,
    finishedAt,
    dryRun,
    success: allErrors.length === 0,
    sections,
    errors: allErrors,
  };

  const archived = await archiveImportReport(report, input.reportDir);
  report.reportPath = archived.reportPath;
  report.minioKey = archived.minioKey;

  return {
    report,
    reportPath: archived.reportPath,
    minioKey: archived.minioKey,
  };
}
