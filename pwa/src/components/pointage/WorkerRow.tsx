import { useEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import PhotoCapture from "./PhotoCapture";
import { parseDecimal } from "../../lib/number";

const HOLD_START_DELAY_MS = 450;
const HOLD_REPEAT_INTERVAL_MS = 120;

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

  // Suit la valeur réelle indépendamment du cycle de rendu : pendant un appui long, l'intervalle
  // doit incrémenter la dernière quantité posée, pas celle figée au moment où il a démarré.
  const quantityRef = useRef(quantityNumber);
  useEffect(() => {
    quantityRef.current = quantityNumber;
  }, [quantityNumber]);

  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const suppressClickRef = useRef(false);

  function clearHoldTimers() {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }

  useEffect(() => clearHoldTimers, []);

  function step(delta: number) {
    const base = Number.isFinite(quantityRef.current) ? quantityRef.current : 0;
    const clamped = Math.max(0, Math.round((base + delta) * 100) / 100);
    quantityRef.current = clamped;
    onChange({ ...value, quantity: String(clamped) });
  }

  function startHold(delta: number) {
    if (disabled) return;
    clearHoldTimers();
    suppressClickRef.current = false;
    holdTimeoutRef.current = setTimeout(() => {
      suppressClickRef.current = true;
      holdIntervalRef.current = setInterval(() => step(delta), HOLD_REPEAT_INTERVAL_MS);
    }, HOLD_START_DELAY_MS);
  }

  function endHold() {
    clearHoldTimers();
  }

  function handleStepClick(delta: number) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    step(delta);
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

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border p-2.5 transition-colors ${
        hasQuantity ? "border-brand/60 bg-brand-tint/40" : "border-zinc-200 bg-white"
      }`}
    >
      <span
        className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-people-bg text-xs font-bold text-people-fg min-[420px]:grid"
        aria-hidden="true"
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-900">
          {firstName} {lastName}
        </p>
        <p className="truncate text-xs text-zinc-500">
          <span className="alterra-num">{matricule}</span>
          {hasQuantity && (
            <>
              {" · "}
              <span className="alterra-num font-semibold text-brand">
                {lineAmount.toLocaleString("fr-MG")} Ar
              </span>
            </>
          )}
        </p>
      </div>

      <button
        type="button"
        disabled={disabled || quantityNumber <= 0}
        onPointerDown={() => startHold(-1)}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onClick={() => handleStepClick(-1)}
        aria-label={`Diminuer la quantité (${unit}), appui long pour répéter`}
        className="alterra-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 active:bg-zinc-100 disabled:opacity-30"
      >
        <Minus className="h-5 w-5" />
      </button>

      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={value.quantity}
        onChange={(event) => updateQuantity(event.target.value)}
        aria-label={`Quantité (${unit})`}
        className="alterra-num w-12 rounded-md border-0 bg-transparent text-center text-xl font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-ring"
      />

      <button
        type="button"
        disabled={disabled}
        onPointerDown={() => startHold(1)}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onClick={() => handleStepClick(1)}
        aria-label={`Augmenter la quantité (${unit}), appui long pour répéter`}
        className="alterra-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white active:bg-brand-hover disabled:opacity-30"
      >
        <Plus className="h-5 w-5" />
      </button>

      <PhotoCapture
        compact
        previewUrl={value.photoPreview}
        disabled={disabled}
        workerName={`${firstName} ${lastName}`}
        onCapture={handleCapture}
        onClear={handleClearPhoto}
      />
    </div>
  );
}
