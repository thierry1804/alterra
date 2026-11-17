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
  rounding: "UNIT" | "NONE" | undefined;
  loading: boolean;
}

export default function IsiSettingsCard({ ratePercent, rounding, loading }: IsiSettingsCardProps) {
  const queryClient = useQueryClient();
  const [rateInput, setRateInput] = useState("5");
  const [roundingInput, setRoundingInput] = useState<"UNIT" | "NONE">("UNIT");

  useEffect(() => {
    if (ratePercent !== undefined) setRateInput(String(ratePercent));
    if (rounding) setRoundingInput(rounding);
  }, [ratePercent, rounding]);

  const parsedRate = Number(rateInput.replace(",", "."));
  const rateValid =
    rateInput.trim() !== "" &&
    Number.isFinite(parsedRate) &&
    parsedRate >= 0 &&
    parsedRate <= 100 &&
    Math.abs(parsedRate * 100 - Math.round(parsedRate * 100)) < 1e-9;
  const unchanged = parsedRate === ratePercent && roundingInput === rounding;

  const mutation = useMutation({
    mutationFn: () =>
      api.patch("/app-settings/isi", { ratePercent: parsedRate, rounding: roundingInput }),
    onSuccess: () => {
      toast({ title: "Retenue ISI enregistrée" });
      void queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : err;
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Retenue ISI et arrondi</h2>
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
          <Label htmlFor="isi-rounding">Arrondi</Label>
          <Select
            id="isi-rounding"
            value={roundingInput}
            disabled={loading}
            onChange={(event) => setRoundingInput(event.target.value as "UNIT" | "NONE")}
          >
            <option value="UNIT">Arrondir l'ISI à l'Ar (ligne par ligne)</option>
            <option value="NONE">Garder les décimales (2 chiffres)</option>
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
      <p className="text-xs text-zinc-500">
        S'applique aux bordereaux générés ensuite. Un bordereau déjà généré garde le taux et
        l'arrondi de sa génération ; une régénération avant la validation du DG reprend les réglages
        actuels.
      </p>
    </div>
  );
}
