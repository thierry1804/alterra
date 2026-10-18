import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_UPDATED_EVENT,
  type AppNotification,
} from "../lib/notifications";
import { connectSocket, disconnectSocket, isSocketConnected } from "../lib/socket";

const POLL_INTERVAL_MS = 60_000;

export function useUnreadNotificationCount(): number {
  const { user, isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setCount(0);
      return;
    }
    try {
      setCount(await fetchUnreadCount());
    } catch {
      // prochain poll
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      setCount(0);
      return;
    }
    connectSocket();
    void refresh();

    const interval = setInterval(() => {
      if (!isSocketConnected()) void refresh();
    }, POLL_INTERVAL_MS);

    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    };
  }, [isAuthenticated, refresh]);

  return count;
}

export function useNotificationList() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async (cursor?: string) => {
      if (!isAuthenticated) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const page = await fetchNotifications(cursor);
        setItems((prev) => (cursor ? [...prev, ...page.data] : page.data));
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } catch {
        setError("Impossible de charger les notifications.");
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated],
  );

  useEffect(() => {
    void load();
    const onUpdate = () => void load();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
    };
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    const updated = await markNotificationRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? updated : n)));
  }, []);

  const markAll = useCallback(async () => {
    await markAllNotificationsRead();
    setItems((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
  }, []);

  return {
    items,
    loading,
    error,
    hasMore,
    nextCursor,
    loadMore: () => (nextCursor ? load(nextCursor) : undefined),
    refresh: () => load(),
    markRead,
    markAll,
  };
}
