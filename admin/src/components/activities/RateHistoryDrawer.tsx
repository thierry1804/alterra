import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Activity } from "../../lib/referentials";
import { formatDate, formatRate } from "../../lib/referentials";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Badge } from "../ui/badge";

interface RateHistoryDrawerProps {
  label: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RateHistoryDrawer({ label, open, onOpenChange }: RateHistoryDrawerProps) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["activities", "history", label],
    enabled: open && !!label,
    queryFn: () =>
      api
        .get<{ data: Activity[] }>("/activities", { params: { history: true } })
        .then((r) => r.data.data.filter((a) => a.label === label))
        .then((rows) => rows.sort((a, b) => b.validFrom.localeCompare(a.validFrom))),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historique tarifs — {label}</DialogTitle>
          <DialogDescription>Versions tarifaires RG-04 pour cette activité.</DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarif</TableHead>
              <TableHead>Unité</TableHead>
              <TableHead>Validité</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              history.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatRate(row.unitRate)}</TableCell>
                  <TableCell>{row.unit}</TableCell>
                  <TableCell>
                    {formatDate(row.validFrom)}
                    {row.validTo ? ` → ${formatDate(row.validTo)}` : " → en cours"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.active && !row.validTo ? "success" : "default"}>
                      {row.validTo ? "Clôturé" : "Courant"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
