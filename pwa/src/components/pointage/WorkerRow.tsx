import { Check, Minus, Plus } from "lucide-react";
import PhotoCapture from "./PhotoCapture";
import { parseDecimal } from "../../lib/number";

export interface WorkerRowValue {
  quantity: string;
  photoBlob: Blob | null;
  photoPreview: string | null;
}

interface WorkerRowProps {
  matricule: string;
  firstName: string;
  lastName: string;
  unit: string;
  unitRate: number;
  value: WorkerRowValue;
  disabled?: boolean;
  onChange: (value: WorkerRowValue) => void;
}

export default function WorkerRow({
  matricule,
  firstName,
  lastName,
  unit,
  unitRate,
  value,
  disabled,
  onChange,
}: WorkerRowProps) {
  const quantityNumber = parseDecimal(value.quantity);
  const hasQuantity = Number.isFinite(quantityNumber) && quantityNumber > 0;
  const lineAmount = hasQuantity ? quantityNumber * unitRate : 0;

  function setQuantity(next: number) {
    const clamped = Math.max(0, Math.round(next * 100) / 100);
    onChange({ ...value, quantity: String(clamped) });
  }

  // Saisie libre : chiffres, virgule ou point (un seul séparateur) — clavier numérique décimal,
  // pas le clavier "number" natif qui bloque la virgule selon l'appareil/la locale.
  function updateQuantity(nextQuantity: string) {
    if (/^[0-9]*[.,]?[0-9]*$/.test(nextQuantity)) {
      onChange({ ...value, quantity: nextQuantity });
    }
  }

  function handleCapture(blob: Blob) {
    if (value.photoPreview) URL.revokeObjectURL(value.photoPreview);
    onChange({
      ...value,
      photoBlob: blob,
      photoPreview: URL.createObjectURL(blob),
    });
  }

  function handleClearPhoto() {
    if (value.photoPreview) URL.revokeObjectURL(value.photoPreview);
    onChange({ ...value, photoBlob: null, photoPreview: null });
  }

  return (
    <div
      className={`rounded-lg border-2 p-3 transition-colors ${
        hasQuantity ? "border-brand bg-brand-tint/30" : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-people-bg text-sm font-bold text-people-fg"
          aria-hidden="true"
        >
          {`${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-zinc-900">
            {firstName} {lastName}
          </p>
          <p className="text-xs text-zinc-500">
            <span className="alterra-num">{matricule}</span>
          </p>
        </div>
        {hasQuantity && (
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-white"
            aria-hidden="true"
          >
            <Check className="h-4 w-4" />
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4">
        <button
          type="button"
          disabled={disabled || quantityNumber <= 0}
          onClick={() => setQuantity((Number.isFinite(quantityNumber) ? quantityNumber : 0) - 1)}
          aria-label="Diminuer la quantité"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-zinc-300 text-zinc-700 active:bg-zinc-100 disabled:opacity-30"
        >
          <Minus className="h-6 w-6" />
        </button>

        <input
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={value.quantity}
          onChange={(event) => updateQuantity(event.target.value)}
          className="w-20 rounded-md border-0 bg-transparent text-center text-3xl font-bold tabular-nums text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-ring"
        />

        <button
          type="button"
          disabled={disabled}
          onClick={() => setQuantity((Number.isFinite(quantityNumber) ? quantityNumber : 0) + 1)}
          aria-label="Augmenter la quantité"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-brand bg-brand text-white active:bg-brand-hover disabled:opacity-30"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
      <p className="mt-1 text-center text-xs text-zinc-500">{unit}</p>

      {hasQuantity && (
        <p className="mt-1 text-center text-base font-semibold text-brand">
          {lineAmount.toLocaleString("fr-MG")} Ar
        </p>
      )}

      <div className="mt-3">
        <PhotoCapture
          previewUrl={value.photoPreview}
          disabled={disabled}
          workerName={`${firstName} ${lastName}`}
          onCapture={handleCapture}
          onClear={handleClearPhoto}
        />
      </div>
    </div>
  );
}
