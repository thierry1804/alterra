import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Send, UserCheck, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../lib/api";
import { formatMga, weekOptions, type CostsSummary } from "../../lib/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import KpiCards, { type StatCardItem } from "./KpiCards";

interface CostsSectionProps {
  siteId: string;
}

export default function CostsSection({ siteId }: CostsSectionProps) {
  const [fromWeek, setFromWeek] = useState("");
  const [toWeek, setToWeek] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", "costs", siteId, fromWeek, toWeek, categoryId],
    queryFn: () =>
      api
        .get<CostsSummary>("/dashboard/costs", {
          params: {
            siteId: siteId || undefined,
            fromWeek: fromWeek || undefined,
            toWeek: toWeek || undefined,
            categoryId: categoryId || undefined,
          },
        })
        .then((r) => r.data),
    staleTime: 60_000,
  });

  const weeks = useMemo(() => weekOptions(data?.period.campaignStart ?? null), [data]);

  const stats: StatCardItem[] = data
    ? [
        {
          key: "netPaid",
          label: "Coût payé (net)",
          icon: Wallet,
          displayValue: formatMga(data.totals.netPaid),
          sublabel: "Retour MVola importé",
        },
        {
          key: "netToExport",
          label: "Validé, à exporter",
          icon: Clock,
          displayValue: formatMga(data.totals.netToExport),
          sublabel: "Pas encore payé",
        },
        {
          key: "netAwaitingReturn",
          label: "Exporté, retour attendu",
          icon: Send,
          displayValue: formatMga(data.totals.netAwaitingReturn),
          sublabel: "Pas encore payé",
        },
        {
          key: "registered",
          label: "Travailleurs inscrits",
          icon: Users,
          displayValue: String(data.totals.registeredWorkers),
        },
        {
          key: "active",
          label: "Ayant travaillé",
          icon: UserCheck,
          displayValue: String(data.totals.activeWorkers),
          sublabel: data.period.campaignStart
            ? `Depuis le ${new Date(`${data.period.campaignStart}T00:00:00.000Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" })}`
            : "Aucun pointage",
        },
      ]
    : [];

  return (
    <section className="space-y-4" aria-label="Coûts et effectifs">
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="mr-auto text-base font-semibold text-zinc-900">Coûts et effectifs</h2>
        <div className="space-y-1">
          <Label htmlFor="costs-from">De la semaine</Label>
          <Select
            id="costs-from"
            value={fromWeek || data?.period.fromWeek || ""}
            onChange={(e) => setFromWeek(e.target.value)}
          >
            {weeks.map((week) => (
              <option key={week.value} value={week.value}>
                {week.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="costs-to">À la semaine</Label>
          <Select
            id="costs-to"
            value={toWeek || data?.period.toWeek || ""}
            onChange={(e) => setToWeek(e.target.value)}
          >
            {weeks.map((week) => (
              <option key={week.value} value={week.value}>
                {week.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="costs-category">Activité</Label>
          <Select
            id="costs-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Toutes les activités</option>
            {(data?.categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Impossible de charger les coûts.
        </p>
      )}

      {data && (
        <>
          <KpiCards stats={stats} />
          {categoryId && (
            <p className="text-xs text-muted">
              Avec une activité choisie, seul le net payé est détaillé : il est calculé comme sur la
              facture, ligne par ligne.
            </p>
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Comparaison des sites — net payé</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.bySite} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                      <XAxis dataKey="shortCode" tick={{ fontSize: 12 }} stroke="#71717a" />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="#71717a"
                        tickFormatter={(value: number) => value.toLocaleString("fr-FR")}
                      />
                      <Tooltip formatter={(value) => [formatMga(Number(value)), "Net payé"]} />
                      <Bar dataKey="netPaid" fill="#189060" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Coût par activité — net payé</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byActivity.length === 0 ? (
                  <p className="text-sm text-muted">Aucun paiement confirmé sur la période.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Activité</TableHead>
                        <TableHead className="text-right">Travailleurs</TableHead>
                        <TableHead className="text-right">Net payé</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byActivity.map((row) => (
                        <TableRow key={row.categoryId}>
                          <TableCell>{row.label}</TableCell>
                          <TableCell numeric>{row.workerCount}</TableCell>
                          <TableCell numeric>{formatMga(row.netPaid)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Détail par site</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-right">Net payé</TableHead>
                    <TableHead className="text-right">À exporter</TableHead>
                    <TableHead className="text-right">Retour attendu</TableHead>
                    <TableHead className="text-right">Inscrits</TableHead>
                    <TableHead className="text-right">Ayant travaillé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bySite.map((row) => (
                    <TableRow key={row.siteId}>
                      <TableCell>
                        {row.shortCode} — {row.name}
                      </TableCell>
                      <TableCell numeric>{formatMga(row.netPaid)}</TableCell>
                      <TableCell numeric>{formatMga(row.netToExport)}</TableCell>
                      <TableCell numeric>{formatMga(row.netAwaitingReturn)}</TableCell>
                      <TableCell numeric>{row.registeredWorkers}</TableCell>
                      <TableCell numeric>{row.activeWorkers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
