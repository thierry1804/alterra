import { useState } from "react";
import { isAxiosError } from "axios";
import { Download } from "lucide-react";
import { api } from "../../lib/api";
import { periodToExportParam } from "../../lib/payments";
import { Button } from "../ui/button";
import { toast } from "../../hooks/use-toast";

interface MvolaExportButtonProps {
  periodIso: string;
  disabled?: boolean;
  onExported: () => void;
}

export default function MvolaExportButton({
  periodIso,
  disabled,
  onExported,
}: MvolaExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const exportPeriod = periodToExportParam(periodIso);
      const response = await api.get(`/payments/${exportPeriod}/export`, {
        responseType: "blob",
        params: { referenceYear: periodIso.match(/^(\d{4})-W/)?.[1] },
      });

      const exportedCount = response.headers["x-alterra-exported-count"];
      const excludedCount = response.headers["x-alterra-excluded-count"];
      const disposition = response.headers["content-disposition"] as string | undefined;
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? `ALTERRA_MVola_${exportPeriod}.xlsx`;

      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export MVola terminé",
        description: `${exportedCount ?? "?"} ligne(s) exportée(s)${excludedCount ? `, ${excludedCount} exclue(s)` : ""}`,
      });
      onExported();
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur export";
      toast({ title: "Export échoué", description: String(message), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" disabled={disabled || loading} onClick={() => void handleExport()}>
      <Download className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
      {loading ? "Export…" : "Export MVola"}
    </Button>
  );
}
