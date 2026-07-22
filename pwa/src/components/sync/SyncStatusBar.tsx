import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useSyncState } from "../../hooks/useSyncState";
import { IconChevronRight } from "../icons";

type Tone = "ok" | "sync" | "warn" | "danger";

const TONE: Record<Tone, { row: string; dot: string }> = {
  ok: { row: "border-zinc-200 bg-white text-zinc-600", dot: "bg-emerald-600" },
  sync: { row: "border-zinc-200 bg-white text-brand", dot: "bg-emerald-600 animate-pulse" },
  warn: { row: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-500" },
  danger: { row: "border-red-200 bg-red-50 text-red-800", dot: "bg-red-600" },
};

function num(value: number): ReactNode {
  return <span className="alterra-num">{value}</span>;
}

export default function SyncStatusBar() {
  const state = useSyncState();
  const pending = state.pendingCount + state.syncingCount + state.queuePendingCount;

  let tone: Tone;
  let label: ReactNode;
  let announce: string;

  if (state.isSyncing) {
    tone = "sync";
    label = "Synchronisation…";
    announce = "synchronisation en cours";
  } else if (!state.online) {
    tone = pending > 0 ? "danger" : "warn";
    label = pending > 0 ? <>Hors ligne · {num(pending)} en attente</> : "Hors ligne";
    announce = pending > 0 ? `hors ligne, ${pending} en attente` : "hors ligne";
  } else if (!state.autoSyncEnabled) {
    tone = "warn";
    label = "Sync auto suspendue";
    announce = "synchronisation automatique suspendue";
  } else if (pending > 0) {
    tone = "warn";
    label = <>{num(pending)} en attente</>;
    announce = `${pending} en attente`;
  } else {
    tone = "ok";
    label = "À jour";
    announce = "à jour";
  }

  const t = TONE[tone];

  return (
    <Link
      to="/sync"
      aria-label={`Synchronisation : ${announce}. Voir le détail.`}
      className={cn(
        "flex items-center justify-between gap-2 border-b px-4 py-2 text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-brand-ring)]",
        t.row,
      )}
    >
      <span className="inline-flex items-center gap-2 font-medium">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", t.dot)} aria-hidden="true" />
        {label}
      </span>
      <IconChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
    </Link>
  );
}
