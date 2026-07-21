import { BUCKETS, minioClient, presignedDownloadUrl } from "../storage/minio.js";
import { notifyAdminsWeeklyReportsReady } from "../notifications/email.service.js";
import {
  htmlToPdfBuffer,
  renderWeeklyInvoiceHtml,
  renderWeeklyReportHtml,
} from "./pdf-render.service.js";
import {
  buildWeeklyReportViewModel,
  type WeeklyPdfJobInput,
} from "./weekly-data.service.js";

export interface WeeklyPdfJobResult {
  siteId: string;
  weekIso: string;
  reportKey: string;
  invoiceKey: string;
  reportUrl: string;
  invoiceUrl: string;
}

function buildObjectKey(weekIso: string, siteCode: string, kind: "rapport" | "facture"): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `reports/${weekIso}/${siteCode}/${kind}_${stamp}.pdf`;
}

export async function processWeeklyPdfJob(
  input: WeeklyPdfJobInput,
): Promise<WeeklyPdfJobResult> {
  const viewModel = await buildWeeklyReportViewModel(input);

  const [reportHtml, invoiceHtml] = [
    renderWeeklyReportHtml(viewModel),
    renderWeeklyInvoiceHtml(viewModel),
  ];

  const [reportBuffer, invoiceBuffer] = await Promise.all([
    htmlToPdfBuffer(reportHtml),
    htmlToPdfBuffer(invoiceHtml),
  ]);

  const reportKey = buildObjectKey(viewModel.weekIso, viewModel.site.shortCode, "rapport");
  const invoiceKey = buildObjectKey(viewModel.weekIso, viewModel.site.shortCode, "facture");

  await Promise.all([
    minioClient.putObject(BUCKETS.reports, reportKey, reportBuffer, reportBuffer.length, {
      "Content-Type": "application/pdf",
    }),
    minioClient.putObject(BUCKETS.reports, invoiceKey, invoiceBuffer, invoiceBuffer.length, {
      "Content-Type": "application/pdf",
    }),
  ]);

  const [reportUrl, invoiceUrl] = await Promise.all([
    presignedDownloadUrl(BUCKETS.reports, reportKey),
    presignedDownloadUrl(BUCKETS.reports, invoiceKey),
  ]);

  await notifyAdminsWeeklyReportsReady({
    siteName: viewModel.site.name,
    weekIso: viewModel.weekIso,
    reportKey,
    invoiceKey,
    reportUrl,
    invoiceUrl,
  });

  return {
    siteId: input.siteId,
    weekIso: viewModel.weekIso,
    reportKey,
    invoiceKey,
    reportUrl,
    invoiceUrl,
  };
}
