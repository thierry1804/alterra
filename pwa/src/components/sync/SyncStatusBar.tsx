import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useSyncState } from "../../hooks/useSyncState";
import { IconWifiOff } from "../icons";

type Tone = "ok" | "sync" | "warn" | "danger";

const PILL: Record<Tone, { pill: string; dot: string }> = {
  ok: { pill: "bg-[color:var(--color-brand-tint)] text-brand", dot: "bg-emerald-600" },
  sync: {
    pill: "bg-[color:var(--color-brand-tint)] text-brand",
    dot: "bg-emerald-600 animate-pulse",
  },
  warn: { pill: "bg-amber-50 text-amber-900", dot: "bg-amber-500" },
  danger: { pill: "bg-red-50 text-red-800", dot: "bg-red-600" },
};

function useSyncSummary(): {
  tone: Tone;
  label: ReactNode;
  announce: string;
  offline: boolean;
  pending: number;
} {
  const state = useSyncState();
  const pending = state.pendingCount + state.syncingCount + state.queuePendingCount;
  const num = (value: number) => <span className="alterra-num">{value}</span>;

  if (state.isSyncing) {
    return {
      tone: "sync",
      label: "Synchro…",
      announce: "synchronisation en cours",
      offline: false,
      pending,
    };
  }
  if (!state.online) {
    return {
      tone: pending > 0 ? "danger" : "warn",
      label: pending > 0 ? <>{num(pending)} à envoyer</> : "Hors ligne",
      announce: pending > 0 ? `hors ligne, ${pending} en attente` : "hors ligne",
      offline: true,
      pending,
    };
  }
  if (!state.autoSyncEnabled) {
    return {
      tone: "warn",
      label: "Sync suspendue",
      announce: "synchronisation automatique suspendue",
      offline: false,
      pending,
    };
  }
  if (pending > 0) {
    return {
      tone: "warn",
      label: <>{num(pending)} à envoyer</>,
      announce: `${pending} en attente`,
      offline: false,
      pending,
    };
  }
  return { tone: "ok", label: "À jour", announce: "à jour", offline: false, pending };
}

/** Pastille d'état dans l'en-tête : un tap ouvre l'écran de synchronisation. */
export function SyncPill() {
  const { tone, label, announce } = useSyncSummary();
  const t = PILL[tone];
  return (
    <Link
      to="/sync"
      aria-label={`Synchronisation : ${announce}. Voir le détail.`}
      className={cn(
        "alterra-focus inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold",
        t.pill,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} aria-hidden="true" />
      {label}
    </Link>
  );
}

/** Bandeau pleine largeur, affiché seulement quand le réseau est perdu. */
export default function SyncStatusBar() {
  const { offline, pending } = useSyncSummary();
  if (!offline) return null;
  return (
    <Link
      to="/sync"
      className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900"
    >
      <IconWifiOff className="h-4 w-4 shrink-0" />
      <span>
        Hors ligne
        {pending > 0 && (
          <>
            {" · "}
            <span className="alterra-num">{pending}</span> pointage{pending > 1 ? "s" : ""} en
            attente
          </>
        )}
      </span>
    </Link>
  );
}
