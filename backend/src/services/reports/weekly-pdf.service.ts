import { BUCKETS, minioClient, presignedDownloadUrl } from "../storage/minio.js";
import { notifyAdminsWeeklyReportsReady } from "../notifications/email.service.js";
import {
  htmlToPdfBuffer,
  renderWeeklyInvoiceHtml,
  renderWeeklyReportHtml,
} from "./pdf-render.service.js";
import { buildWeeklyReportViewModel, type WeeklyPdfJobInput } from "./weekly-data.service.js";

export interface WeeklyInvoiceFile {
  code: string;
  label: string;
  amount: string;
  key: string;
  url: string;
}

export interface WeeklyPdfJobResult {
  siteId: string;
  weekIso: string;
  reportKey: string;
  reportUrl: string;
  invoices: WeeklyInvoiceFile[];
}

function buildObjectKey(weekIso: string, siteCode: string, name: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `reports/${weekIso}/${siteCode}/${name}_${stamp}.pdf`;
}

async function uploadPdf(key: string, buffer: Buffer): Promise<string> {
  await minioClient.putObject(BUCKETS.reports, key, buffer, buffer.length, {
    "Content-Type": "application/pdf",
  });
  return presignedDownloadUrl(BUCKETS.reports, key);
}

export async function processWeeklyPdfJob(input: WeeklyPdfJobInput): Promise<WeeklyPdfJobResult> {
  const viewModel = await buildWeeklyReportViewModel(input);

  const reportKey = buildObjectKey(viewModel.weekIso, viewModel.site.shortCode, "rapport");
  const reportUrl = await uploadPdf(
    reportKey,
    await htmlToPdfBuffer(renderWeeklyReportHtml(viewModel)),
  );

  const invoices: WeeklyInvoiceFile[] = [];
  for (const activity of viewModel.invoiceActivities) {
    const key = buildObjectKey(
      viewModel.weekIso,
      viewModel.site.shortCode,
      `facture_${activity.code}`,
    );
    const url = await uploadPdf(
      key,
      await htmlToPdfBuffer(renderWeeklyInvoiceHtml(viewModel, activity)),
    );
    invoices.push({
      code: activity.code,
      label: activity.label,
      amount: activity.subtotal,
      key,
      url,
    });
  }

  await notifyAdminsWeeklyReportsReady({
    siteName: viewModel.site.name,
    weekIso: viewModel.weekIso,
    reportKey,
    reportUrl,
    invoices,
  });

  return {
    siteId: input.siteId,
    weekIso: viewModel.weekIso,
    reportKey,
    reportUrl,
    invoices,
  };
}
