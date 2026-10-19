import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CornerDownLeft, Download, Search, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { navItemsForRole } from "../../lib/navigation";
import { useAuth } from "../../hooks/useAuth";

interface PaletteEntry {
  id: string;
  group: "Pages" | "Actions";
  label: string;
  hint: string;
  icon: LucideIcon;
  to: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Palette de commandes (Ctrl+K) : aller à une page ou lancer une action fréquente, au clavier. */
export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const entries = useMemo<PaletteEntry[]>(() => {
    const pages: PaletteEntry[] = navItemsForRole(user?.role).map((item) => ({
      id: `page:${item.path}`,
      group: "Pages",
      label: item.label,
      hint: item.section ?? "",
      icon: item.icon,
      to: item.path,
    }));
    const actions: PaletteEntry[] =
      user?.role === "ADMIN"
        ? [
            {
              id: "action:bordereau",
              group: "Actions",
              label: "Générer le bordereau MVola",
              hint: "Paiements",
              icon: Download,
              to: "/payments",
            },
            {
              id: "action:import-mvola",
              group: "Actions",
              label: "Importer le retour MVola",
              hint: "Paiements",
              icon: Upload,
              to: "/payments",
            },
            {
              id: "action:import-workers",
              group: "Actions",
              label: "Importer des travailleurs (Excel)",
              hint: "Travailleurs",
              icon: Upload,
              to: "/workers",
            },
          ]
        : [];
    return [...pages, ...actions];
  }, [user?.role]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => `${entry.label} ${entry.hint}`.toLowerCase().includes(needle));
  }, [entries, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function go(entry: PaletteEntry) {
    onOpenChange(false);
    navigate(entry.to);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      go(results[active]);
    }
  }

  const groups = (["Pages", "Actions"] as const).filter((group) =>
    results.some((entry) => entry.group === group),
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-modal-backdrop bg-zinc-950/50 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14vh] z-modal w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-overlay"
        >
          <DialogPrimitive.Title className="sr-only">Recherche rapide</DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3">
            <Search className="h-4 w-4 text-muted" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Aller à une page ou lancer une action"
              aria-label="Recherche rapide"
              role="combobox"
              aria-expanded
              aria-controls="palette-results"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
            />
            <kbd className="rounded border border-zinc-200 px-1.5 text-[0.6875rem] text-muted">
              Échap
            </kbd>
          </div>
          <div id="palette-results" role="listbox" className="max-h-[22rem] overflow-y-auto p-2">
            {results.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted">Aucun résultat.</p>
            )}
            {groups.map((group) => (
              <div key={group} className="pb-1">
                <p className="px-3 pb-1 pt-2 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-muted">
                  {group}
                </p>
                {results
                  .filter((entry) => entry.group === group)
                  .map((entry) => {
                    const index = results.indexOf(entry);
                    const Icon = entry.icon;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="option"
                        aria-selected={index === active}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(entry)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                          index === active ? "bg-brand-tint text-zinc-900" : "text-zinc-700",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                        <span className="flex-1 truncate font-medium">{entry.label}</span>
                        <span className="text-xs text-muted">{entry.hint}</span>
                        {index === active && (
                          <CornerDownLeft className="h-3.5 w-3.5 text-muted" aria-hidden />
                        )}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
