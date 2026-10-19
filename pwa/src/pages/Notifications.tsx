import { useState } from "react";
import { Link } from "react-router-dom";
import { useNotificationList } from "../hooks/useNotifications";
import { notificationHref } from "../lib/notifications";
import { enableWebPush } from "../lib/push";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { LoadingScreen, EmptyHint } from "../components/ui/feedback";
import { cn } from "../lib/cn";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function Notifications() {
  const { items, loading, error, hasMore, loadMore, markRead, markAll } = useNotificationList();
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  async function handleEnablePush() {
    setPushBusy(true);
    setPushStatus(null);
    try {
      const result = await enableWebPush();
      if (result === "granted") setPushStatus("Alertes système activées.");
      else if (result === "denied") setPushStatus("Permission refusée par le navigateur.");
      else if (result === "unavailable") setPushStatus("Web Push non configuré sur le serveur.");
      else setPushStatus("Navigateur non compatible avec les alertes push.");
    } catch {
      setPushStatus("Échec de l'activation des alertes.");
    } finally {
      setPushBusy(false);
    }
  }

  const pushPromptVisible =
    typeof Notification !== "undefined" && Notification.permission !== "granted";

  if (loading && items.length === 0) return <LoadingScreen label="Chargement des notifications…" />;

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
      <PageHeader
        title="Notifications"
        subtitle="Mises à jour en temps réel."
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void markAll()}>
            Tout lire
          </Button>
        }
      />

      {pushPromptVisible && (
        <div className="flex items-center gap-3 rounded-2xl bg-brand-tint p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900">Recevoir les alertes</p>
            <p className="text-xs text-zinc-600">Même quand l&apos;application est fermée.</p>
            {pushStatus && <p className="mt-1 text-xs text-zinc-700">{pushStatus}</p>}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pushBusy}
            onClick={() => void handleEnablePush()}
          >
            Activer
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      {items.length === 0 ? (
        <EmptyHint>
          <p className="font-medium text-zinc-800">Aucune notification</p>
          <p className="mt-1">Les alertes métier apparaîtront ici.</p>
        </EmptyHint>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {items.map((n) => {
            const href = notificationHref(n);
            const unread = !n.readAt;
            return (
              <li key={n.id}>
                <Link
                  to={href}
                  onClick={() => {
                    if (unread) void markRead(n.id);
                  }}
                  className={cn(
                    "flex min-h-14 items-start gap-3 px-3 py-3 hover:bg-zinc-50",
                    unread && "bg-brand-tint/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      unread ? "bg-[color:var(--color-earth)]" : "bg-transparent",
                    )}
                    aria-label={unread ? "Non lue" : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm text-zinc-900", unread && "font-semibold")}>
                        {n.title}
                      </p>
                      <time className="shrink-0 text-[0.6875rem] text-zinc-500">
                        {formatWhen(n.createdAt)}
                      </time>
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-600">{n.body}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button type="button" variant="outline" onClick={() => void loadMore()}>
            Voir plus
          </Button>
        </div>
      )}
    </div>
  );
}
