import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import type { ActivitySummary, Pointage, WorkerSummary } from "../../lib/pointages";
import { bioResultClass, bioResultLabel, formatPointageAmount } from "../../lib/pointages";
import Button from "../ui/Button";
import PointagePhotoViewer from "../pointage/PointagePhotoViewer";
import { IconBio, IconPrecisions, IconCheck, IconClose } from "../icons";

function formatEnteredAt(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export interface TeamGroupItem {
  pointage: Pointage;
  worker: WorkerSummary;
  activity: ActivitySummary;
}

interface TeamGroupProps {
  teamLabel: string;
  teamKey: string;
  items: TeamGroupItem[];
  bioValidationRequired: boolean;
  busyId: string | null;
  bulkBusy?: boolean;
  bulkProgress?: { done: number; total: number } | null;
  onValidate: (pointageId: string) => void;
  onReject: (pointageId: string) => void;
  onValidateTeam?: (teamKey: string, items: TeamGroupItem[]) => void;
}

function isBioEligible(pointage: Pointage): boolean {
  return pointage.bioCheck?.result === "OK";
}

export default function TeamGroup({
  teamLabel,
  teamKey,
  items,
  bioValidationRequired,
  busyId,
  bulkBusy = false,
  bulkProgress,
  onValidate,
  onReject,
  onValidateTeam,
}: TeamGroupProps) {
  const eligibleCount = bioValidationRequired
    ? items.filter(({ pointage }) => isBioEligible(pointage)).length
    : items.length;
  const isBulkActive = bulkProgress !== null && bulkProgress !== undefined;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">{teamLabel}</h2>
          <span className="text-xs text-zinc-600">{items.length} travailleur(s)</span>
        </div>
        {onValidateTeam && eligibleCount > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={bulkBusy || busyId !== null}
            onClick={() => onValidateTeam(teamKey, items)}
          >
            <IconCheck className="h-4 w-4 shrink-0" />
            {isBulkActive
              ? `Validation ${bulkProgress.done}/${bulkProgress.total}…`
              : `Valider l'équipe (${eligibleCount})`}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {items.map(({ pointage, worker, activity }) => {
          const busy = busyId === pointage.id || bulkBusy;
          return (
            <article key={pointage.id} className="rounded-md border border-zinc-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {pointage.photoKey && <PointagePhotoViewer pointageId={pointage.id} />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900">
                      {worker.firstName} {worker.lastName}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {worker.matricule} · {activity.label} · {pointage.date}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Saisi par{" "}
                      {pointage.enteredBy
                        ? `${pointage.enteredBy.firstName} ${pointage.enteredBy.lastName}`
                        : "inconnu"}{" "}
                      · {formatEnteredAt(pointage.createdByClientAt)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="alterra-num text-sm font-semibold text-zinc-900">
                    {formatPointageAmount(pointage.amount)}
                  </p>
                  {bioValidationRequired ? (
                    <span
                      className={cn(
                        "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        bioResultClass(pointage.bioCheck?.result),
                      )}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
                        aria-hidden
                      />
                      {bioResultLabel(pointage.bioCheck?.result)}
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
                        aria-hidden
                      />
                      Bio contournée
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to={`/validation/bio/${worker.id}?pointageId=${pointage.id}&date=${pointage.date}`}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700",
                      "hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2",
                    )}
                  >
                    <IconBio className="h-4 w-4 shrink-0" />
                    Contrôle bio
                  </Link>
                  <Link
                    to={`/clarifications?pointageId=${pointage.id}`}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700",
                      "hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2",
                    )}
                  >
                    <IconPrecisions className="h-4 w-4 shrink-0" />
                    Précisions
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="gap-1.5"
                    disabled={busy}
                    onClick={() => onValidate(pointage.id)}
                  >
                    <IconCheck className="h-4 w-4 shrink-0" />
                    Valider
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-1.5 text-red-700 hover:bg-red-50"
                    disabled={busy}
                    onClick={() => onReject(pointage.id)}
                  >
                    <IconClose className="h-4 w-4 shrink-0" />
                    Rejeter
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
