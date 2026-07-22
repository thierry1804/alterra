import PhotoCapture from "./PhotoCapture";

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
  const quantityNumber = Number(value.quantity);
  const lineAmount =
    Number.isFinite(quantityNumber) && quantityNumber > 0
      ? quantityNumber * unitRate
      : 0;

  function updateQuantity(nextQuantity: string) {
    onChange({ ...value, quantity: nextQuantity });
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
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-people-bg text-xs font-semibold text-people-fg"
            aria-hidden="true"
          >
            {`${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900">
              {firstName} {lastName}
            </p>
            <p className="text-xs text-zinc-500">
              <span className="alterra-num">{matricule}</span> ·{" "}
              <span className="alterra-num">{unitRate.toLocaleString("fr-MG")}</span> Ar/{unit}
            </p>
          </div>
        </div>
        {lineAmount > 0 && (
          <span className="alterra-num shrink-0 text-sm font-semibold text-brand">
            {lineAmount.toLocaleString("fr-MG")} Ar
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]">
        <div>
          <label className="mb-1 block text-xs text-zinc-600">Quantité</label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            disabled={disabled}
            value={value.quantity}
            onChange={(event) => updateQuantity(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
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
