import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "../../lib/utils";
import { navItemsBySection } from "../../lib/navigation";
import { useAuth } from "../../hooks/useAuth";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useNavCounts } from "../../hooks/useNavCounts";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const { appName, iconUrl } = useAppSettings();
  const counts = useNavCounts();
  const sections = navItemsBySection(user?.role);
  const showSections = !collapsed && sections.size > 1;

  return (
    <aside
      className={cn(
        "alterra-side flex h-full shrink-0 flex-col transition-[width] duration-150",
        collapsed ? "w-16" : "w-[232px]",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center px-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <span className="flex min-w-0 items-center gap-2.5">
            <img src={iconUrl} alt="" className="h-7 w-7 rounded bg-white/90 p-0.5" aria-hidden />
            <span className="alterra-display truncate text-sm font-extrabold uppercase tracking-[0.14em] text-white">
              {appName}
            </span>
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          className="alterra-focus grid h-8 w-8 place-items-center rounded-md text-[color:var(--side-ink)] hover:bg-white/10 hover:text-white focus-visible:ring-offset-0"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav
        aria-label="Navigation principale"
        className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-2 pb-2"
      >
        {[...sections.entries()].map(([section, items]) => (
          <div key={section}>
            {showSections && (
              <p className="px-2.5 pb-1 pt-4 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-[color:var(--side-muted)]">
                {section}
              </p>
            )}
            {!showSections && <div className="h-3" aria-hidden />}
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const count = item.badge ? counts[item.badge] : 0;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-[color:var(--side-ink)] transition-colors hover:bg-white/10 hover:text-white",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                        collapsed && "justify-center px-0",
                        isActive &&
                          "bg-[color:var(--side-on)] font-semibold text-white hover:bg-[color:var(--side-on)]",
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {count > 0 && (
                      <span
                        className={cn(
                          "alterra-num grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-[color:var(--color-earth)] px-1.5 text-[0.625rem] font-bold leading-none text-white",
                          collapsed && "absolute right-1 top-1",
                        )}
                        aria-label={`${count} en attente`}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-[color:var(--side-line)] px-4 py-3">
          <p className="text-[0.6875rem] leading-tight text-[color:var(--side-muted)]">
            Suivi terrain · Madagascar
          </p>
        </div>
      )}
    </aside>
  );
}
