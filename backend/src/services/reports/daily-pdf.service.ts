import { BUCKETS, minioClient, presignedDownloadUrl } from "../storage/minio.js";
import { notifyAdminsDailyReportReady } from "../notifications/email.service.js";
import { htmlToPdfBuffer, renderDailyReportHtml } from "./pdf-render.service.js";
import {
  buildDailyReportViewModel,
  type DailyPdfJobInput,
} from "./daily-data.service.js";

export interface DailyPdfJobResult {
  siteId: string;
  date: string;
  periodIso: string;
  reportKey: string;
  reportUrl: string;
}

function buildObjectKey(date: string, siteCode: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return `reports/daily/${date}/${siteCode}/rapport_${stamp}.pdf`;
}

export async function processDailyPdfJob(input: DailyPdfJobInput): Promise<DailyPdfJobResult> {
  const viewModel = await buildDailyReportViewModel(input);
  const reportHtml = renderDailyReportHtml(viewModel);
  const reportBuffer = await htmlToPdfBuffer(reportHtml);
  const reportKey = buildObjectKey(viewModel.date, viewModel.site.shortCode);

  await minioClient.putObject(BUCKETS.reports, reportKey, reportBuffer, reportBuffer.length, {
    "Content-Type": "application/pdf",
  });

  const reportUrl = await presignedDownloadUrl(BUCKETS.reports, reportKey);

  await notifyAdminsDailyReportReady({
    siteName: viewModel.site.name,
    date: viewModel.date,
    periodIso: viewModel.periodIso,
    reportKey,
    reportUrl,
  });

  return {
    siteId: input.siteId,
    date: viewModel.date,
    periodIso: viewModel.periodIso,
    reportKey,
    reportUrl,
  };
}
