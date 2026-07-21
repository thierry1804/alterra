import { useInfiniteQuery, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { api } from "../lib/api";
import type { Pointage, PointageStatus } from "../lib/pointages";
import {
  POINTAGE_STATUS_LABELS,
  formatPointageAmount,
  pointageStatusVariant,
} from "../lib/pointages";
import type { Activity, Worker } from "../lib/referentials";
import { formatDate } from "../lib/referentials";
import PageHeader, { LoadMoreButton } from "../components/shared/PageHeader";
import PointageDetailDrawer from "../components/pointages/PointageDetailDrawer";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

export default function PointagesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<PointageStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Pointage | null>(null);

  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get<{ data: Activity[] }>("/activities").then((r) => r.data.data),
  });

  const pointagesQuery = useInfiniteQuery({
    queryKey: ["pointages", statusFilter, dateFrom, dateTo],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: Pointage[]; nextCursor: string | null; hasMore: boolean }>("/pointages", {
          params: {
            status: statusFilter || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            cursor: pageParam,
          },
        })
        .then((r) => r.data),
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor ?? undefined : undefined),
  });

  const pointages = useMemo(
    () => pointagesQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [pointagesQuery.data],
  );

  const workerIds = useMemo(() => [...new Set(pointages.map((p) => p.workerId))], [pointages]);

  const workerQueries = useQueries({
    queries: workerIds.map((id) => ({
      queryKey: ["worker", id],
      queryFn: () => api.get<Worker>(`/workers/${id}`).then((r) => r.data),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const workersMap = useMemo(() => {
    const map = new Map<string, Worker>();
    workerQueries.forEach((query, index) => {
      if (query.data) map.set(workerIds[index], query.data);
    });
    return map;
  }, [workerQueries, workerIds]);

  const activitiesMap = useMemo(() => {
    const map = new Map<string, Activity>();
    activities.forEach((activity) => map.set(activity.id, activity));
    return map;
  }, [activities]);

  const selectedWorker = selected ? workersMap.get(selected.workerId) ?? null : null;
  const selectedActivity = selected ? activitiesMap.get(selected.activityId) ?? null : null;

  function workerLabel(workerId: string): string {
    const worker = workersMap.get(workerId);
    return worker ? `${worker.firstName} ${worker.lastName}` : workerId.slice(0, 8);
  }

  function activityLabel(activityId: string): string {
    return activitiesMap.get(activityId)?.label ?? activityId.slice(0, 8);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pointages"
        description="Validation et suivi des saisies terrain."
      />

      <div className="flex flex-wrap gap-3">
        <select
          className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PointageStatus | "")}
        >
          <option value="">Tous statuts</option>
          {(Object.keys(POINTAGE_STATUS_LABELS) as PointageStatus[]).map((status) => (
            <option key={status} value={status}>
              {POINTAGE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40"
          aria-label="Date début"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40"
          aria-label="Date fin"
        />
      </div>

      <div className="rounded-lg border border-zinc-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Date</TableHead>
              <TableHead>MOC</TableHead>
              <TableHead>Activité</TableHead>
              <TableHead>Qté</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Bio</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pointagesQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!pointagesQuery.isLoading &&
              pointages.map((pointage) => (
                <TableRow key={pointage.id}>
                  <TableCell>
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded border ${
                        pointage.photoKey
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-zinc-200 bg-zinc-50"
                      }`}
                      title={pointage.photoKey ? "Photo disponible" : "Sans photo"}
                    >
                      <Camera
                        className={`h-3.5 w-3.5 ${
                          pointage.photoKey ? "text-emerald-700" : "text-zinc-400"
                        }`}
                      />
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(pointage.date)}</TableCell>
                  <TableCell>{workerLabel(pointage.workerId)}</TableCell>
                  <TableCell>{activityLabel(pointage.activityId)}</TableCell>
                  <TableCell>{pointage.quantity}</TableCell>
                  <TableCell>{formatPointageAmount(pointage.amount)}</TableCell>
                  <TableCell>
                    {pointage.bioCheck ? (
                      <Badge
                        variant={pointage.bioCheck.result === "OK" ? "success" : "warning"}
                      >
                        {pointage.bioCheck.result}
                      </Badge>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pointageStatusVariant(pointage.status)}>
                      {POINTAGE_STATUS_LABELS[pointage.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelected(pointage)}
                    >
                      Détail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            {!pointagesQuery.isLoading && pointages.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-zinc-500">
                  Aucun pointage.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <LoadMoreButton
        hasMore={!!pointagesQuery.hasNextPage}
        loading={pointagesQuery.isFetchingNextPage}
        onClick={() => void pointagesQuery.fetchNextPage()}
      />

      <PointageDetailDrawer
        pointage={selected}
        worker={selectedWorker}
        activity={selectedActivity}
        activities={activities}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onUpdated={() => void queryClient.invalidateQueries({ queryKey: ["pointages"] })}
      />
    </div>
  );
}
