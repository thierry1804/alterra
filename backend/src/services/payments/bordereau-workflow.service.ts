import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ISI_WITHHOLDING_RATE } from "../../lib/invoice-client.js";
import { ApiError } from "../../middleware/error-handler.js";
import { can } from "../../middleware/rbac.js";
import type { AuthUser } from "../access/auth-user.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { assertBordereauSite } from "./bordereau-access.js";
import { ensureInvoiceQuietly, getInvoiceTotals } from "./bordereau-invoice.service.js";

export interface BordereauLine {
  matricule: string;
  workerName: string;
  mvolaNumber: string;
  amount: string;
  description: string;
  bioValid: boolean;
}

const SITE_SELECT = { select: { id: true, name: true, shortCode: true } } as const;

async function liveLines(bordereauId: string): Promise<BordereauLine[]> {
  const payments = await prisma.payment.findMany({
    where: { bordereauId },
    include: {
      worker: { select: { matricule: true, firstName: true, lastName: true, mvolaNumber: true } },
    },
    orderBy: [{ worker: { lastName: "asc" } }, { worker: { firstName: "asc" } }],
  });
  return payments.map((payment) => ({
    matricule: payment.worker.matricule,
    workerName: `${payment.worker.lastName} ${payment.worker.firstName}`,
    mvolaNumber: payment.worker.mvolaNumber,
    amount: payment.amount.toString(),
    description: payment.description,
    bioValid: payment.bioValid,
  }));
}

export async function snapshotLines(bordereauId: string): Promise<Prisma.InputJsonValue> {
  return (await liveLines(bordereauId)) as unknown as Prisma.InputJsonValue;
}

async function linesOf(bordereau: { id: string; lines: Prisma.JsonValue | null }) {
  const live = await liveLines(bordereau.id);
  if (live.length > 0 || !bordereau.lines) return live;
  return bordereau.lines as unknown as BordereauLine[];
}

function totalsOf(lines: BordereauLine[]) {
  const gross = lines.reduce((sum, line) => sum.add(line.amount), new Prisma.Decimal(0));
  const isi = gross.mul(ISI_WITHHOLDING_RATE);
  return {
    gross: gross.toString(),
    isi: isi.toString(),
    net: gross.sub(isi).toString(),
    isiRate: ISI_WITHHOLDING_RATE,
  };
}

async function userNames(ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, firstName: true, lastName: true },
  });
  return new Map(users.map((user) => [user.id, `${user.lastName} ${user.firstName}`]));
}

export async function getBordereauDetail(id: string, user: AuthUser) {
  const bordereau = await prisma.bordereau.findUnique({
    where: { id },
    include: { site: SITE_SELECT },
  });
  if (!bordereau) throw new ApiError(404, "NOT_FOUND", "Bordereau introuvable");
  assertBordereauSite(user, bordereau.siteId);

  const lines = await linesOf(bordereau);
  const invoiceTotals = await getInvoiceTotals(bordereau.id);
  const versions = await prisma.bordereau.findMany({
    where: {
      siteId: bordereau.siteId,
      periodIso: bordereau.periodIso,
      referenceYear: bordereau.referenceYear,
    },
    orderBy: { version: "desc" },
  });
  const names = await userNames(
    versions.flatMap((version) => [
      version.createdById,
      version.financeValidatedById,
      version.dgValidatedById,
      version.returnedById,
    ]),
  );
  const nameOf = (userId: string | null) => (userId ? (names.get(userId) ?? null) : null);

  return {
    id: bordereau.id,
    siteId: bordereau.siteId,
    siteName: bordereau.site.name,
    siteCode: bordereau.site.shortCode,
    periodIso: bordereau.periodIso,
    referenceYear: bordereau.referenceYear,
    number: bordereau.number,
    version: bordereau.version,
    status: bordereau.status,
    lines,
    totals: invoiceTotals
      ? {
          gross: invoiceTotals.gross,
          isi: invoiceTotals.isi,
          net: invoiceTotals.net,
          isiRate: ISI_WITHHOLDING_RATE,
        }
      : totalsOf(lines),
    versions: versions.map((version) => ({
      id: version.id,
      version: version.version,
      status: version.status,
      createdAt: version.createdAt,
      createdBy: nameOf(version.createdById),
      supersededAt: version.supersededAt,
      financeValidatedAt: version.financeValidatedAt,
      financeValidatedBy: nameOf(version.financeValidatedById),
      dgValidatedAt: version.dgValidatedAt,
      dgValidatedBy: nameOf(version.dgValidatedById),
      returnReason: version.returnReason,
      returnedAt: version.returnedAt,
      returnedBy: nameOf(version.returnedById),
    })),
  };
}

async function transition(
  id: string,
  user: AuthUser,
  from: "GENERATED" | "FINANCE_VALIDATED",
  data: Prisma.BordereauUpdateManyMutationInput & {
    financeValidatedById?: string | null;
    dgValidatedById?: string | null;
    returnedById?: string | null;
  },
  action: string,
  extra: Record<string, unknown> = {},
) {
  const bordereau = await prisma.bordereau.findUnique({ where: { id } });
  if (!bordereau) throw new ApiError(404, "NOT_FOUND", "Bordereau introuvable");
  assertBordereauSite(user, bordereau.siteId);
  if (bordereau.status !== from) {
    throw new ApiError(
      409,
      "INVALID_STATE",
      "Ce bordereau n'est pas dans l'état attendu pour cette action",
    );
  }
  return {
    bordereau,
    run: async () => {
      const { count } = await prisma.bordereau.updateMany({ where: { id, status: from }, data });
      if (count !== 1) {
        throw new ApiError(
          409,
          "INVALID_STATE",
          "Ce bordereau vient d'être modifié — rafraîchissez",
        );
      }
      await writeAuditLog({
        userId: user.sub,
        action,
        entityType: "Bordereau",
        entityId: id,
        before: { status: bordereau.status, version: bordereau.version },
        after: { siteId: bordereau.siteId, periodIso: bordereau.periodIso, ...extra },
      });
    },
  };
}

export async function validateFinance(id: string, user: AuthUser) {
  const { bordereau, run } = await transition(
    id,
    user,
    "GENERATED",
    {
      status: "FINANCE_VALIDATED",
      financeValidatedById: user.sub,
      financeValidatedAt: new Date(),
      returnReason: null,
      returnedById: null,
      returnedAt: null,
    },
    "VALIDATE_BORDEREAU_FINANCE",
    { toStatus: "FINANCE_VALIDATED" },
  );
  const payments = await prisma.payment.count({ where: { bordereauId: bordereau.id } });
  if (payments === 0) {
    throw new ApiError(422, "EMPTY_BORDEREAU", "Ce bordereau ne contient aucun paiement");
  }
  await run();
}

export async function validateDg(id: string, user: AuthUser) {
  const existing = await prisma.bordereau.findUnique({ where: { id } });
  if (existing && existing.financeValidatedById === user.sub) {
    throw new ApiError(
      403,
      "SAME_VALIDATOR",
      "La deuxième validation doit être faite par une autre personne que la première",
    );
  }
  const { run } = await transition(
    id,
    user,
    "FINANCE_VALIDATED",
    { status: "DG_VALIDATED", dgValidatedById: user.sub, dgValidatedAt: new Date() },
    "VALIDATE_BORDEREAU_DG",
    { toStatus: "DG_VALIDATED" },
  );
  await run();
  await ensureInvoiceQuietly(id);
}

export async function returnBordereau(id: string, user: AuthUser, reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    throw new ApiError(422, "RETURN_REASON_REQUIRED", "Motif requis (10 caractères minimum)");
  }
  const existing = await prisma.bordereau.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Bordereau introuvable");

  if (existing.status !== "GENERATED" && existing.status !== "FINANCE_VALIDATED") {
    throw new ApiError(
      409,
      "INVALID_STATE",
      "Ce bordereau n'est pas dans l'état attendu pour cette action",
    );
  }
  const from = existing.status;
  const required =
    from === "FINANCE_VALIDATED" ? "bordereau:valider_dg" : "bordereau:valider_finance";
  if (!can(user, required)) {
    throw new ApiError(403, "FORBIDDEN", "Vous n'avez pas le droit de renvoyer ce bordereau");
  }

  const { run } = await transition(
    id,
    user,
    from,
    {
      status: "GENERATED",
      financeValidatedById: null,
      financeValidatedAt: null,
      returnReason: trimmed,
      returnedById: user.sub,
      returnedAt: new Date(),
    },
    "RETURN_BORDEREAU",
    { toStatus: "GENERATED", reason: trimmed },
  );
  await run();
}

export async function buildBordereauWorkbook(id: string, user: AuthUser) {
  const bordereau = await prisma.bordereau.findUnique({
    where: { id },
    include: { site: SITE_SELECT },
  });
  if (!bordereau) throw new ApiError(404, "NOT_FOUND", "Bordereau introuvable");
  assertBordereauSite(user, bordereau.siteId);

  const lines = await linesOf(bordereau);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Bordereau");
  sheet.columns = [
    { header: "Matricule", key: "matricule", width: 16 },
    { header: "Travailleur", key: "worker", width: 28 },
    { header: "Numéro téléphone", key: "phone", width: 18 },
    { header: "Description", key: "description", width: 40 },
    { header: "Montant", key: "amount", width: 14 },
    { header: "Bio validée", key: "bio", width: 12 },
  ];
  for (const line of lines) {
    const row = sheet.addRow({
      matricule: line.matricule,
      worker: line.workerName,
      phone: line.mvolaNumber,
      description: line.description,
      amount: Number(line.amount),
      bio: line.bioValid ? "OUI" : "NON",
    });
    row.getCell("phone").numFmt = "@";
  }
  sheet.getRow(1).font = { bold: true };

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const filename = `Bordereau_${bordereau.site.shortCode}_${bordereau.periodIso}_${bordereau.referenceYear}_n${bordereau.number}_v${bordereau.version}.xlsx`;
  return { buffer, filename };
}
