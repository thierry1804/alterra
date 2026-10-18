import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useUnreadNotificationCount } from "../../hooks/useNotifications";

export default function NotificationBell() {
  const unread = useUnreadNotificationCount();

  return (
    <Link
      to="/notifications"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      aria-label={
        unread > 0
          ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}`
          : "Notifications"
      }
    >
      <Bell className="h-5 w-5" strokeWidth={1.75} />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded bg-brand px-1 text-[0.625rem] font-semibold leading-none text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
