import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { isAxiosError } from "axios";
import { Upload } from "lucide-react";
import { api } from "../../lib/api";
import type { ImportMvolaResult } from "../../lib/payments";
import type { ImportColumnsResult } from "../../lib/referentials";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { toast } from "../../hooks/use-toast";

interface MvolaImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

type Step = "upload" | "mapping" | "result";

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
  onImported,
}: MvolaImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [contentBase64, setContentBase64] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [referenceRowNumber, setReferenceRowNumber] = useState(7);
  const [columnsResult, setColumnsResult] = useState<ImportColumnsResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportMvolaResult | null>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setFileName(null);
    setContentBase64(null);
    setColumnsResult(null);
    setMapping({});
    setResult(null);
    setHasHeaderRow(true);
    setReferenceRowNumber(7);
  }, []);

  const columnsMutation = useMutation({
    mutationFn: async ({
      base64,
      withHeader,
      rowNumber,
    }: {
      base64: string;
      withHeader: boolean;
      rowNumber: number | undefined;
    }) => {
      const res = await api.post<ImportColumnsResult>("/payments/import-status/columns", {
        contentBase64: base64,
        hasHeaderRow: withHeader,
        referenceRowNumber: rowNumber,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setColumnsResult(data);
      setMapping(data.suggestedMapping ?? {});
      setReferenceRowNumber(data.referenceRowNumber);
      setStep("mapping");
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({
        title: "Lecture du fichier impossible",
        description: String(message),
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ImportMvolaResult>("/payments/import-status", {
        contentBase64,
        hasHeaderRow,
        referenceRowNumber,
        mapping,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
      toast({
        title: "Rapprochement terminé",
        description: `${data.confirme} confirmé(s), ${data.ecartMontant} écart(s), ${data.orphelin} orphelin(s)`,
      });
      onImported();
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Import échoué", description: String(message), variant: "destructive" });
    },
  });

  function loadColumns(base64: string, withHeader: boolean, rowNumber: number | undefined) {
    setResult(null);
    columnsMutation.mutate({ base64, withHeader, rowNumber });
  }

  async function handleFile(file: File) {
    if (!file.name.endsWith(".xls") && !file.name.endsWith(".xlsx")) {
      toast({
        title: "Format invalide",
        description: ".xls ou .xlsx requis",
        variant: "destructive",
      });
      return;
    }
    const base64 = await fileToBase64(file);
    setFileName(file.name);
    setContentBase64(base64);
    loadColumns(base64, hasHeaderRow, undefined);
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
          <DialogTitle>Import retour MVola</DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Choisissez le relevé MVola (.xls ou .xlsx), puis associez ses colonnes."}
            {step === "mapping" && "Associez chaque champ requis à une colonne du relevé."}
            {step === "result" && "Résultat du rapprochement — toutes les périodes du fichier."}
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
              <span className="text-sm text-zinc-700">Glisser le relevé MVola (.xls ou .xlsx)</span>
              {fileName && <span className="mt-1 text-xs text-zinc-500">{fileName}</span>}
              <input
                type="file"
                accept=".xls,.xlsx"
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
                Le relevé MVola porte ses en-têtes en ligne 7 (6 lignes d'en-tête de compte avant).
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
                disabled={missingRequired.length > 0 || importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                {importMutation.isPending ? "Rapprochement…" : "Lancer le rapprochement"}
              </Button>
            </div>
            {missingRequired.length > 0 && (
              <p className="text-xs text-zinc-500">
                Champs obligatoires à associer : {missingRequired.map((f) => f.label).join(", ")}
              </p>
            )}
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-4 gap-2 rounded-md border border-zinc-200 p-3">
              <div>
                <p className="text-zinc-500">Confirmés</p>
                <p className="text-lg font-semibold text-emerald-700">{result.confirme}</p>
              </div>
              <div>
                <p className="text-zinc-500">Écarts montant</p>
                <p className="text-lg font-semibold text-amber-700">{result.ecartMontant}</p>
              </div>
              <div>
                <p className="text-zinc-500">Orphelins</p>
                <p className="text-lg font-semibold">{result.orphelin}</p>
              </div>
              <div>
                <p className="text-zinc-500">Non confirmés</p>
                <p className="text-lg font-semibold text-zinc-600">{result.nonConfirme}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              {result.fraisRattaches} frais rattaché(s) · {result.dejaTraite} déjà traité(s) ·{" "}
              {result.internal} dépense(s) interne(s) · {result.ignored} ligne(s) ignorée(s)
            </p>
            {result.confirmes.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-emerald-700">Paiements confirmés</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Travailleur</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.confirmes.slice(0, 10).map((row) => (
                      <TableRow key={row.paymentId}>
                        <TableCell>{row.worker}</TableCell>
                        <TableCell>{row.reference}</TableCell>
                        <TableCell>{row.montant}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {result.confirmes.length > 10 && (
                  <p className="text-xs text-zinc-500">+ {result.confirmes.length - 10} autre(s)</p>
                )}
              </div>
            )}
            {result.ecarts.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-amber-700">Écarts de montant — revue manuelle</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Travailleur</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Montant relevé</TableHead>
                      <TableHead>Montant attendu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.ecarts.slice(0, 10).map((row) => (
                      <TableRow key={row.paymentId}>
                        <TableCell>{row.worker}</TableCell>
                        <TableCell>{row.reference}</TableCell>
                        <TableCell>{row.montantReleve}</TableCell>
                        <TableCell>{row.montantAttendu}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {result.orphelins.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-zinc-700">Lignes orphelines</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.orphelins.slice(0, 10).map((row) => (
                      <TableRow key={row.reference}>
                        <TableCell>{row.reference}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell>{row.montant}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {result.nonConfirmes.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-zinc-700">Paiements non confirmés</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Travailleur</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead>Bordereau</TableHead>
                      <TableHead>Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.nonConfirmes.slice(0, 10).map((row) => (
                      <TableRow key={row.paymentId}>
                        <TableCell>{row.worker}</TableCell>
                        <TableCell>{row.periodIso}</TableCell>
                        <TableCell>{row.bordereau}</TableCell>
                        <TableCell>{row.montant}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {result.dejaTraites.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-zinc-700">
                  Déjà traités (références déjà rapprochées)
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Paiement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.dejaTraites.slice(0, 10).map((row) => (
                      <TableRow key={row.paymentId}>
                        <TableCell>{row.reference}</TableCell>
                        <TableCell>{row.paymentId}</TableCell>
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
