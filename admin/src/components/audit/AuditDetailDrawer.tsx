import type { ReactNode } from "react";
import { Fragment } from "react";
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

type JsonValue = unknown;

function isPlainObject(value: JsonValue): value is Record<string, JsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEqual(a: JsonValue, b: JsonValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function LeafValue({ value }: { value: JsonValue }) {
  if (value === null || value === undefined) {
    return <span className="text-zinc-400">null</span>;
  }
  if (typeof value !== "object") {
    return <span>{String(value)}</span>;
  }
  return <span className="text-zinc-500">{JSON.stringify(value)}</span>;
}

function DiffRow({
  marker,
  className,
  children,
}: {
  marker: "+" | "-" | " ";
  className: string;
  children: ReactNode;
}) {
  return (
    <li className={`flex gap-1.5 rounded px-1.5 py-0.5 ${className}`}>
      <span className="w-3 shrink-0 select-none font-mono font-semibold">{marker}</span>
      <span className="min-w-0 break-all">{children}</span>
    </li>
  );
}

function DiffTree({ before, after }: { before: JsonValue; after: JsonValue }) {
  if (isPlainObject(before) || isPlainObject(after)) {
    const beforeObj = isPlainObject(before) ? before : {};
    const afterObj = isPlainObject(after) ? after : {};
    const keys = Array.from(
      new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]),
    );
    if (keys.length === 0) return <span className="text-zinc-500">{"{}"}</span>;

    return (
      <ul className="space-y-0.5">
        {keys.map((key) => {
          const inBefore = Object.prototype.hasOwnProperty.call(beforeObj, key);
          const inAfter = Object.prototype.hasOwnProperty.call(afterObj, key);
          const bVal = beforeObj[key];
          const aVal = afterObj[key];

          if (inBefore && !inAfter) {
            return (
              <DiffRow key={key} marker="-" className="bg-red-50 text-red-700">
                <span className="font-medium">{key}: </span>
                <LeafValue value={bVal} />
              </DiffRow>
            );
          }

          if (!inBefore && inAfter) {
            return (
              <DiffRow key={key} marker="+" className="bg-green-50 text-green-700">
                <span className="font-medium">{key}: </span>
                <LeafValue value={aVal} />
              </DiffRow>
            );
          }

          if (isEqual(bVal, aVal)) {
            return (
              <DiffRow key={key} marker=" " className="text-zinc-500">
                <span className="font-medium text-zinc-700">{key}: </span>
                <LeafValue value={aVal} />
              </DiffRow>
            );
          }

          if (isPlainObject(bVal) || isPlainObject(aVal)) {
            return (
              <li key={key} className="space-y-0.5 rounded bg-amber-50/70 px-1.5 py-0.5">
                <span className="font-medium text-amber-800">{key}:</span>
                <div className="pl-3">
                  <DiffTree before={bVal} after={aVal} />
                </div>
              </li>
            );
          }

          return (
            <Fragment key={key}>
              <DiffRow marker="-" className="bg-red-50 text-red-700 line-through decoration-red-400">
                <span className="font-medium">{key}: </span>
                <LeafValue value={bVal} />
              </DiffRow>
              <DiffRow marker="+" className="bg-green-50 text-green-700">
                <span className="font-medium">{key}: </span>
                <LeafValue value={aVal} />
              </DiffRow>
            </Fragment>
          );
        })}
      </ul>
    );
  }

  if (isEqual(before, after)) {
    return <LeafValue value={after ?? before} />;
  }

  return (
    <ul className="space-y-0.5">
      <DiffRow marker="-" className="bg-red-50 text-red-700 line-through decoration-red-400">
        <LeafValue value={before} />
      </DiffRow>
      <DiffRow marker="+" className="bg-green-50 text-green-700">
        <LeafValue value={after} />
      </DiffRow>
    </ul>
  );
}

function DiffLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-200" /> Ajouté
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-200" /> Modifié
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-200" /> Supprimé
      </span>
    </div>
  );
}

export default function AuditDetailDrawer({
  entry,
  open,
  onOpenChange,
}: AuditDetailDrawerProps) {
  if (!entry) return null;

  const hasBefore = entry.before !== null && entry.before !== undefined;
  const hasAfter = entry.after !== null && entry.after !== undefined;

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

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-900">Modifications</h3>
            <DiffLegend />
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
            {hasBefore || hasAfter ? (
              <DiffTree before={entry.before} after={entry.after} />
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
