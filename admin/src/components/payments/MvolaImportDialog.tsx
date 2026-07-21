import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { isAxiosError } from "axios";
import { Upload } from "lucide-react";
import { api } from "../../lib/api";
import type { ImportMvolaResult } from "../../lib/payments";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { toast } from "../../hooks/use-toast";

interface MvolaImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodIso: string;
  onImported: () => void;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export default function MvolaImportDialog({
  open,
  onOpenChange,
  periodIso,
  onImported,
}: MvolaImportDialogProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportMvolaResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setFileName(null);
    setResult(null);
  }, []);

  const importMutation = useMutation({
    mutationFn: async (base64: string) => {
      const res = await api.post<ImportMvolaResult>("/payments/import-status", {
        periodIso,
        contentBase64: base64,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Import terminé",
        description: `${data.paid} payé(s), ${data.failed} échec(s)`,
      });
      onImported();
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Import échoué", description: String(message), variant: "destructive" });
    },
  });

  async function handleFile(file: File) {
    if (!file.name.endsWith(".xlsx")) {
      toast({ title: "Format invalide", description: ".xlsx requis", variant: "destructive" });
      return;
    }
    setFileName(file.name);
    setResult(null);
    const base64 = await fileToBase64(file);
    importMutation.mutate(base64);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import retour MVola</DialogTitle>
          <DialogDescription>
            Période {periodIso} — fichier retour portail marchand.
          </DialogDescription>
        </DialogHeader>

        <label
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center ${
            dragOver ? "border-zinc-500 bg-zinc-50" : "border-zinc-300"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
        >
          <Upload className="mb-2 h-5 w-5 text-zinc-400" />
          <span className="text-sm text-zinc-700">Glisser le retour MVola (.xlsx)</span>
          {fileName && <span className="mt-1 text-xs text-zinc-500">{fileName}</span>}
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>

        {importMutation.isPending && (
          <p className="text-sm text-zinc-500">Traitement en cours…</p>
        )}

        {result && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 rounded-md border border-zinc-200 p-3">
              <div>
                <p className="text-zinc-500">Payés</p>
                <p className="text-lg font-semibold text-emerald-700">{result.paid}</p>
              </div>
              <div>
                <p className="text-zinc-500">Échecs</p>
                <p className="text-lg font-semibold text-red-700">{result.failed}</p>
              </div>
              <div>
                <p className="text-zinc-500">Non matchés</p>
                <p className="text-lg font-semibold">{result.unmatched.length}</p>
              </div>
            </div>
            {result.unmatched.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ligne</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.unmatched.slice(0, 10).map((row) => (
                    <TableRow key={`${row.line}-${row.phone}`}>
                      <TableCell>{row.line}</TableCell>
                      <TableCell>{row.phone}</TableCell>
                      <TableCell>{row.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex justify-end">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
