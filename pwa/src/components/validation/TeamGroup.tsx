import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import type { ActivitySummary, Pointage, WorkerSummary } from "../../lib/pointages";
import {
  bioResultClass,
  bioResultLabel,
  formatPointageAmount,
} from "../../lib/pointages";
import Button from "../ui/Button";

export interface TeamGroupItem {
  pointage: Pointage;
  worker: WorkerSummary;
  activity: ActivitySummary;
}

interface TeamGroupProps {
  teamLabel: string;
  teamKey: string;
  items: TeamGroupItem[];
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
  busyId,
  bulkBusy = false,
  bulkProgress,
  onValidate,
  onReject,
  onValidateTeam,
}: TeamGroupProps) {
  const eligibleCount = items.filter(({ pointage }) => isBioEligible(pointage)).length;
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
            disabled={bulkBusy || busyId !== null}
            onClick={() => onValidateTeam(teamKey, items)}
          >
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
            <article
              key={pointage.id}
              className="rounded-md border border-zinc-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {worker.firstName} {worker.lastName}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {worker.matricule} · {activity.label} · {pointage.date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-zinc-900">
                    {formatPointageAmount(pointage.amount)}
                  </p>
                  <span
                    className={cn(
                      "mt-1 inline-block rounded border px-2 py-0.5 text-xs",
                      bioResultClass(pointage.bioCheck?.result),
                    )}
                  >
                    {bioResultLabel(pointage.bioCheck?.result)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={`/validation/bio/${worker.id}?pointageId=${pointage.id}&date=${pointage.date}`}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-md border border-zinc-300 px-3 text-sm text-zinc-700",
                    "hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2",
                  )}
                >
                  Contrôle bio
                </Link>
                <Link
                  to={`/clarifications?pointageId=${pointage.id}`}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-md border border-zinc-300 px-3 text-sm text-zinc-700",
                    "hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2",
                  )}
                >
                  Précisions
                </Link>
                <Button size="sm" disabled={busy} onClick={() => onValidate(pointage.id)}>
                  Valider
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onReject(pointage.id)}
                >
                  Rejeter
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
