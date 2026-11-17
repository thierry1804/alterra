import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState } from "react";
import { api } from "../../lib/api";
import { toast } from "../../hooks/use-toast";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";

interface ImportResult {
  dryRun: boolean;
  rows: number;
  zonesCreated: number;
  parcellesCreated: number;
  parcellesUpdated: number;
  errors: Array<{ line: number; message: string }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ParcelImportSheet({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);

  function reset() {
    setCsv(null);
    setFileName("");
    setPreview(null);
  }

  function errorMessage(err: unknown): string {
    if (isAxiosError(err)) return String(err.response?.data?.message ?? "Erreur");
    return err instanceof Error ? err.message : "Erreur";
  }

  const run = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await api.post<ImportResult>("/parcels/import", { csv, dryRun });
      return res.data;
    },
    onSuccess: (result) => {
      if (result.dryRun) {
        setPreview(result);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["zones"] });
      void queryClient.invalidateQueries({ queryKey: ["parcels"] });
      toast({
        title: "Import terminé",
        description: `${result.parcellesCreated} parcelle(s) créée(s), ${result.parcellesUpdated} mise(s) à jour.`,
      });
      reset();
      onOpenChange(false);
    },
    onError: (err) =>
      toast({ title: "Import impossible", description: errorMessage(err), variant: "destructive" }),
  });

  async function pickFile(file: File | undefined) {
    setPreview(null);
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
  }

  const canImport = preview !== null && preview.errors.length === 0 && preview.rows > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Importer des parcelles</SheetTitle>
          <SheetDescription>
            Fichier CSV avec les colonnes : site ; zone ; code ; nom ; type (parcelle ou pépinière).
            Les zones absentes sont créées. Une parcelle déjà connue (même code dans la zone) est
            mise à jour.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parcel-import-file">Fichier CSV</Label>
              <input
                id="parcel-import-file"
                type="file"
                accept=".csv,text/csv,text/plain"
                className="block w-full text-sm"
                onChange={(e) => void pickFile(e.target.files?.[0])}
              />
              {fileName && <p className="text-xs text-zinc-500">{fileName}</p>}
            </div>
            {preview && (
              <div className="space-y-2 rounded-md border border-zinc-200 p-3 text-sm">
                <p>
                  {preview.rows} ligne(s) lue(s) : {preview.zonesCreated} zone(s) à créer,{" "}
                  {preview.parcellesCreated} parcelle(s) à créer, {preview.parcellesUpdated} à
                  mettre à jour.
                </p>
                {preview.errors.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-red-700">
                    {preview.errors.map((e) => (
                      <li key={`${e.line}-${e.message}`}>
                        Ligne {e.line} : {e.message}
                      </li>
                    ))}
                  </ul>
                )}
                {preview.errors.length === 0 && preview.rows > 0 && (
                  <p className="text-zinc-600">Aucune erreur. Vous pouvez lancer l'import.</p>
                )}
              </div>
            )}
          </div>
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!csv || run.isPending}
            onClick={() => run.mutate(true)}
          >
            Vérifier le fichier
          </Button>
          <Button
            type="button"
            disabled={!canImport || run.isPending}
            onClick={() => run.mutate(false)}
          >
            Importer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
