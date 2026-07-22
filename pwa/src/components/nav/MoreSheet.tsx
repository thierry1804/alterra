import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/cn";
import { IconChevronRight, IconClose, IconLogout } from "../icons";
import { isActivePath, type NavItem } from "./nav-config";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  currentPath: string;
  userName: string;
  roleLabel: string;
  onLogout: () => void;
}

export default function MoreSheet({
  open,
  onClose,
  items,
  currentPath,
  userName,
  roleLabel,
  onLogout,
}: MoreSheetProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus management, scroll lock, focus trap, and `inert` when closed.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!open) {
      container.setAttribute("inert", "");
      return;
    }
    container.removeAttribute("inert");

    const restoreTo = document.activeElement as HTMLElement | null;
    const focusables = () =>
      dialogRef.current
        ? Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
              'button, [href], [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute("disabled"))
        : [];

    focusables()[0]?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreTo?.focus();
    };
  }, [open]);

  function go(to: string) {
    onClose();
    navigate(to);
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-0 z-40 transition-opacity duration-200",
        open ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <button
        type="button"
        aria-label="Fermer le menu"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-zinc-900/40"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={cn(
          "absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-zinc-200 bg-white shadow-lg",
          "transition-transform duration-200 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
        style={{ paddingBottom: "var(--safe-area-bottom)" }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-300" aria-hidden="true" />

        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-zinc-900">{userName}</p>
            <p className="text-xs text-zinc-500">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="alterra-focus -mr-1 grid h-10 w-10 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 active:bg-zinc-200"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <nav className="border-t border-zinc-100 py-1">
          {items.map(({ to, label, Icon }) => {
            const active = isActivePath(currentPath, to);
            return (
              <button
                key={to}
                type="button"
                onClick={() => go(to)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "alterra-focus flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  active ? "text-brand" : "text-zinc-800 hover:bg-zinc-50 active:bg-zinc-100",
                )}
              >
                <Icon className={cn("h-6 w-6 shrink-0", active ? "text-brand" : "text-zinc-500")} />
                <span className="flex-1 text-sm font-medium">{label}</span>
                <IconChevronRight className="h-4 w-4 text-zinc-400" />
              </button>
            );
          })}
        </nav>

        <div className="border-t border-zinc-100 p-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="alterra-focus flex min-h-touch w-full items-center gap-3 rounded-lg px-2 py-3 text-left text-red-700 transition-colors hover:bg-red-50 active:bg-red-100"
          >
            <IconLogout className="h-6 w-6 shrink-0" />
            <span className="text-sm font-medium">Déconnexion</span>
          </button>
        </div>
      </div>
    </div>
  );
}
