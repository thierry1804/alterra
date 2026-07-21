import type { LucideIcon } from "lucide-react";
import { Users, UserCheck, ClipboardList, CreditCard } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { formatMga, formatPercent, type DashboardSummary } from "../../lib/dashboard";

export interface StatCardItem {
  key: string;
  label: string;
  icon: LucideIcon;
  displayValue: string;
  highlight?: boolean;
  sublabel?: string;
  valueClassName?: string;
}

interface KpiCardsProps {
  kpis?: DashboardSummary["kpis"];
  stats?: StatCardItem[];
}

const dashboardItems = [
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

export default function KpiCards({ kpis, stats }: KpiCardsProps) {
  const cards: StatCardItem[] =
    stats ??
    (kpis
      ? dashboardItems.map((item) => {
          const value =
            item.key === "pendingPaymentsAmount"
              ? kpis.pendingPaymentsAmount
              : kpis[item.key];
          const highlightPending =
            item.key === "pendingPointages" && kpis.pendingPointages > 10;
          const highlightPayments =
            item.key === "pendingPaymentsAmount" && kpis.pendingPaymentsCount > 0;
          return {
            key: item.key,
            label: item.label,
            icon: item.icon,
            displayValue: item.format(value),
            highlight: highlightPending || highlightPayments,
            sublabel:
              item.key === "pendingPaymentsAmount" && kpis.pendingPaymentsCount > 0
                ? `${kpis.pendingPaymentsCount} ligne(s)`
                : undefined,
          };
        })
      : []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.key}
            className={item.highlight ? "border-amber-300" : undefined}
          >
            <CardContent className="flex items-start justify-between p-4">
              <div>
                <p className="text-xs text-zinc-600">{item.label}</p>
                <p className={`mt-2 text-2xl font-semibold text-zinc-900 ${item.valueClassName ?? ""}`}>
                  {item.displayValue}
                </p>
                {item.sublabel && (
                  <p className="mt-1 text-xs text-zinc-600">{item.sublabel}</p>
                )}
              </div>
              <Icon className="h-4 w-4 text-zinc-500" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
