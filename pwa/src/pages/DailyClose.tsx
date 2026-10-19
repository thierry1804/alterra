import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { cn } from "../lib/cn";
import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import { Spinner } from "../components/ui/feedback";
import { IconSync, IconCloture } from "../components/icons";
import ContextHelp, { GlossaryTerm } from "../components/ui/ContextHelp";
import PageHeader from "../components/ui/PageHeader";
import Stepper from "../components/ui/Stepper";
import StickyAction from "../components/ui/StickyAction";
import { IconChevronRight } from "../components/icons";
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
  const [step, setStep] = useState<0 | 1>(0);
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

  function shiftDate(days: number) {
    const next = new Date(`${date}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + days);
    setDate(next.toISOString().slice(0, 10));
  }

  const blocked = preview?.requiresConfirm && !confirmPending;

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Clôture"
        subtitle="Vérifiez, signez, générez le rapport PDF."
        help={
          <ContextHelp id="daily-close" title="Clôture journalière">
            <p>
              Vérifiez les compteurs avant signature. Si des pointages restent en attente, une
              confirmation explicite est requise.
            </p>
            <GlossaryTerm term="Semaine ISO">
              Période de paie associée à la date clôturée.
            </GlossaryTerm>
          </ContextHelp>
        }
        action={
          <IconButton icon={IconSync} label="Actualiser" onClick={() => void loadPreview()} />
        }
      />

      <Stepper steps={["Vérifier", "Signer"]} current={step} />

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

      {step === 0 && (
        <section className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-2">
          <button
            type="button"
            aria-label="Jour précédent"
            onClick={() => shiftDate(-1)}
            className="alterra-focus grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-700 active:bg-zinc-100"
          >
            <IconChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div className="relative min-w-0 flex-1 text-center">
            <p className="text-sm font-semibold capitalize text-zinc-900">
              {new Date(`${date}T00:00:00.000Z`).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              })}
            </p>
            <label htmlFor="close-date" className="sr-only">
              Date
            </label>
            <input
              id="close-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
          <button
            type="button"
            aria-label="Jour suivant"
            onClick={() => shiftDate(1)}
            className="alterra-focus grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-700 active:bg-zinc-100"
          >
            <IconChevronRight className="h-5 w-5" />
          </button>
        </section>
      )}

      {loading && (
        <div className="flex items-center gap-2 px-1 text-sm text-zinc-600">
          <Spinner className="h-4 w-4" />
          Analyse de la journée…
        </div>
      )}

      {step === 0 && preview && !loading && (
        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-900">
            Résumé · <span className="alterra-num">{preview.periodIso}</span>
          </h2>

          <div className="mt-3 rounded-2xl bg-brand-tint px-4 py-3">
            <p className="text-xs font-semibold text-brand">Montant à payer</p>
            <p className="alterra-display alterra-num mt-0.5 text-3xl font-extrabold text-brand">
              {preview.totalAmount} Ar
            </p>
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-2 text-center min-[420px]:grid-cols-5">
            {[
              { label: "Validés", value: preview.validatedCount, tone: "text-brand" },
              { label: "Travailleurs", value: preview.workerCount, tone: "text-zinc-900" },
              {
                label: "En attente",
                value: preview.pendingCount,
                tone: preview.pendingCount > 0 ? "text-amber-600" : "text-zinc-400",
              },
              {
                label: "Précisions",
                value: preview.needsClarificationCount,
                tone: preview.needsClarificationCount > 0 ? "text-people-fg" : "text-zinc-400",
              },
              {
                label: "Rejetés",
                value: preview.rejectedCount,
                tone: preview.rejectedCount > 0 ? "text-red-600" : "text-zinc-400",
              },
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

      {step === 1 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Signature électronique</h2>
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
          <Button type="button" variant="ghost" className="mt-2 w-full" onClick={() => setStep(0)}>
            Retour à la vérification
          </Button>
        </section>
      )}

      {step === 0 && (
        <StickyAction>
          <Button
            size="lg"
            className="w-full justify-between rounded-2xl bg-[color:var(--color-earth)] shadow-lg hover:opacity-90"
            disabled={loading || !preview || Boolean(blocked)}
            onClick={() => setStep(1)}
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span>Continuer vers la signature</span>
              <IconChevronRight className="h-4 w-4 shrink-0" />
            </span>
          </Button>
        </StickyAction>
      )}

      {jobStatus?.state === "completed" && jobStatus.result?.reportUrl && (
        <p className="text-xs text-zinc-500">Rapport archivé ({jobStatus.result.reportKey}).</p>
      )}
    </div>
  );
}
