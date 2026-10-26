import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { IdCard, Pencil, Plus, Power } from "lucide-react";
import { api } from "../lib/api";
import { useSiteScope } from "../lib/site-scope";
import { EmptyState } from "../components/ui/EmptyState";
import PageHeader, { LoadMoreButton } from "../components/shared/PageHeader";
import { IconButton, RowActions } from "../components/ui/IconButton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge as StatusBadge } from "../components/ui/badge";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "../hooks/use-toast";
import type { Badge as BadgeRecord, Team, Worker } from "../lib/referentials";

export default function BadgesPage() {
  const queryClient = useQueryClient();
  const [siteFilter] = useSiteScope();
  const [search, setSearch] = useState("");
  const [assignTarget, setAssignTarget] = useState<Worker | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<BadgeRecord | null>(null);

  const { data: teams = [] } = useQuery({
    queryKey: ["teams", "all"],
    queryFn: () => api.get<{ data: Team[] }>("/teams").then((r) => r.data.data),
  });

  const workersQuery = useInfiniteQuery({
    queryKey: ["workers", "badges-page", siteFilter, search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: Worker[]; nextCursor: string | null; hasMore: boolean }>("/workers", {
          params: {
            siteId: siteFilter || undefined,
            q: search || undefined,
            status: "ACTIVE",
            cursor: pageParam,
            take: 50,
          },
        })
        .then((r) => r.data),
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
  });

  const workers = useMemo(
    () => workersQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [workersQuery.data],
  );

  const badgesQuery = useQuery({
    queryKey: ["badges", siteFilter],
    queryFn: () =>
      api
        .get<{ data: BadgeRecord[] }>("/badges", { params: { siteId: siteFilter || undefined } })
        .then((r) => r.data.data),
  });

  const badgeByWorkerId = useMemo(() => {
    const map = new Map<string, BadgeRecord>();
    (badgesQuery.data ?? []).forEach((badge) => map.set(badge.workerId, badge));
    return map;
  }, [badgesQuery.data]);

  const teamName = (teamId: string | null) => teams.find((t) => t.id === teamId)?.name ?? "—";

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignTarget) return;
      const existing = badgeByWorkerId.get(assignTarget.id);
      if (existing && existing.revokedAt === null) {
        return api.patch(`/badges/${existing.id}`, { nfcTagId: tagInput.trim() });
      }
      return api.post("/badges", { workerId: assignTarget.id, nfcTagId: tagInput.trim() });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["badges"] });
      setAssignTarget(null);
      setTagInput("");
      toast({ title: "Badge enregistré" });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (badge: BadgeRecord) => api.delete(`/badges/${badge.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["badges"] });
      setRevokeTarget(null);
      toast({ title: "Badge révoqué" });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  function openAssign(worker: Worker) {
    const existing = badgeByWorkerId.get(worker.id);
    setTagInput(existing && existing.revokedAt === null ? existing.nfcTagId : "");
    setAssignTarget(worker);
  }

  const isLoading = workersQuery.isLoading;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Badges NFC"
        description="Associe la carte NFC remise à chaque travailleur — utilisée pour le pointage de présence terrain."
      />

      <Input
        placeholder="Rechercher (nom, matricule…)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      {isLoading && <p className="text-sm text-zinc-500">Chargement…</p>}

      {!isLoading && (
        <div className="rounded-lg border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matricule</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Équipe</TableHead>
                <TableHead>Badge</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      icon={IdCard}
                      title="Aucun travailleur actif"
                      hint="Ajustez la recherche ou le site sélectionné."
                    />
                  </TableCell>
                </TableRow>
              )}
              {workers.map((worker) => {
                const badge = badgeByWorkerId.get(worker.id);
                const active = !!badge && badge.revokedAt === null;
                return (
                  <TableRow
                    key={worker.id}
                    className="cursor-pointer"
                    onClick={() => openAssign(worker)}
                  >
                    <TableCell>{worker.matricule}</TableCell>
                    <TableCell className="font-medium text-zinc-900">
                      {worker.firstName} {worker.lastName}
                    </TableCell>
                    <TableCell>{teamName(worker.teamId)}</TableCell>
                    <TableCell>
                      {active ? (
                        <StatusBadge variant="success">{badge!.nfcTagId}</StatusBadge>
                      ) : badge ? (
                        <StatusBadge variant="default">Révoqué</StatusBadge>
                      ) : (
                        <StatusBadge variant="default">Aucun</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <RowActions>
                        <IconButton
                          icon={active ? Pencil : Plus}
                          label={active ? "Modifier le badge" : "Associer un badge"}
                          variant="brand"
                          onClick={() => openAssign(worker)}
                        />
                        {active && (
                          <IconButton
                            icon={Power}
                            label="Révoquer"
                            variant="destructive"
                            onClick={() => setRevokeTarget(badge!)}
                          />
                        )}
                      </RowActions>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <LoadMoreButton
        hasMore={!!workersQuery.hasNextPage}
        loading={workersQuery.isFetchingNextPage}
        onClick={() => void workersQuery.fetchNextPage()}
      />

      <Sheet open={!!assignTarget} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {assignTarget ? `${assignTarget.firstName} ${assignTarget.lastName}` : ""}
            </SheetTitle>
            <SheetDescription>
              Scannez ou saisissez l'identifiant (UID) de la carte NFC remise à ce travailleur.
            </SheetDescription>
          </SheetHeader>
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              assignMutation.mutate();
            }}
          >
            <SheetBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="badge-tag">Identifiant NFC (UID)</Label>
                <Input
                  id="badge-tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="ex. 04a2b3c4d5"
                  autoFocus
                  required
                />
                <p className="text-xs text-zinc-500">
                  UID hexadécimal de la carte — lu automatiquement par le lecteur NFC si disponible.
                </p>
              </div>
            </SheetBody>
            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setAssignTarget(null)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={!tagInput.trim() || assignMutation.isPending}
              >
                Enregistrer
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={revokeTarget !== null}
        title="Révoquer ce badge ?"
        description="Le travailleur ne pourra plus pointer sa présence avec cette carte NFC tant qu'un nouveau badge n'est pas associé."
        confirmLabel="Révoquer"
        destructive
        busy={revokeMutation.isPending}
        onConfirm={() => revokeTarget && revokeMutation.mutate(revokeTarget)}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      />
    </div>
  );
}
