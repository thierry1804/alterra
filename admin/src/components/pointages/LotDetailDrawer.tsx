import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useCan } from "../../hooks/useCan";
import { toDateInput, weekEnd, weekLabel, weekStart } from "../../lib/iso-week";
import type { SynthesisRow } from "../../lib/synthese";
import {
  POINTAGE_STATUS_LABELS,
  formatPointageAmount,
  pointageStatusVariant,
  type Pointage,
} from "../../lib/pointages";
import { formatDate } from "../../lib/referentials";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { TableQueryError } from "../ui/QueryError";
import { TableRowsSkeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { fetchAllCursorPages } from "../ui/data-table/fetchAllPages";

interface LotDetailDrawerProps {
  lot: SynthesisRow | null;
  onClose: () => void;
  onValidate: (lot: SynthesisRow) => void;
}

function technicalLabel(pointage: Pointage): {
  label: string;
  variant: "default" | "success" | "warning" | "danger";
} {
  if (pointage.status !== "VALIDATED") {
    return {
      label: POINTAGE_STATUS_LABELS[pointage.status],
      variant: pointageStatusVariant(pointage.status),
    };
  }
  return pointage.technicalValidatedAt
    ? { label: "Validé technique", variant: "success" }
    : { label: "À valider", variant: "warning" };
}

export default function LotDetailDrawer({ lot, onClose, onValidate }: LotDetailDrawerProps) {
  const can = useCan();
  const canSeeAmounts = can("pointage:voir_montants");
  const canValidate = can("pointage:valider_technique");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["synthese-detail", lot?.weekIso, lot?.siteId, lot?.subActivityId],
    enabled: lot !== null,
    queryFn: () =>
      fetchAllCursorPages<Pointage>((cursor) =>
        api
          .get<{ data: Pointage[]; nextCursor: string | null; hasMore: boolean }>("/pointages", {
            params: {
              cursor,
              take: 100,
              siteId: lot!.siteId,
              subActivityId: lot!.subActivityId,
              dateFrom: toDateInput(weekStart(lot!.weekIso)),
              dateTo: toDateInput(weekEnd(lot!.weekIso)),
              orderBy: "date",
              dir: "asc",
            },
          })
          .then((r) => r.data),
      ),
  });

  const pointages = data ?? [];
  const columns = canSeeAmounts ? 5 : 4;

  return (
    <Sheet open={lot !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="max-w-2xl">
        <SheetHeader>
          <SheetTitle>Détail des pointages</SheetTitle>
          <SheetDescription>
            {lot
              ? `${lot.categoryLabel} › ${lot.activityLabel} · ${lot.siteName} · ${weekLabel(lot.weekIso)}`
              : ""}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Travailleur</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                {canSeeAmounts && <TableHead className="text-right">Montant</TableHead>}
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={5} cols={columns} />
              ) : isError ? (
                <TableQueryError
                  colSpan={columns}
                  what="les pointages"
                  onRetry={() => void refetch()}
                />
              ) : (
                pointages.map((pointage) => {
                  const status = technicalLabel(pointage);
                  return (
                    <TableRow key={pointage.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(pointage.date)}
                      </TableCell>
                      <TableCell>
                        {pointage.worker
                          ? `${pointage.worker.lastName} ${pointage.worker.firstName}`
                          : pointage.workerId.slice(0, 8)}
                        {pointage.worker && (
                          <div className="text-xs text-muted">{pointage.worker.matricule}</div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {Number(pointage.quantity).toLocaleString("fr-FR", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        {lot?.unit}
                      </TableCell>
                      {canSeeAmounts && (
                        <TableCell className="whitespace-nowrap text-right">
                          {pointage.amount !== undefined
                            ? formatPointageAmount(pointage.amount)
                            : "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
          {canValidate && lot && lot.toValidate > 0 && (
            <Button type="button" onClick={() => onValidate(lot)}>
              Valider ({lot.toValidate})
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
