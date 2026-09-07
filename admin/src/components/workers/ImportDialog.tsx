import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { isAxiosError } from "axios";
import { Upload } from "lucide-react";
import { api } from "../../lib/api";
import type { ImportColumnsResult, ImportPreview } from "../../lib/referentials";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Select } from "../ui/select";
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

type Step = "upload" | "mapping" | "preview";

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
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [contentBase64, setContentBase64] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [referenceRowNumber, setReferenceRowNumber] = useState(1);
  const [columnsResult, setColumnsResult] = useState<ImportColumnsResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setFileName(null);
    setContentBase64(null);
    setColumnsResult(null);
    setMapping({});
    setPreview(null);
    setHasHeaderRow(true);
    setReferenceRowNumber(1);
  }, []);

  const columnsMutation = useMutation({
    mutationFn: async ({
      base64,
      withHeader,
      rowNumber,
    }: {
      base64: string;
      withHeader: boolean;
      rowNumber: number;
    }) => {
      const res = await api.post<ImportColumnsResult>("/workers/import/columns", {
        contentBase64: base64,
        hasHeaderRow: withHeader,
        referenceRowNumber: rowNumber,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setColumnsResult(data);
      setStep("mapping");
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Lecture du fichier impossible", description: String(message), variant: "destructive" });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ImportPreview>("/workers/import?dryRun=true", {
        contentBase64,
        hasHeaderRow,
        referenceRowNumber,
        mapping,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setPreview(data);
      setStep("preview");
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Import impossible", description: String(message), variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ imported: number; created: number; updated: number }>(
        "/workers/import?dryRun=false",
        { contentBase64, hasHeaderRow, referenceRowNumber, mapping },
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Import terminé",
        description: `${data.created} créé(s), ${data.updated} mis à jour`,
      });
      onImported();
      onOpenChange(false);
      reset();
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Import échoué", description: String(message), variant: "destructive" });
    },
  });

  function loadColumns(base64: string, withHeader: boolean, rowNumber: number) {
    setMapping({});
    setPreview(null);
    columnsMutation.mutate({ base64, withHeader, rowNumber });
  }

  async function handleFile(file: File) {
    if (!file.name.endsWith(".xlsx")) {
      toast({ title: "Format invalide", description: "Fichier .xlsx requis", variant: "destructive" });
      return;
    }
    const base64 = await fileToBase64(file);
    setFileName(file.name);
    setContentBase64(base64);
    loadColumns(base64, hasHeaderRow, referenceRowNumber);
  }

  function handleHeaderToggle(checked: boolean) {
    setHasHeaderRow(checked);
    if (contentBase64) loadColumns(contentBase64, checked, referenceRowNumber);
  }

  function handleReferenceRowNumberChange(value: number) {
    const rowNumber = Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
    setReferenceRowNumber(rowNumber);
    if (contentBase64) loadColumns(contentBase64, hasHeaderRow, rowNumber);
  }

  const requiredFields = columnsResult?.fields.filter((f) => f.required) ?? [];
  const missingRequired = requiredFields.filter((f) => !mapping[f.key]);

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
            {step === "upload" && "Choisissez un fichier .xlsx, puis associez ses colonnes aux champs ALTERRA."}
            {step === "mapping" && "Associez chaque champ requis à une colonne de votre fichier."}
            {step === "preview" && "Vérifiez les lignes avant import."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
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
            {columnsMutation.isPending && (
              <p className="text-sm text-zinc-500">Lecture des colonnes du fichier…</p>
            )}
          </div>
        )}

        {step === "mapping" && columnsResult && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-zinc-300 text-brand focus-visible:ring-2 focus-visible:ring-brand-ring"
                  checked={hasHeaderRow}
                  onChange={(e) => handleHeaderToggle(e.target.checked)}
                />
                Le fichier contient une ligne d'en-tête
              </label>

              <div className="flex items-center gap-3 pl-6">
                <label className="w-40 shrink-0 text-sm text-zinc-700">
                  {hasHeaderRow ? "Ligne d'en-tête" : "Ligne du 1ᵉʳ élément"}
                </label>
                <input
                  type="number"
                  min={1}
                  className="h-8 w-16 shrink-0 rounded-md border border-zinc-300 px-2 text-sm focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring"
                  value={referenceRowNumber}
                  onChange={(e) => handleReferenceRowNumberChange(Number(e.target.value))}
                />
              </div>
              <p className="pl-6 text-xs text-zinc-500">
                {hasHeaderRow
                  ? "Mettre 2 si du texte précède les en-têtes (ex. un titre en ligne 1)."
                  : "Numéro de la première ligne contenant une donnée."}
              </p>
            </div>

            {fileName && <p className="text-xs text-zinc-500">{fileName}</p>}

            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {columnsResult.fields.map((field) => {
                const currentValue = mapping[field.key] ?? "";
                const usedByOtherFields = new Set(
                  Object.entries(mapping)
                    .filter(([key, value]) => key !== field.key && value)
                    .map(([, value]) => value),
                );
                const availableColumns = columnsResult.columns.filter(
                  (col) => col.column === currentValue || !usedByOtherFields.has(col.column),
                );

                return (
                  <div key={field.key} className="flex items-center gap-3">
                    <label className="w-40 shrink-0 text-sm font-medium text-zinc-700">
                      {field.label}
                      {field.required && <span className="ml-0.5 text-red-600">*</span>}
                    </label>
                    <Select
                      className="flex-1"
                      value={currentValue}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    >
                      <option value="">
                        {currentValue ? "— Désélectionner —" : "— Choisir une colonne —"}
                      </option>
                      {availableColumns.map((col) => (
                        <option key={col.column} value={col.column}>
                          {col.label}
                          {col.samples.length > 0 ? ` (ex. ${col.samples.join(", ")})` : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                type="button"
                disabled={missingRequired.length > 0 || previewMutation.isPending}
                onClick={() => previewMutation.mutate()}
              >
                Continuer
              </Button>
            </div>
            {missingRequired.length > 0 && (
              <p className="text-xs text-zinc-500">
                Champs obligatoires à associer : {missingRequired.map((f) => f.label).join(", ")}
              </p>
            )}
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-700">
              {preview.valid.filter((r) => !r.existingWorkerId).length} à créer,{" "}
              {preview.valid.filter((r) => r.existingWorkerId).length} à mettre à jour (MVola déjà
              en base), {preview.errors.length} erreur(s).
            </p>
            {preview.errors.length > 0 && (
              <div className="max-h-80 overflow-y-auto rounded-md border border-zinc-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ligne</TableHead>
                      <TableHead>Champ</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.errors.map((err, index) => (
                      <TableRow key={`${err.row}-${err.field}-${index}`}>
                        <TableCell>{err.row}</TableCell>
                        <TableCell>{err.field}</TableCell>
                        <TableCell>{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("mapping")}>
                Retour au mapping
              </Button>
              <Button
                type="button"
                disabled={!contentBase64 || preview.errors.length > 0 || importMutation.isPending}
                onClick={() => importMutation.mutate()}
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
