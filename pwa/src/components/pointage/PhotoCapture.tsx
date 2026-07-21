import { useRef, useState } from "react";
import Button from "../ui/Button";
import { compressPhoto, formatBytes } from "../../lib/image";

interface PhotoCaptureProps {
  label?: string;
  disabled?: boolean;
  previewUrl?: string | null;
  workerName?: string;
  onCapture: (blob: Blob) => void;
  onClear?: () => void;
}

export default function PhotoCapture({
  label = "Photo",
  disabled,
  previewUrl,
  workerName,
  onCapture,
  onClear,
}: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);

  const altText = workerName
    ? `Photo de pointage — ${workerName}`
    : "Photo de pointage";

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
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-600">
          —
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || loading}
            onClick={() => inputRef.current?.click()}
          >
            {loading ? "…" : label}
          </Button>
          {previewUrl && onClear && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled || loading} onClick={onClear}>
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
