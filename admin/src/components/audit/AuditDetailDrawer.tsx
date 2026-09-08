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

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  );
}

type DiffStatus = "added" | "removed" | "changed" | "same";
type DiffSide = "before" | "after";

/** Statut d'une clé/index en comparant sa présence + égalité profonde des deux côtés. */
function fieldStatus(hasOwn: boolean, hasOther: boolean, own: unknown, other: unknown): DiffStatus {
  if (hasOwn && !hasOther) return "removed";
  if (!hasOwn && hasOther) return "added";
  return deepEqual(own, other) ? "same" : "changed";
}

/** Classe de surlignage façon diff git : rouge côté "avant" retiré/modifié, vert côté "après" ajouté/modifié. */
function diffClass(side: DiffSide, status: DiffStatus): string {
  if (side === "before" && (status === "removed" || status === "changed")) {
    return "bg-danger-bg text-danger rounded px-1 -mx-1";
  }
  if (side === "after" && (status === "added" || status === "changed")) {
    return "bg-success-bg text-success rounded px-1 -mx-1";
  }
  return "";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Rend le même arbre que JsonTree mais colore chaque clé/index selon sa
 * différence avec l'objet miroir de l'autre côté (before vs after), à la
 * manière d'un diff git : seules les parties qui changent sont surlignées,
 * le reste de la structure commune reste neutre.
 */
function DiffTree({
  own,
  counterpart,
  side,
}: {
  own: unknown;
  counterpart: unknown;
  side: DiffSide;
}) {
  if (own === null || own === undefined) {
    return <span className="text-zinc-500">null</span>;
  }

  if (typeof own !== "object") {
    const changed = !deepEqual(own, counterpart);
    return (
      <span className={changed ? diffClass(side, "changed") : "text-zinc-900"}>
        {String(own)}
      </span>
    );
  }

  if (Array.isArray(own)) {
    if (own.length === 0) return <span className="text-zinc-500">[]</span>;
    const counterpartArr = Array.isArray(counterpart) ? counterpart : undefined;
    return (
      <ul className="space-y-1 pl-3">
        {own.map((item, index) => {
          const hasCounterpart = counterpartArr !== undefined && index < counterpartArr.length;
          const counterItem = hasCounterpart ? counterpartArr[index] : undefined;
          const status = fieldStatus(true, hasCounterpart, item, counterItem);
          const recurse =
            status === "changed" &&
            ((isPlainObject(item) && isPlainObject(counterItem)) ||
              (Array.isArray(item) && Array.isArray(counterItem)));
          return (
            <li key={index} className="border-l border-zinc-200 pl-2">
              <span className="text-zinc-500">[{index}] </span>
              {recurse ? (
                <DiffTree own={item} counterpart={counterItem} side={side} />
              ) : status === "same" ? (
                <JsonTree value={item} />
              ) : (
                <span className={diffClass(side, status)}>
                  <JsonTree value={item} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  const entries = Object.entries(own as Record<string, unknown>);
  if (entries.length === 0) return <span className="text-zinc-500">{`{}`}</span>;
  const counterpartObj = isPlainObject(counterpart) ? counterpart : undefined;

  return (
    <ul className="space-y-1 pl-3">
      {entries.map(([key, nested]) => {
        const hasCounterpart = counterpartObj !== undefined && key in counterpartObj;
        const counterValue = hasCounterpart ? counterpartObj![key] : undefined;
        const status = fieldStatus(true, hasCounterpart, nested, counterValue);
        const recurse =
          status === "changed" &&
          ((isPlainObject(nested) && isPlainObject(counterValue)) ||
            (Array.isArray(nested) && Array.isArray(counterValue)));
        return (
          <li key={key} className="border-l border-zinc-200 pl-2">
            <span className="font-medium text-zinc-700">{key}: </span>
            {recurse ? (
              <DiffTree own={nested} counterpart={counterValue} side={side} />
            ) : status === "same" ? (
              <JsonTree value={nested} />
            ) : (
              <span className={diffClass(side, status)}>
                <JsonTree value={nested} />
              </span>
            )}
          </li>
        );
      })}
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
                <DiffTree own={entry.before} counterpart={entry.after} side="before" />
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-medium text-zinc-900">Après</h3>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
              {entry.after ? (
                <DiffTree own={entry.after} counterpart={entry.before} side="after" />
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
