import { Link } from "react-router-dom";
import type { ActivitySummary, Pointage, WorkerSummary } from "../../lib/pointages";
import {
  bioResultClass,
  bioResultLabel,
  formatPointageAmount,
} from "../../lib/pointages";

export interface TeamGroupItem {
  pointage: Pointage;
  worker: WorkerSummary;
  activity: ActivitySummary;
}

interface TeamGroupProps {
  teamLabel: string;
  items: TeamGroupItem[];
  busyId: string | null;
  onValidate: (pointageId: string) => void;
  onReject: (pointageId: string) => void;
}

export default function TeamGroup({
  teamLabel,
  items,
  busyId,
  onValidate,
  onReject,
}: TeamGroupProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">{teamLabel}</h2>
        <span className="text-xs text-zinc-500">{items.length} MOC</span>
      </div>

      <div className="space-y-2">
        {items.map(({ pointage, worker, activity }) => {
          const busy = busyId === pointage.id;
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
                  <p className="text-xs text-zinc-500">
                    {worker.matricule} · {activity.label} · {pointage.date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-zinc-900">
                    {formatPointageAmount(pointage.amount)}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] ${bioResultClass(pointage.bioCheck?.result)}`}
                  >
                    {bioResultLabel(pointage.bioCheck?.result)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={`/validation/bio/${worker.id}?pointageId=${pointage.id}&date=${pointage.date}`}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                >
                  Contrôle bio
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onValidate(pointage.id)}
                  className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-50"
                >
                  Valider
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onReject(pointage.id)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-50"
                >
                  Rejeter
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
