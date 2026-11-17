import { useBordereaux } from "../../hooks/useBordereaux";
import { useCan } from "../../hooks/useCan";
import { BORDEREAU_STATUS_LABELS, bordereauStatusVariant } from "../../lib/payments";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

interface BordereauxListProps {
  periodIso: string;
  referenceYear?: string;
  siteId: string;
}

export default function BordereauxList({ periodIso, referenceYear, siteId }: BordereauxListProps) {
  const can = useCan();
  const allowed = can("bordereau:lecture");
  const { data } = useBordereaux(periodIso, referenceYear, siteId);

  if (!allowed || !data || data.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">Bordereaux de la période</h2>
        <p className="text-xs text-muted">Un bordereau par site.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Site</TableHead>
            <TableHead className="text-right">N°</TableHead>
            <TableHead className="text-right">Version</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Paiements</TableHead>
            <TableHead className="text-right">Brut (Ar)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((bordereau) => (
            <TableRow key={bordereau.id}>
              <TableCell>
                {bordereau.siteName} ({bordereau.siteCode})
              </TableCell>
              <TableCell className="text-right">{bordereau.number}</TableCell>
              <TableCell className="text-right">{bordereau.version}</TableCell>
              <TableCell>
                <Badge variant={bordereauStatusVariant(bordereau.status)}>
                  {BORDEREAU_STATUS_LABELS[bordereau.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{bordereau.paymentCount}</TableCell>
              <TableCell className="text-right">
                {Number(bordereau.totalAmount).toLocaleString("fr-FR")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
