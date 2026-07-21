import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { isAxiosError } from "axios";
import { Upload } from "lucide-react";
import { api } from "../../lib/api";
import type { ImportPreview } from "../../lib/referentials";
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

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export default function ImportDialog({ open, onOpenChange, onImported }: ImportDialogProps) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [contentBase64, setContentBase64] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setPreview(null);
    setFileName(null);
    setContentBase64(null);
  }, []);

  const previewMutation = useMutation({
    mutationFn: async (base64: string) => {
      const res = await api.post<ImportPreview>(
        "/workers/import?dryRun=true",
        { contentBase64: base64 },
      );
      return res.data;
    },
    onSuccess: (data) => setPreview(data),
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Import impossible", description: String(message), variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (base64: string) => {
      const res = await api.post<{ imported: number }>(
        "/workers/import?dryRun=false",
        { contentBase64: base64 },
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast({ title: "Import terminé", description: `${data.imported} MOC importés` });
      onImported();
      onOpenChange(false);
      reset();
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Import échoué", description: String(message), variant: "destructive" });
    },
  });

  async function handleFile(file: File) {
    if (!file.name.endsWith(".xlsx")) {
      toast({ title: "Format invalide", description: "Fichier .xlsx requis", variant: "destructive" });
      return;
    }
    const base64 = await fileToBase64(file);
    setFileName(file.name);
    setContentBase64(base64);
    setPreview(null);
    previewMutation.mutate(base64);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Excel MOC</DialogTitle>
          <DialogDescription>
            Colonnes requises : matricule, firstName, lastName, mvolaNumber, siteId, hiredAt.
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
          <span className="text-sm text-zinc-700">Glisser un fichier .xlsx ou cliquer</span>
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

        {previewMutation.isPending && (
          <p className="text-sm text-zinc-500">Analyse du fichier…</p>
        )}

        {preview && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-700">
              {preview.valid.length} ligne(s) valide(s), {preview.errors.length} erreur(s).
            </p>
            {preview.errors.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ligne</TableHead>
                    <TableHead>Champ</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.errors.slice(0, 20).map((err, index) => (
                    <TableRow key={`${err.row}-${err.field}-${index}`}>
                      <TableCell>{err.row}</TableCell>
                      <TableCell>{err.field}</TableCell>
                      <TableCell>{err.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fermer
              </Button>
              <Button
                type="button"
                disabled={
                  !contentBase64 || preview.errors.length > 0 || importMutation.isPending
                }
                onClick={() => contentBase64 && importMutation.mutate(contentBase64)}
              >
                Importer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
