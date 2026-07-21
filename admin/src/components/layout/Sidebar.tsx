import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "../../lib/utils";
import { navItemsForRole } from "../../lib/navigation";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/button";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const items = navItemsForRole(user?.role);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 transition-[width] duration-150",
        collapsed ? "w-14" : "w-[248px]",
      )}
    >
      <div
        className={cn(
          "flex h-12 items-center border-b border-zinc-200 px-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && <span className="text-sm font-semibold text-zinc-900">ALTERRA</span>}
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

      <nav className="flex-1 space-y-1 p-2">
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
                  "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-zinc-700 hover:bg-zinc-100",
                  collapsed && "justify-center px-0",
                  isActive && "bg-zinc-200 font-medium text-zinc-900",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
