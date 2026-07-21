import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Download } from "lucide-react";
import { api } from "../lib/api";
import type { Site } from "../lib/referentials";
import {
  REPORT_DEFINITIONS,
  currentMonthInput,
  type ReportExportFormat,
  type ReportPreview,
  type ReportType,
} from "../lib/reports";
import PageHeader from "../components/shared/PageHeader";
import ReportPreviewTable from "../components/reports/ReportPreviewTable";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "../hooks/use-toast";

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("pointages");
  const [month, setMonth] = useState(currentMonthInput());
  const [siteId, setSiteId] = useState("");
  const [exporting, setExporting] = useState<ReportExportFormat | null>(null);

  const { data: sites = [] } = useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
  });

  const selectedDefinition = useMemo(
    () => REPORT_DEFINITIONS.find((item) => item.type === reportType),
    [reportType],
  );

  const previewQuery = useQuery({
    queryKey: ["reports-preview", reportType, month, siteId],
    queryFn: () =>
      api
        .get<ReportPreview>("/reports/preview", {
          params: {
            type: reportType,
            month,
            siteId: siteId || undefined,
          },
        })
        .then((r) => r.data),
    enabled: !!month,
  });

  async function handleExport(format: ReportExportFormat) {
    setExporting(format);
    try {
      const response = await api.get("/reports/export", {
        responseType: "blob",
        params: {
          type: reportType,
          month,
          siteId: siteId || undefined,
          format,
        },
      });

      const disposition = response.headers["content-disposition"] as string | undefined;
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename =
        filenameMatch?.[1] ??
        `ALTERRA_${reportType}_${month}.${format === "pdf" ? "html" : format}`;

      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export terminé",
        description:
          format === "pdf"
            ? "Rapport HTML téléchargé (imprimable en PDF)."
            : `Fichier ${format.toUpperCase()} généré.`,
      });
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur export";
      toast({ title: "Export échoué", description: String(message), variant: "destructive" });
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports"
        description="Rapports prédéfinis avec filtres période et exports."
      />

      <div className="grid gap-3 md:grid-cols-3">
        {REPORT_DEFINITIONS.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => setReportType(item.type)}
            className={`rounded-md border p-4 text-left transition-colors ${
              reportType === item.type
                ? "border-zinc-400 bg-zinc-100"
                : "border-zinc-200 bg-white hover:bg-zinc-50"
            }`}
          >
            <p className="text-sm font-medium text-zinc-900">{item.title}</p>
            <p className="mt-1 text-xs text-zinc-600">{item.description}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-md border border-zinc-200 bg-white p-4">
        <div className="space-y-1">
          <Label htmlFor="report-month">Mois</Label>
          <Input
            id="report-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="report-site">Site</Label>
          <select
            id="report-site"
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
            className="h-9 w-48 rounded-md border border-zinc-300 bg-white px-3 text-sm"
          >
            <option value="">Tous les sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.shortCode} — {site.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!!exporting}
            onClick={() => void handleExport("csv")}
          >
            <Download className="h-4 w-4" />
            {exporting === "csv" ? "Export…" : "CSV"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!!exporting}
            onClick={() => void handleExport("xlsx")}
          >
            <Download className="h-4 w-4" />
            {exporting === "xlsx" ? "Export…" : "Excel"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!!exporting}
            onClick={() => void handleExport("pdf")}
          >
            <Download className="h-4 w-4" />
            {exporting === "pdf" ? "Export…" : "PDF"}
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-zinc-900">
            {selectedDefinition?.title ?? "Aperçu"}
          </h2>
          {previewQuery.data?.meta.rowCount !== undefined && (
            <span className="text-xs text-zinc-500">
              {previewQuery.data.meta.rowCount} ligne(s)
            </span>
          )}
        </div>
        <ReportPreviewTable report={previewQuery.data} loading={previewQuery.isLoading} />
      </section>
    </div>
  );
}
