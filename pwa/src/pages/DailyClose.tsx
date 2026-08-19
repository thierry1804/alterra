import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { cn } from "../lib/cn";
import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import { Spinner } from "../components/ui/feedback";
import { IconSync, IconCloture } from "../components/icons";
import ContextHelp, { GlossaryTerm } from "../components/ui/ContextHelp";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

interface DailyClosePreview {
  date: string;
  periodIso: string;
  validatedCount: number;
  pendingCount: number;
  needsClarificationCount: number;
  rejectedCount: number;
  totalAmount: string;
  workerCount: number;
  requiresConfirm: boolean;
}

interface DailyJobStatus {
  id: string;
  state: "waiting" | "active" | "completed" | "failed";
  result?: {
    reportKey: string;
    reportUrl: string;
    periodIso: string;
  };
  error?: string;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function errorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const message = err.response?.data?.message as string | undefined;
    const code = err.response?.data?.code as string | undefined;
    if (message) return message;
    if (code === "CONFIRM_REQUIRED") {
      return "Confirmez la clôture malgré les pointages non finalisés.";
    }
  }
  return fallback;
}

export default function DailyClose() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayIsoDate());
  const [preview, setPreview] = useState<DailyClosePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [signatureText, setSignatureText] = useState("");
  const [certify, setCertify] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [jobStatus, setJobStatus] = useState<DailyJobStatus | null>(null);

  useEffect(() => {
    if (user) {
      setSignatureText(`${user.firstName} ${user.lastName}`.trim());
    }
  }, [user]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<DailyClosePreview>("/reports/daily/preview", {
        params: { date },
      });
      setPreview(response.data);
      setConfirmPending(false);
    } catch (err) {
      setPreview(null);
      setError(errorMessage(err, "Impossible de charger l'état de la journée."));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  async function pollJob(jobId: string): Promise<DailyJobStatus> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await api.get<DailyJobStatus>(`/reports/daily/jobs/${jobId}`);
      if (response.data.state === "completed" || response.data.state === "failed") {
        return response.data;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
    throw new Error("Délai dépassé pour la génération du rapport");
  }

  async function handleCloseDay() {
    if (!certify || signatureText.trim().length < 3) return;
    if (preview?.requiresConfirm && !confirmPending) {
      setError("Cochez la confirmation pour clôturer malgré les pointages non finalisés.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    setJobStatus(null);
    try {
      const response = await api.post<{ jobId: string }>("/reports/daily", {
        date,
        signatureText: signatureText.trim(),
        confirmPending: preview?.requiresConfirm ? confirmPending : undefined,
      });
      setMessage("Génération du rapport en cours…");
      const status = await pollJob(response.data.jobId);
      setJobStatus(status);
      if (status.state === "completed") {
        setMessage("Journée clôturée — rapport envoyé à l'administrateur.");
      } else {
        setError(status.error ?? "Génération du rapport échouée.");
      }
    } catch (err) {
      setError(errorMessage(err, "Clôture journalière échouée."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Clôture journalière</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Vérifiez les pointages du jour, signez et générez le rapport PDF.
          </p>
        </div>
        <IconButton icon={IconSync} label="Actualiser" onClick={() => void loadPreview()} />
      </header>

      <ContextHelp id="daily-close" title="Clôture journalière">
        <p>Vérifiez les compteurs avant signature. Si des pointages restent en attente, une confirmation explicite est requise.</p>
        <GlossaryTerm term="Semaine ISO">Période de paie associée à la date clôturée.</GlossaryTerm>
      </ContextHelp>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {message}
        </p>
      )}

      <section className="rounded-md border border-zinc-200 bg-white p-4">
        <label className="block text-xs font-medium text-zinc-600" htmlFor="close-date">
          Date
        </label>
        <input
          id="close-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </section>

      {loading && (
        <div className="flex items-center gap-2 px-1 text-sm text-zinc-600">
          <Spinner className="h-4 w-4" />
          Analyse de la journée…
        </div>
      )}

      {preview && !loading && (
        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-900">
            Résumé · <span className="alterra-num">{preview.periodIso}</span>
          </h2>

          <div className="mt-3 rounded-md bg-brand-tint/50 px-3 py-2.5">
            <p className="text-xs font-medium text-zinc-600">Montant à payer</p>
            <p className="alterra-num mt-0.5 text-xl font-semibold text-brand">
              {preview.totalAmount} Ar
            </p>
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Validés", value: preview.validatedCount, tone: "text-brand" },
              { label: "Travailleurs", value: preview.workerCount, tone: "text-zinc-900" },
              { label: "En attente", value: preview.pendingCount, tone: preview.pendingCount > 0 ? "text-amber-600" : "text-zinc-400" },
              { label: "Précisions", value: preview.needsClarificationCount, tone: preview.needsClarificationCount > 0 ? "text-people-fg" : "text-zinc-400" },
              { label: "Rejetés", value: preview.rejectedCount, tone: preview.rejectedCount > 0 ? "text-red-600" : "text-zinc-400" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-md border border-zinc-200 py-2">
                <dd className={cn("alterra-num text-lg font-semibold", stat.tone)}>{stat.value}</dd>
                <dt className="mt-0.5 text-[11px] text-zinc-500">{stat.label}</dt>
              </div>
            ))}
          </dl>

          {preview.requiresConfirm && (
            <label className="mt-4 flex items-start gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={confirmPending}
                onChange={(event) => setConfirmPending(event.target.checked)}
                className="mt-1"
              />
              Je confirme la clôture alors que des pointages ne sont pas finalisés.
            </label>
          )}
        </section>
      )}

      <section className="rounded-md border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-900">Signature électronique</h2>
        <label className="mt-3 block text-xs font-medium text-zinc-600" htmlFor="signature">
          Nom signataire
        </label>
        <input
          id="signature"
          value={signatureText}
          onChange={(event) => setSignatureText(event.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <label className="mt-3 flex items-start gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={certify}
            onChange={(event) => setCertify(event.target.checked)}
            className="mt-1"
          />
          Je certifie l'exactitude des pointages validés pour cette journée.
        </label>
        <Button
          type="button"
          size="lg"
          className="mt-4 w-full gap-2"
          disabled={submitting || !certify || signatureText.trim().length < 3}
          onClick={() => void handleCloseDay()}
        >
          {submitting ? (
            <Spinner className="h-4 w-4 text-white" />
          ) : (
            <IconCloture className="h-4 w-4 shrink-0" />
          )}
          {submitting ? "Clôture en cours…" : "Clôturer et envoyer le rapport"}
        </Button>
      </section>

      {jobStatus?.state === "completed" && jobStatus.result?.reportUrl && (
        <p className="text-xs text-zinc-500">
          Rapport archivé ({jobStatus.result.reportKey}).
        </p>
      )}
    </div>
  );
}
