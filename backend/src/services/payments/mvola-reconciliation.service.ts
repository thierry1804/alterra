import { Prisma, PaymentStatus, PaymentReconciliationStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { classifyMvolaRow, parseFeeReference, parseSalaryLabel } from "./mvola-classify.service.js";
import {
  normalizeMvolaAmount,
  parseMvolaReleveWorkbook,
  type ParseMvolaReleveOptions,
} from "./mvola-releve-parser.service.js";

export interface MvolaReconciliationConfirme {
  paymentId: string;
  worker: string;
  reference: string;
  montant: string;
}

export interface MvolaReconciliationEcart {
  paymentId: string;
  worker: string;
  reference: string;
  montantReleve: number;
  montantAttendu: string;
}

export interface MvolaReconciliationOrphelin {
  reference: string;
  description: string | null;
  montant: number;
}

export interface MvolaReconciliationNonConfirme {
  paymentId: string;
  worker: string;
  periodIso: string;
  bordereau: number;
  montant: string;
}

export interface MvolaReconciliationDejaTraite {
  paymentId: string;
  reference: string;
}

export interface MvolaReconciliationResult {
  confirme: number;
  ecartMontant: number;
  orphelin: number;
  nonConfirme: number;
  dejaTraite: number;
  fraisRattaches: number;
  internal: number;
  ignored: number;
  confirmes: MvolaReconciliationConfirme[];
  ecarts: MvolaReconciliationEcart[];
  orphelins: MvolaReconciliationOrphelin[];
  nonConfirmes: MvolaReconciliationNonConfirme[];
  dejaTraites: MvolaReconciliationDejaTraite[];
}

function periodWeekNumber(periodIso: string): number {
  return Number(periodIso.replace(/^S/i, ""));
}

/**
 * Clé « année:semaine » d'une ligne du relevé. L'année est celle de la date d'exécution, sauf autour du 1er janvier :
 * une semaine 50 et plus payée en janvier ou février appartient à l'année précédente, une semaine 1 ou 2 payée en
 * décembre à l'année suivante. Sans date lisible, l'année est inconnue (`?`) et seul le numéro de semaine compte.
 */
export function weekKey(semaine: number, executedAt: Date): string {
  if (Number.isNaN(executedAt.getTime())) return `?:${semaine}`;
  let year = executedAt.getFullYear();
  const month = executedAt.getMonth();
  if (semaine >= 50 && month <= 1) year -= 1;
  else if (semaine <= 2 && month === 11) year += 1;
  return `${year}:${semaine}`;
}

function buildKey(site: string, semaine: number, bordereau: number, suffix: string): string {
  return `${site.toLowerCase()}|${semaine}|${bordereau}|${suffix}`;
}

type CandidatePayment = Prisma.PaymentGetPayload<{
  include: { worker: { include: { site: true } } };
}>;

function workerLabel(payment: CandidatePayment): string {
  return `${payment.worker.firstName} ${payment.worker.lastName} (${payment.worker.matricule})`;
}

function keysForPayment(payment: CandidatePayment): string[] {
  const semaine = periodWeekNumber(payment.periodIso);
  const site = payment.worker.site.shortCode;
  const keys = [buildKey(site, semaine, payment.bordereau, `t${payment.worker.mvolaNumber}`)];
  if (payment.worker.legacyMocId != null) {
    keys.push(buildKey(site, semaine, payment.bordereau, `m${payment.worker.legacyMocId}`));
  }
  return keys;
}

export async function reconcileMvolaReleve(
  buffer: Buffer,
  options: ParseMvolaReleveOptions & {
    /** Aperçu : calcule le rapprochement sans rien écrire en base. */
    dryRun?: boolean;
  } = {},
): Promise<MvolaReconciliationResult> {
  const { dryRun = false, ...parseOptions } = options;
  const writePayment = async (args: Prisma.PaymentUpdateArgs): Promise<void> => {
    if (!dryRun) await prisma.payment.update(args);
  };
  const rows = parseMvolaReleveWorkbook(buffer, parseOptions);

  const candidates = await prisma.payment.findMany({
    where: { status: PaymentStatus.EXPORTED },
    include: { worker: { include: { site: true } } },
  });

  const index = new Map<string, CandidatePayment>();
  for (const payment of candidates) {
    for (const key of keysForPayment(payment)) index.set(key, payment);
  }

  const existingReferences = await prisma.payment.findMany({
    where: { mvolaReference: { not: null } },
    select: { id: true, mvolaReference: true },
  });
  const referenceIndex = new Map(existingReferences.map((p) => [p.mvolaReference as string, p.id]));

  const touched = new Set<string>();
  const weeksInFile = new Set<string>();
  const result: MvolaReconciliationResult = {
    confirme: 0,
    ecartMontant: 0,
    orphelin: 0,
    nonConfirme: 0,
    dejaTraite: 0,
    fraisRattaches: 0,
    internal: 0,
    ignored: 0,
    confirmes: [],
    ecarts: [],
    orphelins: [],
    nonConfirmes: [],
    dejaTraites: [],
  };

  const salaryRows = rows
    .map((row) => ({ row, cls: classifyMvolaRow(row) }))
    .filter(({ cls }) => cls === "SALARY" || cls === "INTERNAL" || cls === "IGNORED");

  for (const { row, cls } of salaryRows) {
    if (cls === "INTERNAL") {
      result.internal += 1;
      continue;
    }
    if (cls === "IGNORED") {
      result.ignored += 1;
      continue;
    }

    const label = parseSalaryLabel(row.description ?? "");
    if (!label) continue;

    const executedAt = new Date(row.dateHeure.replace(" ", "T"));
    weeksInFile.add(weekKey(label.semaine, executedAt));

    if (referenceIndex.has(row.reference)) {
      result.dejaTraite += 1;
      result.dejaTraites.push({
        paymentId: referenceIndex.get(row.reference)!,
        reference: row.reference,
      });
      continue;
    }

    const montantReleve = Math.abs(normalizeMvolaAmount(row.montant));
    const key =
      label.matricule != null
        ? buildKey(label.site, label.semaine, label.bordereau, `m${label.matricule}`)
        : buildKey(
            label.site,
            label.semaine,
            label.bordereau,
            `t${row.destinataire.replace(/^'/, "").trim()}`,
          );

    const payment = index.get(key);
    if (!payment) {
      result.orphelin += 1;
      result.orphelins.push({
        reference: row.reference,
        description: row.description,
        montant: montantReleve,
      });
      continue;
    }

    touched.add(payment.id);
    const montantAttendu = new Prisma.Decimal(montantReleve);

    if (montantAttendu.equals(payment.amount)) {
      await writePayment({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          reconciliationStatus: PaymentReconciliationStatus.CONFIRME,
          mvolaReference: row.reference,
          mvolaExecutedAt: executedAt,
          paidAt: executedAt,
        },
      });
      referenceIndex.set(row.reference, payment.id);
      result.confirme += 1;
      result.confirmes.push({
        paymentId: payment.id,
        worker: workerLabel(payment),
        reference: row.reference,
        montant: payment.amount.toString(),
      });
    } else {
      await writePayment({
        where: { id: payment.id },
        data: {
          reconciliationStatus: PaymentReconciliationStatus.ECART_MONTANT,
          mvolaReference: row.reference,
          mvolaExecutedAt: executedAt,
        },
      });
      referenceIndex.set(row.reference, payment.id);
      result.ecarts.push({
        paymentId: payment.id,
        worker: workerLabel(payment),
        reference: row.reference,
        montantReleve,
        montantAttendu: payment.amount.toString(),
      });
      result.ecartMontant += 1;
    }
  }

  for (const row of rows) {
    if (classifyMvolaRow(row) !== "FEE") continue;
    const reference = parseFeeReference(row.type);
    const paymentId = reference ? referenceIndex.get(reference) : undefined;
    if (!paymentId) continue;

    await writePayment({
      where: { id: paymentId },
      data: { transferFee: Math.abs(normalizeMvolaAmount(row.montant)) },
    });
    result.fraisRattaches += 1;
  }

  for (const payment of candidates) {
    if (touched.has(payment.id)) continue;
    // Seuls les paiements de la semaine ET de l'année couvertes par le relevé peuvent être « non confirmés ».
    const week = periodWeekNumber(payment.periodIso);
    const year = payment.referenceYear ?? payment.createdAt?.getFullYear();
    const covered =
      year === undefined
        ? [...weeksInFile].some((key) => key.endsWith(`:${week}`))
        : weeksInFile.has(`${year}:${week}`) || weeksInFile.has(`?:${week}`);
    if (!covered) continue;

    await writePayment({
      where: { id: payment.id },
      data: { reconciliationStatus: PaymentReconciliationStatus.NON_CONFIRME },
    });
    result.nonConfirme += 1;
    result.nonConfirmes.push({
      paymentId: payment.id,
      worker: workerLabel(payment),
      periodIso: payment.periodIso,
      bordereau: payment.bordereau,
      montant: payment.amount.toString(),
    });
  }

  return result;
}
