import { useState } from "react";
import { formatAr } from "../../lib/money";
import { isAxiosError } from "axios";
import { Download } from "lucide-react";
import { api } from "../../lib/api";
import { downloadBlob, filenameFromDisposition } from "../../lib/download";
import { periodToExportParam } from "../../lib/payments";
import { useCan } from "../../hooks/useCan";
import { Button } from "../ui/button";
import { toast } from "../../hooks/use-toast";

interface MvolaExportButtonProps {
  periodIso: string;
  siteId?: string;
  disabled?: boolean;
  onExported: () => void;
}

export default function MvolaExportButton({
  periodIso,
  siteId,
  disabled,
  onExported,
}: MvolaExportButtonProps) {
  const can = useCan();
  const [includeHeader, setIncludeHeader] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!can("paiement:export")) return null;

  async function handleExport() {
    setLoading(true);
    try {
      const exportPeriod = periodToExportParam(periodIso);
      const response = await api.get<Blob>(`/payments/${exportPeriod}/export`, {
        responseType: "blob",
        params: {
          referenceYear: periodIso.match(/^(\d{4})-W/)?.[1],
          includeHeader: includeHeader ? "true" : "false",
          siteId: siteId || undefined,
        },
      });

      const exportedCount = response.headers["x-alterra-exported-count"];
      const exportedTotal = response.headers["x-alterra-exported-total"];
      downloadBlob(
        response.data,
        filenameFromDisposition(
          response.headers["content-disposition"],
          `ALTERRA_MVola_${exportPeriod}.xlsx`,
        ),
      );

      toast({
        title: "Export MVola terminé",
        description: `${exportedCount ?? "?"} ligne(s) exportée(s)${exportedTotal ? `, total net ${formatAr(exportedTotal)}` : ""}`,
      });
      onExported();
    } catch (err) {
      let message = "Erreur export";
      if (isAxiosError(err)) {
        const data = err.response?.data;
        if (data instanceof Blob) {
          try {
            message = (JSON.parse(await data.text()) as { message?: string }).message ?? message;
          } catch {
            message = "Erreur export";
          }
        } else {
          message = data?.message ?? message;
        }
      }
      toast({ title: "Export échoué", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={includeHeader}
          onChange={(event) => setIncludeHeader(event.target.checked)}
        />
        Inclure l'en-tête
      </label>
      <Button
        type="button"
        variant="outline"
        onClick={() => void handleExport()}
        disabled={disabled || loading}
      >
        <Download className="h-4 w-4" />
        {loading ? "Export…" : "Export MVola"}
      </Button>
    </>
  );
}
