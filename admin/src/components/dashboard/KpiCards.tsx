import { Users, UserCheck, ClipboardList, CreditCard } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { formatMga, formatPercent, type DashboardSummary } from "../../lib/dashboard";

interface KpiCardsProps {
  kpis: DashboardSummary["kpis"];
}

const items = [
  {
    key: "activeWorkers" as const,
    label: "Effectifs actifs",
    icon: Users,
    format: (value: number) => String(value),
  },
  {
    key: "presenceRate" as const,
    label: "Présence semaine",
    icon: UserCheck,
    format: (value: number) => formatPercent(value),
  },
  {
    key: "pendingPointages" as const,
    label: "Pointages en attente",
    icon: ClipboardList,
    format: (value: number) => String(value),
  },
  {
    key: "pendingPaymentsAmount" as const,
    label: "Paiements en attente",
    icon: CreditCard,
    format: (value: number) => formatMga(value),
  },
];

export default function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        const value =
          item.key === "pendingPaymentsAmount"
            ? kpis.pendingPaymentsAmount
            : kpis[item.key];

        const highlightPending =
          item.key === "pendingPointages" && kpis.pendingPointages > 10;
        const highlightPayments =
          item.key === "pendingPaymentsAmount" && kpis.pendingPaymentsCount > 0;

        return (
          <Card
            key={item.key}
            className={
              highlightPending
                ? "border-amber-300"
                : highlightPayments
                  ? "border-zinc-300"
                  : undefined
            }
          >
            <CardContent className="flex items-start justify-between p-4">
              <div>
                <p className="text-xs text-zinc-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">{item.format(value)}</p>
                {item.key === "pendingPaymentsAmount" && kpis.pendingPaymentsCount > 0 && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {kpis.pendingPaymentsCount} ligne(s)
                  </p>
                )}
              </div>
              <Icon className="h-4 w-4 text-zinc-400" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
