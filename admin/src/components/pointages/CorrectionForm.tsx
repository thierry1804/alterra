import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../../lib/api";
import type { Pointage } from "../../lib/pointages";
import type { Activity } from "../../lib/referentials";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "../../hooks/use-toast";

interface CorrectionFormProps {
  pointage: Pointage;
  activities: Activity[];
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CorrectionForm({
  pointage,
  activities,
  onSuccess,
  onCancel,
}: CorrectionFormProps) {
  const [quantity, setQuantity] = useState(pointage.quantity);
  const [activityId, setActivityId] = useState(pointage.activityId);
  const [date, setDate] = useState(pointage.date.slice(0, 10));
  const [correctionReason, setCorrectionReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/pointages/${pointage.id}`, {
        quantity: Number(quantity),
        activityId,
        date,
        correctionReason: correctionReason.trim(),
      }),
    onSuccess: () => {
      toast({ title: "Pointage corrigé" });
      onSuccess();
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Correction échouée", description: String(message), variant: "destructive" });
    },
  });

  return (
    <form
      className="space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <p className="text-sm font-medium text-zinc-900">Correction admin</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="corr-qty">Quantité</Label>
          <Input
            id="corr-qty"
            type="number"
            min="0.01"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="corr-date">Date</Label>
          <Input
            id="corr-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="corr-activity">Activité</Label>
        <select
          id="corr-activity"
          className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          value={activityId}
          onChange={(e) => setActivityId(e.target.value)}
        >
          {activities.map((activity) => (
            <option key={activity.id} value={activity.id}>
              {activity.label} ({activity.unit})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="corr-reason">Motif (min. 10 caractères)</Label>
        <textarea
          id="corr-reason"
          className="min-h-20 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          value={correctionReason}
          onChange={(e) => setCorrectionReason(e.target.value)}
          required
          minLength={10}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={mutation.isPending || correctionReason.trim().length < 10}>
          Enregistrer la correction
        </Button>
      </div>
    </form>
  );
}
