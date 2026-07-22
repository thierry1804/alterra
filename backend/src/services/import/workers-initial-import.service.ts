import { WorkerStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { loadXlsxWorkbook } from "./excel-workbook.js";
import {
  buildHeaderMap,
  missingHeaders,
  parseDateField,
  rowValues,
  type ImportRowError,
} from "./excel-utils.js";

export interface ValidInitialWorkerRow {
  row: number;
  matricule: string;
  firstName: string;
  lastName: string;
  mvolaNumber: string;
  siteShortCode: string;
  teamName?: string;
  cinNumber?: string;
  hiredAt: Date;
  status: WorkerStatus;
}

export interface InitialWorkersImportPreview {
  valid: ValidInitialWorkerRow[];
  errors: ImportRowError[];
}

const REQUIRED_HEADERS = [
  "matricule",
  "firstName",
  "lastName",
  "mvolaNumber",
  "siteShortCode",
  "hiredAt",
] as const;

function parseStatus(raw: string): WorkerStatus | null {
  const upper = raw.toUpperCase();
  if (upper in WorkerStatus) return upper as WorkerStatus;
  return null;
}

function detectFileDuplicates(rows: ValidInitialWorkerRow[]): ImportRowError[] {
  const errors: ImportRowError[] = [];
  const matriculeRows = new Map<string, number[]>();
  const mvolaRows = new Map<string, number[]>();

  for (const row of rows) {
    const matriculeKey = row.matricule.toLowerCase();
    const matriculeList = matriculeRows.get(matriculeKey) ?? [];
    matriculeList.push(row.row);
    matriculeRows.set(matriculeKey, matriculeList);

    const mvolaList = mvolaRows.get(row.mvolaNumber) ?? [];
    mvolaList.push(row.row);
    mvolaRows.set(row.mvolaNumber, mvolaList);
  }

  for (const [matricule, rowNumbers] of matriculeRows) {
    if (rowNumbers.length <= 1) continue;
    for (const row of rowNumbers) {
      errors.push({
        row,
        field: "matricule",
        message: `Matricule dupliqué (${matricule})`,
        sheet: "workers",
      });
    }
  }

  for (const [mvola, rowNumbers] of mvolaRows) {
    if (rowNumbers.length <= 1) continue;
    for (const row of rowNumbers) {
      errors.push({
        row,
        field: "mvolaNumber",
        message: `Numéro MVola dupliqué (${mvola})`,
        sheet: "workers",
      });
    }
  }

  return errors;
}

async function validateRowsAgainstDb(
  rows: ValidInitialWorkerRow[],
  knownSiteCodes: string[] = [],
): Promise<ImportRowError[]> {
  if (rows.length === 0) return [];

  const errors: ImportRowError[] = [];
  const siteCodes = [...new Set(rows.map((row) => row.siteShortCode))];
  const teamNames = [...new Set(rows.map((row) => row.teamName).filter(Boolean))] as string[];
  const matricules = rows.map((row) => row.matricule);
  const mvolaNumbers = rows.map((row) => row.mvolaNumber);

  const [sites, teams, existingWorkers] = await Promise.all([
    prisma.site.findMany({ where: { shortCode: { in: siteCodes } }, select: { id: true, shortCode: true } }),
    teamNames.length > 0
      ? prisma.team.findMany({
          where: { name: { in: teamNames } },
          select: { id: true, name: true, siteId: true },
        })
      : Promise.resolve([]),
    prisma.worker.findMany({
      where: {
        deletedAt: null,
        OR: [{ matricule: { in: matricules } }, { mvolaNumber: { in: mvolaNumbers } }],
      },
      select: { matricule: true, mvolaNumber: true },
    }),
  ]);

  const siteByCode = new Map(sites.map((site) => [site.shortCode, site.id]));
  for (const code of knownSiteCodes) {
    if (!siteByCode.has(code)) siteByCode.set(code, `pending:${code}`);
  }
  const teamBySiteAndName = new Map(teams.map((team) => [`${team.siteId}::${team.name}`, team.id]));
  const existingMatricules = new Set(existingWorkers.map((worker) => worker.matricule.toLowerCase()));
  const existingMvolas = new Set(existingWorkers.map((worker) => worker.mvolaNumber));

  for (const row of rows) {
    const siteId = siteByCode.get(row.siteShortCode);
    if (!siteId) {
      errors.push({
        row: row.row,
        field: "siteShortCode",
        message: `Site introuvable (${row.siteShortCode})`,
        sheet: "workers",
      });
      continue;
    }

    if (row.teamName) {
      const siteIdForTeam = siteByCode.get(row.siteShortCode);
      if (siteIdForTeam && !siteIdForTeam.startsWith("pending:")) {
        const teamKey = `${siteIdForTeam}::${row.teamName}`;
        if (!teamBySiteAndName.has(teamKey)) {
          errors.push({
            row: row.row,
            field: "teamName",
            message: `Équipe introuvable pour ce site (${row.teamName})`,
            sheet: "workers",
          });
        }
      }
    }

    if (existingMatricules.has(row.matricule.toLowerCase())) {
      errors.push({ row: row.row, field: "matricule", message: "Matricule déjà en base", sheet: "workers" });
    }
    if (existingMvolas.has(row.mvolaNumber)) {
      errors.push({ row: row.row, field: "mvolaNumber", message: "MVola déjà en base", sheet: "workers" });
    }
  }

  return errors;
}

export async function parseInitialWorkersWorkbook(
  buffer: Buffer,
  options?: { knownSiteCodes?: string[] },
): Promise<InitialWorkersImportPreview> {
  const workbook = await loadXlsxWorkbook(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return {
      valid: [],
      errors: [{ row: 0, field: "sheet", message: "Feuille Excel introuvable", sheet: "workers" }],
    };
  }

  const headerMap = buildHeaderMap(sheet);
  const errors: ImportRowError[] = missingHeaders(headerMap, REQUIRED_HEADERS).map((error) => ({
    ...error,
    sheet: "workers",
  }));
  if (errors.length > 0) return { valid: [], errors };

  const valid: ValidInitialWorkerRow[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const values = rowValues(sheet, rowNumber, headerMap);
    const hasData = Object.values(values).some((value) => value.length > 0);
    if (!hasData) continue;

    const rowErrors: ImportRowError[] = [];

    if (!values.matricule) rowErrors.push({ row: rowNumber, field: "matricule", message: "Requis", sheet: "workers" });
    if (!values.firstName) rowErrors.push({ row: rowNumber, field: "firstName", message: "Requis", sheet: "workers" });
    if (!values.lastName) rowErrors.push({ row: rowNumber, field: "lastName", message: "Requis", sheet: "workers" });
    if (!values.mvolaNumber || values.mvolaNumber.length < 9) {
      rowErrors.push({ row: rowNumber, field: "mvolaNumber", message: "Numéro MVola invalide (min 9)", sheet: "workers" });
    }

    const siteShortCode = values.siteShortCode.toUpperCase();
    if (!siteShortCode || !/^[A-Z]{2,3}$/.test(siteShortCode)) {
      rowErrors.push({ row: rowNumber, field: "siteShortCode", message: "Code site invalide", sheet: "workers" });
    }

    const hiredAt = parseDateField(values.hiredAt, rowNumber, "hiredAt", rowErrors.map((e) => ({ ...e, sheet: "workers" })));
    const statusRaw = values.status?.trim();
    const status = statusRaw ? parseStatus(statusRaw) : WorkerStatus.ACTIVE;
    if (statusRaw && !status) {
      rowErrors.push({ row: rowNumber, field: "status", message: "Statut invalide", sheet: "workers" });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    valid.push({
      row: rowNumber,
      matricule: values.matricule,
      firstName: values.firstName,
      lastName: values.lastName,
      mvolaNumber: values.mvolaNumber,
      siteShortCode,
      teamName: values.teamName || undefined,
      cinNumber: values.cinNumber || undefined,
      hiredAt: hiredAt!,
      status: status ?? WorkerStatus.ACTIVE,
    });
  }

  errors.push(...detectFileDuplicates(valid));

  const rowsWithoutFileDupes = valid.filter(
    (row) =>
      !errors.some(
        (error) =>
          error.row === row.row && (error.field === "matricule" || error.field === "mvolaNumber"),
      ),
  );

  errors.push(...(await validateRowsAgainstDb(rowsWithoutFileDupes, options?.knownSiteCodes ?? [])));

  const invalidRows = new Set(errors.map((error) => error.row));
  return { valid: valid.filter((row) => !invalidRows.has(row.row)), errors };
}

export async function importInitialWorkersRows(rows: ValidInitialWorkerRow[], dryRun: boolean) {
  if (dryRun) {
    return rows.map((row) => ({ matricule: row.matricule, action: "would_create" as const }));
  }

  const sites = await prisma.site.findMany({
    where: { shortCode: { in: [...new Set(rows.map((row) => row.siteShortCode))] } },
    select: { id: true, shortCode: true },
  });
  const siteByCode = new Map(sites.map((site) => [site.shortCode, site.id]));

  const teams = await prisma.team.findMany({
    where: { siteId: { in: sites.map((site) => site.id) } },
    select: { id: true, name: true, siteId: true },
  });
  const teamBySiteAndName = new Map(teams.map((team) => [`${team.siteId}::${team.name}`, team.id]));

  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const row of rows) {
      const siteId = siteByCode.get(row.siteShortCode)!;
      const teamId = row.teamName
        ? teamBySiteAndName.get(`${siteId}::${row.teamName}`)
        : undefined;

      const worker = await tx.worker.create({
        data: {
          matricule: row.matricule,
          firstName: row.firstName,
          lastName: row.lastName,
          mvolaNumber: row.mvolaNumber,
          siteId,
          teamId,
          cinNumber: row.cinNumber,
          hiredAt: row.hiredAt,
          status: row.status,
        },
      });
      created.push({ id: worker.id, matricule: worker.matricule, action: "created" as const });
    }
    return created;
  });
}
