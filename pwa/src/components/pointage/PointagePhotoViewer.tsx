import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { api } from "../../lib/api";

interface PointagePhotoViewerProps {
  pointageId: string;
}

/** Vignette + agrandissement de la photo preuve d'un pointage déjà synchronisé (relayée par le
 * backend — MinIO n'est pas exposé publiquement, voir backend/src/routes/pointages.routes.ts). */
export default function PointagePhotoViewer({ pointageId }: PointagePhotoViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    api
      .get(`/pointages/${pointageId}/photo`, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data as Blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pointageId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  if (failed) return null;

  if (!url) {
    return (
      <div
        className="flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-md border border-zinc-200 bg-zinc-50"
        aria-hidden
      >
        <Camera className="h-4 w-4 text-zinc-300" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        aria-label="Voir la photo en grand"
      >
        <img src={url} alt="Photo — preuve de réalisation" className="h-full w-full object-cover" />
      </button>
      <dialog
        ref={dialogRef}
        className="w-[min(100%,28rem)] rounded-lg border-0 bg-transparent p-0 backdrop:bg-black/70"
        onClose={() => setOpen(false)}
      >
        <button type="button" onClick={() => setOpen(false)} className="block w-full">
          <img src={url} alt="Photo — preuve de réalisation" className="w-full rounded-lg" />
        </button>
      </dialog>
    </>
  );
}
