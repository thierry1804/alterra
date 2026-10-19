import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import Button from "../ui/Button";
import { compressPhoto, formatBytes } from "../../lib/image";

interface PhotoCaptureProps {
  label?: string;
  disabled?: boolean;
  previewUrl?: string | null;
  workerName?: string;
  /** Version réduite : une icône (ou la miniature) de 44 px, utilisée dans les lignes de saisie. */
  compact?: boolean;
  onCapture: (blob: Blob) => void;
  onClear?: () => void;
}

export default function PhotoCapture({
  label = "Photo",
  disabled,
  previewUrl,
  workerName,
  compact,
  onCapture,
  onClear,
}: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);

  const altText = workerName ? `Photo de pointage — ${workerName}` : "Photo de pointage";

  useEffect(() => {
    if (!previewUrl) setMeta(null);
  }, [previewUrl]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const compressed = await compressPhoto(file);
      setMeta(formatBytes(compressed.size));
      onCapture(compressed);
    } catch {
      setError("Compression impossible");
    } finally {
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <div className="relative shrink-0">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={disabled || loading}
          onChange={(event) => void handleFileChange(event)}
        />
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => inputRef.current?.click()}
          aria-label={
            previewUrl
              ? `Remplacer la photo — ${workerName ?? ""}`
              : `Ajouter une photo — ${workerName ?? ""}`
          }
          className="alterra-focus grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-dashed border-zinc-300 text-zinc-500 active:bg-zinc-100 disabled:opacity-40"
        >
          {previewUrl ? (
            <img src={previewUrl} alt={altText} className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
        {previewUrl && onClear && (
          <button
            type="button"
            disabled={disabled || loading}
            onClick={onClear}
            aria-label="Retirer la photo"
            className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-zinc-800 text-[0.625rem] font-bold text-white"
          >
            ×
          </button>
        )}
        {error && <span className="sr-only">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled || loading}
        onChange={(event) => void handleFileChange(event)}
      />

      {previewUrl ? (
        <img
          src={previewUrl}
          alt={altText}
          className="h-10 w-10 rounded-md border border-zinc-200 object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-zinc-300 text-zinc-400">
          <Camera className="h-5 w-5" aria-hidden="true" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={disabled || loading}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
            {loading ? "…" : label}
          </Button>
          {previewUrl && onClear && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || loading}
              onClick={onClear}
            >
              Retirer
            </Button>
          )}
        </div>
        {meta && <span className="text-xs text-zinc-600">{meta}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
