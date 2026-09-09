import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "../../lib/utils";
import { navItemsBySection } from "../../lib/navigation";
import { useAuth } from "../../hooks/useAuth";
import { useAppSettings } from "../../hooks/useAppSettings";
import { Button } from "../ui/button";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const { appName, iconUrl } = useAppSettings();
  const sections = navItemsBySection(user?.role);
  const showSections = !collapsed && sections.size > 1;

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-zinc-200 transition-[width] duration-150",
        collapsed ? "w-14" : "w-[248px]",
      )}
      style={{
        background:
          "radial-gradient(circle at 12% 18%, rgba(24,144,96,0.16), transparent 50%)," +
          "radial-gradient(circle at 88% 12%, rgba(228,84,48,0.12), transparent 48%)," +
          "radial-gradient(circle at 80% 85%, rgba(47,97,153,0.14), transparent 52%)," +
          "radial-gradient(circle at 15% 88%, rgba(234,178,92,0.14), transparent 50%)," +
          "#fafafa",
      }}
    >
      <div
        className={cn(
          "flex h-12 items-center border-b border-zinc-200 px-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <span className="flex items-center gap-2">
            <img src={iconUrl} alt="" className="h-6 w-6 rounded" aria-hidden />
            <span className="text-sm font-semibold tracking-tight text-zinc-900">{appName}</span>
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-2">
        {[...sections.entries()].map(([section, items]) => (
          <div key={section}>
            {showSections && (
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                {section}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-1 focus-visible:ring-offset-white",
                        collapsed && "justify-center px-0",
                        isActive && "bg-brand-tint text-brand hover:bg-brand-tint hover:text-brand",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive ? "text-brand" : "text-subtle group-hover:text-zinc-700",
                          )}
                          aria-hidden
                        />
                        {!collapsed && <span>{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-zinc-200 px-3 py-2.5">
          <div className="h-0.5 w-8 rounded-full bg-earth" aria-hidden />
          <p className="mt-2 text-[11px] leading-tight text-subtle">
            Suivi terrain · Madagascar
          </p>
        </div>
      )}
    </aside>
  );
}
