import { useState } from "react";
import { Link } from "react-router-dom";
import { useNotificationList } from "../hooks/useNotifications";
import { notificationHref } from "../lib/notifications";
import { enableWebPush } from "../lib/push";
import Button from "../components/ui/Button";
import { LoadingScreen, EmptyHint } from "../components/ui/feedback";
import { cn } from "../lib/cn";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function Notifications() {
  const { items, loading, error, hasMore, loadMore, markRead, markAll, refresh } =
    useNotificationList();
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

  if (loading && items.length === 0) return <LoadingScreen label="Chargement des notifications…" />;

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Notifications</h1>
          <p className="mt-0.5 text-sm text-zinc-600">Mises à jour en temps réel.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
            Actualiser
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void markAll()}>
            Tout lu
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3">
        <p className="text-sm text-zinc-700">
          Recevoir les alertes même lorsque l&apos;application est en arrière-plan.
        </p>
        <Button
          type="button"
          className="mt-2"
          size="sm"
          disabled={pushBusy}
          onClick={() => void handleEnablePush()}
        >
          Activer les alertes
        </Button>
        {pushStatus && <p className="mt-2 text-xs text-zinc-600">{pushStatus}</p>}
      </div>

      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

      {items.length === 0 ? (
        <EmptyHint>
          <p className="font-medium text-zinc-800">Aucune notification</p>
          <p className="mt-1">Les alertes métier apparaîtront ici.</p>
        </EmptyHint>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
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
                    "block px-3 py-3 hover:bg-zinc-50",
                    unread && "bg-brand/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm text-zinc-900", unread && "font-semibold")}>
                      {n.title}
                    </p>
                    <time className="shrink-0 text-[0.6875rem] text-zinc-500">
                      {formatWhen(n.createdAt)}
                    </time>
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-600">{n.body}</p>
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
