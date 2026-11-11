import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, MessageSquareWarning, UserPlus, Receipt } from "lucide-react";
import { useNotificationFeed, type NotificationItem } from "../../hooks/useNotificationFeed";
import { formatDate } from "../../lib/referentials";
import { formatPointageAmount } from "../../lib/pointages";

const PAGE_SIZE = 10;
const SCROLL_THRESHOLD_PX = 48;

interface NotificationPopoverProps {
  open: boolean;
  onNavigate: () => void;
}

function itemIcon(type: NotificationItem["type"]) {
  switch (type) {
    case "activity":
      return Receipt;
    case "worker":
      return UserPlus;
    case "clarification":
      return MessageSquareWarning;
    case "pointage":
      return ClipboardList;
  }
}

function itemLabel(item: NotificationItem): { title: string; subtitle: string } {
  switch (item.type) {
    case "activity":
      return { title: item.row.proposedLabel, subtitle: "Demande d'activité" };
    case "worker":
      return {
        title: `${item.row.firstName} ${item.row.lastName}`,
        subtitle: "Demande MOC",
      };
    case "clarification":
      return { title: item.row.question, subtitle: "Demande de précision" };
    case "pointage": {
      const worker = item.row.worker;
      const workerName = worker ? `${worker.firstName} ${worker.lastName}` : "MOC inconnu";
      return {
        title: `${workerName} - ${formatPointageAmount(item.row.amount)}`,
        subtitle: `Pointage du ${formatDate(item.row.date)}`,
      };
    }
  }
}

export default function NotificationPopover({ open, onNavigate }: NotificationPopoverProps) {
  const navigate = useNavigate();
  const { isLoading, counts, items } = useNotificationFeed(open);
  const total = counts.activities + counts.workers + counts.clarifications + counts.pointages;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [open]);

  const visibleItems = items.slice(0, visibleCount);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD_PX;
    if (reachedBottom) {
      setVisibleCount((count) => Math.min(count + PAGE_SIZE, items.length));
    }
  }

  function goTo(item: NotificationItem) {
    onNavigate();
    if (item.type === "pointage") {
      navigate("/pointages", { state: { openPointage: item.row } });
      return;
    }
    navigate("/requests", {
      state: { openSelection: { type: item.type, row: item.row } },
    });
  }

  return (
    <div
      role="menu"
      className="absolute right-0 top-11 z-dropdown w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-overlay"
    >
      <div className="border-b border-zinc-100 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-900">
          {total > 0 ? `${total} élément(s) à traiter` : "Rien à traiter"}
        </p>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="max-h-96 overflow-y-auto">
        {isLoading && <p className="px-4 py-6 text-center text-sm text-muted">Chargement…</p>}
        {!isLoading && visibleItems.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">Aucun élément en attente.</p>
        )}
        {!isLoading &&
          visibleItems.map((item) => {
            const Icon = itemIcon(item.type);
            const { title, subtitle } = itemLabel(item);
            return (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                role="menuitem"
                onClick={() => goTo(item)}
                className="alterra-focus flex w-full items-start gap-3 border-b border-zinc-50 px-4 py-3 text-left last:border-0 hover:bg-zinc-50"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900">{title}</span>
                  <span className="block text-xs text-muted">{subtitle}</span>
                </span>
              </button>
            );
          })}
        {!isLoading && visibleCount < items.length && (
          <p className="px-4 py-2.5 text-center text-xs text-muted">Chargement…</p>
        )}
      </div>
    </div>
  );
}
