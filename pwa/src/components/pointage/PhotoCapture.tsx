import { useRef, useState } from "react";
import { compressPhoto, formatBytes } from "../../lib/image";

interface PhotoCaptureProps {
  label?: string;
  disabled?: boolean;
  previewUrl?: string | null;
  onCapture: (blob: Blob) => void;
  onClear?: () => void;
}

export default function PhotoCapture({
  label = "Photo",
  disabled,
  previewUrl,
  onCapture,
  onClear,
}: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);

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
          alt=""
          className="h-10 w-10 rounded-md border border-zinc-200 object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-500">
          —
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled || loading}
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-50"
          >
            {loading ? "…" : label}
          </button>
          {previewUrl && onClear && (
            <button
              type="button"
              disabled={disabled || loading}
              onClick={onClear}
              className="text-xs text-zinc-500 underline"
            >
              Retirer
            </button>
          )}
        </div>
        {meta && <span className="text-[10px] text-zinc-500">{meta}</span>}
        {error && <span className="text-[10px] text-red-600">{error}</span>}
      </div>
    </div>
  );
}
