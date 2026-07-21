import {
  REPORT_COLUMN_LABELS,
  formatReportCell,
  type ReportPreview,
} from "../../lib/reports";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface ReportPreviewTableProps {
  report: ReportPreview | undefined;
  loading: boolean;
}

export default function ReportPreviewTable({ report, loading }: ReportPreviewTableProps) {
  if (loading) {
    return <p className="text-sm text-zinc-600">Chargement de l&apos;aperçu…</p>;
  }

  if (!report) {
    return <p className="text-sm text-zinc-600">Sélectionnez un rapport et une période.</p>;
  }

  if (report.rows.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        Aucune donnée pour {report.meta.title.toLowerCase()} ({report.meta.dateFrom} →{" "}
        {report.meta.dateTo}).
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200">
      <Table>
        <TableHeader>
          <TableRow>
            {report.columns.map((column) => (
              <TableHead key={column}>{REPORT_COLUMN_LABELS[column] ?? column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.rows.slice(0, 50).map((row, index) => (
            <TableRow key={index}>
              {report.columns.map((column) => (
                <TableCell key={column}>{formatReportCell(column, row[column] ?? null)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {report.rows.length > 50 && (
        <p className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500">
          Aperçu limité à 50 lignes sur {report.rows.length}. Export complet via CSV / Excel.
        </p>
      )}
    </div>
  );
}
