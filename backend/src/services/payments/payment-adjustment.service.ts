import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { isiSettingsOf, lineGross, lineIsi, type IsiSettings } from "../../lib/isi.js";
import { ApiError } from "../../middleware/error-handler.js";
import type { AuthUser } from "../access/auth-user.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { assertBordereauSite } from "./bordereau-access.js";
import { ensureInvoiceQuietly } from "./bordereau-invoice.service.js";

const REASON_MIN_LENGTH = 10;

function settingsOf(bordereau: {
  isiRate: Prisma.Decimal.Value;
  amountDecimals: number;
}): IsiSettings {
  return isiSettingsOf(bordereau);
}

async function loadAdjustablePayment(paymentId: string, actor: AuthUser) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { bordereauRef: true },
  });
  if (!payment) throw new ApiError(404, "NOT_FOUND", "Paiement introuvable");
  const bordereau = payment.bordereauRef;
  if (!bordereau) {
    throw new ApiError(409, "NO_BORDEREAU", "Ce paiement n'est rattaché à aucun bordereau");
  }
  assertBordereauSite(actor, bordereau.siteId);
  if (payment.status !== "PENDING" || bordereau.status !== "GENERATED") {
    throw new ApiError(
      409,
      "ADJUSTMENT_LOCKED",
      "Ajustement impossible : le bordereau est déjà validé, exporté ou remplacé",
    );
  }
  return { payment, bordereau };
}

function applyTo(
  payment: { amount: Prisma.Decimal; isiAmount: Prisma.Decimal },
  amount: Prisma.Decimal,
  settings: IsiSettings,
) {
  // Même règle que la génération : l'ajustement est arrondi au réglage, puis son ISI calculé dessus.
  const adjustment = lineGross(amount, settings);
  const gross = payment.amount.add(adjustment);
  const isi = payment.isiAmount.add(lineIsi(adjustment, settings));
  return { gross, isi, net: gross.sub(isi) };
}

export async function addAdjustment(
  paymentId: string,
  actor: AuthUser,
  input: { amount: number; reason: string },
) {
  const reason = input.reason.trim();
  if (reason.length < REASON_MIN_LENGTH) {
    throw new ApiError(422, "REASON_REQUIRED", "Motif requis (10 caractères minimum)");
  }
  const amount = new Prisma.Decimal(input.amount);
  if (amount.isZero()) {
    throw new ApiError(422, "INVALID_AMOUNT", "Le montant de l'ajustement ne peut pas être nul");
  }

  const { payment, bordereau } = await loadAdjustablePayment(paymentId, actor);
  const next = applyTo(payment, amount, settingsOf(bordereau));
  if (!next.gross.gt(0) || !next.net.gt(0)) {
    throw new ApiError(
      422,
      "INVALID_AMOUNT",
      "Le montant du paiement doit rester positif après l'ajustement",
    );
  }

  const adjustment = await prisma.$transaction(async (tx) => {
    const created = await tx.paymentAdjustment.create({
      data: {
        paymentId,
        bordereauId: bordereau.id,
        amount,
        reason,
        createdById: actor.sub,
      },
    });
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        amount: next.gross,
        isiAmount: next.isi,
        netAmount: next.net,
        originalAmount: payment.originalAmount ?? payment.amount,
      },
    });
    return created;
  });

  await writeAuditLog({
    userId: actor.sub,
    action: "ADJUST_PAYMENT",
    entityType: "Payment",
    entityId: paymentId,
    before: { amount: payment.amount.toString(), netAmount: payment.netAmount.toString() },
    after: {
      bordereauId: bordereau.id,
      adjustment: amount.toString(),
      reason,
      amount: next.gross.toString(),
      netAmount: next.net.toString(),
    },
  });

  await ensureInvoiceQuietly(bordereau.id, true, "Ajustement de paiement");
  return adjustment;
}

export async function removeAdjustment(adjustmentId: string, actor: AuthUser) {
  const adjustment = await prisma.paymentAdjustment.findUnique({ where: { id: adjustmentId } });
  if (!adjustment) throw new ApiError(404, "NOT_FOUND", "Ajustement introuvable");

  const { payment, bordereau } = await loadAdjustablePayment(adjustment.paymentId, actor);
  const next = applyTo(payment, adjustment.amount.neg(), settingsOf(bordereau));
  if (!next.gross.gt(0) || !next.net.gt(0)) {
    throw new ApiError(
      422,
      "INVALID_AMOUNT",
      "Le montant du paiement doit rester positif après le retrait de l'ajustement",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentAdjustment.delete({ where: { id: adjustmentId } });
    await tx.payment.update({
      where: { id: payment.id },
      data: { amount: next.gross, isiAmount: next.isi, netAmount: next.net },
    });
  });

  await writeAuditLog({
    userId: actor.sub,
    action: "REMOVE_PAYMENT_ADJUSTMENT",
    entityType: "Payment",
    entityId: payment.id,
    before: { adjustment: adjustment.amount.toString(), reason: adjustment.reason },
    after: { bordereauId: bordereau.id, amount: next.gross.toString() },
  });

  await ensureInvoiceQuietly(bordereau.id, true, "Suppression d'un ajustement");
}
