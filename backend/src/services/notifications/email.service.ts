import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";

export interface WeeklyReportEmailInput {
  siteName: string;
  weekIso: string;
  reportKey: string;
  invoiceKey: string;
  reportUrl?: string;
  invoiceUrl?: string;
}

async function listAdminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: {
      role: Role.ADMIN,
      deletedAt: null,
      email: { not: null },
    },
    select: { email: true },
  });

  return admins.map((admin) => admin.email!).filter(Boolean);
}

async function sendViaMailgun(to: string[], subject: string, text: string): Promise<void> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM ?? `ALTERRA <noreply@${domain}>`;

  if (!apiKey || !domain) {
    logger.info({ to, subject, text }, "Email mock — Mailgun not configured");
    return;
  }

  const body = new URLSearchParams({
    from,
    to: to.join(","),
    subject,
    text,
  });

  const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    logger.warn({ status: response.status, detail }, "Mailgun send failed");
  }
}

export async function notifyAdminsWeeklyReportsReady(
  input: WeeklyReportEmailInput,
): Promise<void> {
  const recipients = await listAdminEmails();
  if (recipients.length === 0) {
    logger.warn("No admin email configured for weekly report notification");
    return;
  }

  const subject = `ALTERRA — Rapport hebdo ${input.weekIso} · ${input.siteName}`;
  const lines = [
    `Le rapport et la facture hebdomadaires pour ${input.siteName} (${input.weekIso}) sont disponibles.`,
    "",
    `Rapport : ${input.reportKey}`,
    `Facture : ${input.invoiceKey}`,
  ];

  if (input.reportUrl) lines.push(`Lien rapport : ${input.reportUrl}`);
  if (input.invoiceUrl) lines.push(`Lien facture : ${input.invoiceUrl}`);

  await sendViaMailgun(recipients, subject, lines.join("\n"));
}

export interface DailyReportEmailInput {
  siteName: string;
  date: string;
  periodIso: string;
  reportKey: string;
  reportUrl?: string;
}

export async function notifyAdminsDailyReportReady(
  input: DailyReportEmailInput,
): Promise<void> {
  const recipients = await listAdminEmails();
  if (recipients.length === 0) {
    logger.warn("No admin email configured for daily report notification");
    return;
  }

  const subject = `ALTERRA — Rapport journalier ${input.date} · ${input.siteName}`;
  const lines = [
    `Le rapport journalier pour ${input.siteName} (${input.date}, ${input.periodIso}) est disponible.`,
    "",
    `Rapport : ${input.reportKey}`,
  ];

  if (input.reportUrl) lines.push(`Lien : ${input.reportUrl}`);

  await sendViaMailgun(recipients, subject, lines.join("\n"));
}
