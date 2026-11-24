import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../../lib/api";
import { toast } from "../../hooks/use-toast";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";

interface IsiSettingsCardProps {
  ratePercent: number | undefined;
  decimals: number | undefined;
  loading: boolean;
}

const DECIMAL_OPTIONS = [
  { value: 0, label: "0 : montants arrondis à l'Ariary", example: "118 750" },
  { value: 1, label: "1 décimale", example: "118 750,5" },
  { value: 2, label: "2 décimales", example: "118 750,50" },
] as const;

/** Taux d'ISI et nombre de décimales des montants de paiement. Un seul réglage pilote le calcul, les écrans, les factures et le fichier MVola. */
export default function IsiSettingsCard({ ratePercent, decimals, loading }: IsiSettingsCardProps) {
  const queryClient = useQueryClient();
  const [rateInput, setRateInput] = useState("5");
  const [decimalsInput, setDecimalsInput] = useState(0);

  useEffect(() => {
    if (ratePercent !== undefined) setRateInput(String(ratePercent));
    if (decimals !== undefined) setDecimalsInput(decimals);
  }, [ratePercent, decimals]);

  const parsedRate = Number(rateInput.replace(",", "."));
  const rateValid =
    rateInput.trim() !== "" &&
    Number.isFinite(parsedRate) &&
    parsedRate >= 0 &&
    parsedRate <= 100 &&
    Math.abs(parsedRate * 100 - Math.round(parsedRate * 100)) < 1e-9;
  const unchanged = parsedRate === ratePercent && decimalsInput === decimals;

  const mutation = useMutation({
    mutationFn: () =>
      api.patch("/app-settings/isi", { ratePercent: parsedRate, decimals: decimalsInput }),
    onSuccess: () => {
      toast({ title: "Montants et ISI enregistrés" });
      void queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : err;
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const example = DECIMAL_OPTIONS.find((option) => option.value === decimalsInput)?.example;

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Retenue ISI et décimales</h2>
        <p className="mt-1 text-sm text-zinc-700">
          Taxe appliquée aux travailleurs informels, déduite du montant payé. Le net à payer figure
          sur la facture, dans le bordereau et dans le fichier envoyé à MVola.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="isi-rate">Taux (%)</Label>
          <Input
            id="isi-rate"
            inputMode="decimal"
            value={rateInput}
            disabled={loading}
            onChange={(event) => setRateInput(event.target.value)}
            className="w-28"
            aria-invalid={!rateValid}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="amount-decimals">Décimales des montants</Label>
          <Select
            id="amount-decimals"
            value={decimalsInput}
            disabled={loading}
            onChange={(event) => setDecimalsInput(Number(event.target.value))}
          >
            {DECIMAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="button"
          disabled={loading || !rateValid || unchanged || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>

      {!rateValid && (
        <p role="alert" className="text-xs text-danger">
          Le taux doit être compris entre 0 et 100, avec deux décimales au plus.
        </p>
      )}

      <div className="rounded-md bg-surface-muted px-3 py-2 text-xs text-zinc-700">
        <p className="font-medium text-zinc-900">
          Où s&apos;applique ce réglage (exemple : {example} Ar)
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>
            Calcul : chaque ligne (travailleur, activité, tarif) est arrondie, puis l&apos;ISI est
            calculé dessus et arrondi à son tour ; brut, ISI et net sont des sommes exactes de
            lignes.
          </li>
          <li>Écrans : bordereaux, paiements, ajustements et export MVola.</li>
          <li>Documents : facture PDF et colonne « Montant » du fichier Excel MVola.</li>
        </ul>
      </div>

      <p className="text-xs text-zinc-500">
        S&apos;applique aux bordereaux générés ensuite. Un bordereau déjà généré garde le taux et
        les décimales de sa génération ; une régénération avant la validation du DG reprend les
        réglages actuels. La finance doit valider la règle avant le premier paiement réel.
      </p>
    </div>
  );
}
