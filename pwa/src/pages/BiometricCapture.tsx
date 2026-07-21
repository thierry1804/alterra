import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { api } from "../lib/api";
import {
  blobToBase64,
  queueOfflineBiometricCheck,
  submitBiometricCheck,
  submitBiometricCheckOffline,
  type BiometricCheckResult,
} from "../lib/biometric";
import { bioResultLabel } from "../lib/pointages";
import { compressPhoto } from "../lib/image";
import { uuidv7 } from "../lib/uuid";
import { getCachedBiometricTemplate } from "../services/biometric/TemplateCache";
import { matchFaceBlobAgainstTemplate } from "../services/biometric/FaceMatcher";

function resultBannerClass(result: BiometricCheckResult["result"]): string {
  switch (result) {
    case "OK":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    case "KO":
      return "border-red-500/40 bg-red-500/10 text-red-200";
    case "DOUBT":
      return "border-amber-500/40 bg-amber-500/10 text-amber-100";
    default:
      return "border-zinc-600 bg-zinc-800 text-zinc-200";
  }
}

export default function BiometricCapture() {
  const { workerId } = useParams<{ workerId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const pointageDate = searchParams.get("date") ?? undefined;
  const [workerName, setWorkerName] = useState("MOC");
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<BiometricCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workerId) return;
    void api
      .get<{ firstName: string; lastName: string }>(`/workers/${workerId}`)
      .then((response) => {
        setWorkerName(`${response.data.firstName} ${response.data.lastName}`);
      })
      .catch(() => setWorkerName("MOC"));
  }, [workerId]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleCapture(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !workerId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const compressed = await compressPhoto(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(compressed));

      const cachedTemplate = await getCachedBiometricTemplate(workerId);
      if (cachedTemplate) {
        const match = await matchFaceBlobAgainstTemplate(compressed, cachedTemplate.descriptor);
        if (match) {
          const performedAt = new Date().toISOString();
          const clientUuid = uuidv7();
          const offlinePayload = {
            clientUuid,
            workerId,
            result: match.result,
            score: match.score,
            referenceDate: pointageDate,
            performedAt,
          };

          if (navigator.onLine) {
            try {
              const check = await submitBiometricCheckOffline(offlinePayload);
              setResult(check);
              return;
            } catch {
              // file d'attente offline ci-dessous
            }
          }

          await queueOfflineBiometricCheck({
            clientUuid,
            workerId,
            result: match.result,
            score: match.score,
            referenceDate: pointageDate,
            performedAt,
          });
          setResult({
            id: clientUuid,
            workerId,
            result: match.result,
            score: match.score,
            weekIso: null,
            performedAt,
          });
          return;
        }
      }

      if (!navigator.onLine) {
        setError("Hors ligne — template biométrique indisponible ou visage non détecté.");
        return;
      }

      const photoBase64 = await blobToBase64(compressed);
      const check = await submitBiometricCheck({
        workerId,
        photoBase64,
        referenceDate: pointageDate,
      });
      setResult(check);
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : null;
      setError(message ? String(message) : "Contrôle biométrique échoué.");
    } finally {
      setLoading(false);
    }
  }

  if (!workerId) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-700">MOC introuvable.</p>
        <Link to="/validation" className="text-sm underline">
          Retour validation
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Contrôle biométrique</p>
          <p className="text-xs text-zinc-400">{workerName}</p>
        </div>
        <Link to="/validation" className="text-xs text-zinc-300 underline">
          Retour
        </Link>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <div className="flex h-72 w-full max-w-md items-center justify-center overflow-hidden rounded-md border border-zinc-700 bg-zinc-900">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <p className="px-4 text-center text-sm text-zinc-400">
              Cadrez le visage du MOC puis capturez la photo.
            </p>
          )}
        </div>

        {result && (
          <div className={`w-full max-w-md rounded-md border px-4 py-3 text-sm ${resultBannerClass(result.result)}`}>
            <p className="font-medium">{bioResultLabel(result.result)}</p>
            {result.score !== null && (
              <p className="mt-1 text-xs opacity-80">Score {Math.round(result.score * 100)} %</p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(event) => void handleCapture(event)}
        />

        <button
          type="button"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className="w-full max-w-md rounded-md bg-zinc-100 py-3 text-sm font-medium text-zinc-900 disabled:opacity-50"
        >
          {loading ? "Analyse en cours…" : "Capturer et analyser"}
        </button>

        {result && (
          <button
            type="button"
            onClick={() => navigate("/validation")}
            className="text-sm text-zinc-300 underline"
          >
            Retour à la validation
          </button>
        )}
      </div>
    </div>
  );
}
