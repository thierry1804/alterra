import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { formatMga, type DashboardSummary } from "../../lib/dashboard";
import type { NavCounts } from "../../hooks/useNavCounts";

interface TodoStripProps {
  kpis: DashboardSummary["kpis"];
  counts: NavCounts;
  isAdmin: boolean;
}

interface TodoItem {
  key: string;
  label: string;
  value: string;
  pending: boolean;
  doneHint: string;
  todoHint: string;
  to: string;
}

/** « À traiter » : ce qui attend un geste, avec le lien direct. Tout à zéro = un message rassurant. */
export default function TodoStrip({ kpis, counts, isAdmin }: TodoStripProps) {
  const items: TodoItem[] = [
    {
      key: "pointages",
      label: "Pointages à valider",
      value: String(kpis.pendingPointages),
      pending: kpis.pendingPointages > 0,
      doneHint: "Tout est validé",
      todoHint: "Ouvrir les pointages",
      to: "/pointages",
    },
    ...(isAdmin
      ? [
          {
            key: "requests",
            label: "Demandes en attente",
            value: String(counts.requests),
            pending: counts.requests > 0,
            doneHint: "Tout est traité",
            todoHint: "Ouvrir la file",
            to: "/requests",
          },
          {
            key: "payments",
            label: "Prêt à exporter MVola",
            value: formatMga(kpis.pendingPaymentsAmount),
            pending: kpis.pendingPaymentsCount > 0,
            doneHint: "Rien à exporter",
            todoHint: `${kpis.pendingPaymentsCount} ligne(s) · Paiements`,
            to: "/payments",
          },
        ]
      : []),
  ];

  return (
    <section aria-label="À traiter" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Link key={item.key} to={item.to} className="group alterra-focus rounded-xl">
          <Card
            className={cn(
              "h-full p-4 shadow-xs transition-shadow group-hover:shadow-sm",
              item.pending && "border-amber-300 bg-warning-bg/50",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
              {item.label}
            </p>
            <p
              className={cn(
                "alterra-display alterra-num mt-1.5 text-3xl font-extrabold",
                item.pending ? "text-warning" : "text-brand",
              )}
            >
              {item.value}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              {item.pending ? (
                <>
                  {item.todoHint}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand" aria-hidden />
                  {item.doneHint}
                </>
              )}
            </p>
          </Card>
        </Link>
      ))}
    </section>
  );
}
