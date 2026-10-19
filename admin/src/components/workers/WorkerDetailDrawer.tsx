import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { api } from "../../lib/api";
import type { Pointage } from "../../lib/pointages";
import {
  POINTAGE_STATUS_LABELS,
  formatPointageAmount,
  pointageStatusVariant,
} from "../../lib/pointages";
import {
  WORKER_SEXE_LABELS,
  WORKER_STATUS_LABELS,
  formatDate,
  type Worker,
} from "../../lib/referentials";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";

interface WorkerDetailDrawerProps {
  worker: Worker | null;
  siteName: string;
  teamName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (worker: Worker) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-zinc-900">{children}</dd>
    </div>
  );
}

/** Fiche d'un travailleur : identité, rattachement, derniers pointages. S'ouvre sans quitter la liste. */
export default function WorkerDetailDrawer({
  worker,
  siteName,
  teamName,
  open,
  onOpenChange,
  onEdit,
}: WorkerDetailDrawerProps) {
  const pointagesQuery = useQuery({
    queryKey: ["worker-pointages", worker?.id],
    queryFn: () =>
      api
        .get<{ data: Pointage[] }>("/pointages", { params: { workerId: worker?.id } })
        .then((r) => r.data.data),
    enabled: open && Boolean(worker),
  });

  if (!worker) return null;

  const recent = pointagesQuery.data ?? [];
  const validated = recent.filter((row) => row.status === "VALIDATED");
  const validatedTotal = validated.reduce((sum, row) => sum + Number(row.amount), 0);
  const initials = `${worker.firstName[0] ?? ""}${worker.lastName[0] ?? ""}`.toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-people-bg text-sm font-bold text-people-fg">
              {initials}
            </span>
            <div className="min-w-0">
              <SheetTitle>
                {worker.firstName} {worker.lastName}
              </SheetTitle>
              <SheetDescription className="alterra-num">{worker.matricule}</SheetDescription>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={worker.status === "ACTIVE" ? "success" : "warning"} dot>
              {WORKER_STATUS_LABELS[worker.status]}
            </Badge>
            <Badge variant="info">{siteName}</Badge>
            {worker.teamId && teamName !== "—" && <Badge variant="brand">{teamName}</Badge>}
          </div>
        </SheetHeader>

        <SheetBody className="space-y-5">
          <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white px-4">
            <Row label="Numéro MVola">
              <span className="alterra-num">{worker.mvolaNumber}</span>
            </Row>
            <Row label="CIN">
              <span className="alterra-num">{worker.cinNumber ?? "—"}</span>
            </Row>
            <Row label="Sexe">
              {worker.sexe ? WORKER_SEXE_LABELS[worker.sexe] : "Non renseigné"}
            </Row>
            <Row label="Embauché le">{formatDate(worker.hiredAt)}</Row>
          </dl>

          <section aria-label="Pointages récents">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="alterra-display text-base font-bold text-zinc-900">
                Derniers pointages
              </h3>
              {validated.length > 0 && (
                <span className="text-xs text-muted">
                  {validated.length} validé(s) ·{" "}
                  <span className="alterra-num font-semibold text-zinc-900">
                    {formatPointageAmount(validatedTotal)}
                  </span>
                </span>
              )}
            </div>
            {pointagesQuery.isLoading && <p className="text-sm text-muted">Chargement…</p>}
            {!pointagesQuery.isLoading && recent.length === 0 && (
              <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-muted">
                Aucun pointage pour ce travailleur.
              </p>
            )}
            {recent.length > 0 && (
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
                {recent.slice(0, 8).map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="alterra-num font-medium text-zinc-900">
                        {formatDate(row.date)}
                      </p>
                      <p className="alterra-num text-xs text-muted">
                        {formatPointageAmount(row.amount)}
                      </p>
                    </div>
                    <Badge variant={pointageStatusVariant(row.status)}>
                      {POINTAGE_STATUS_LABELS[row.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </SheetBody>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onEdit(worker)}>
            <Pencil className="h-4 w-4" aria-hidden />
            Modifier
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
