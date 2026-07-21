import type { AuditLogEntry } from "../../lib/audit";
import { auditActorLabel, formatAuditDate } from "../../lib/audit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface AuditDetailDrawerProps {
  entry: AuditLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function JsonTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) {
    return <span className="text-zinc-500">null</span>;
  }

  if (typeof value !== "object") {
    return <span className="text-zinc-900">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-zinc-500">[]</span>;
    return (
      <ul className="space-y-1 pl-3">
        {value.map((item, index) => (
          <li key={index} className="border-l border-zinc-200 pl-2">
            <span className="text-zinc-500">[{index}] </span>
            <JsonTree value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <span className="text-zinc-500">{`{}`}</span>;

  return (
    <ul className="space-y-1 pl-3">
      {entries.map(([key, nested]) => (
        <li key={key} className="border-l border-zinc-200 pl-2">
          <span className="font-medium text-zinc-700">{key}: </span>
          <JsonTree value={nested} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

export default function AuditDetailDrawer({
  entry,
  open,
  onOpenChange,
}: AuditDetailDrawerProps) {
  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry.action} · {entry.entityType}
          </DialogTitle>
          <DialogDescription>
            {formatAuditDate(entry.createdAt)} · {auditActorLabel(entry)}
            {entry.entityId ? ` · ${entry.entityId}` : ""}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-zinc-500">IP</dt>
            <dd>{entry.ip ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">User-Agent</dt>
            <dd className="truncate">{entry.userAgent ?? "—"}</dd>
          </div>
        </dl>

        <div className="grid gap-4 md:grid-cols-2">
          <section>
            <h3 className="mb-2 text-sm font-medium text-zinc-900">Avant</h3>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
              {entry.before ? (
                <JsonTree value={entry.before} />
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-medium text-zinc-900">Après</h3>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
              {entry.after ? (
                <JsonTree value={entry.after} />
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
