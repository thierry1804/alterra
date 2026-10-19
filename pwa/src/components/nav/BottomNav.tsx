import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { isActivePath, type NavItem } from "./nav-config";

interface BottomNavProps {
  items: NavItem[];
  currentPath: string;
  /** Pastille de compteur par destination (ex. messages non lus). */
  badges?: Record<string, number>;
}

const itemBase =
  "flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-touch transition-colors active:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-brand-ring)]";

const inactiveClass = "text-zinc-500 hover:text-zinc-800";

export default function BottomNav({ items, currentPath, badges = {} }: BottomNavProps) {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-zinc-200 bg-white"
      style={{
        paddingBottom: "var(--safe-area-bottom)",
        height: "calc(var(--bottom-nav-h) + var(--safe-area-bottom))",
      }}
    >
      {items.map(({ to, label, Icon, alsoActiveOn }) => {
        const active = isActivePath(currentPath, to, alsoActiveOn);
        const badge = badges[to] ?? 0;
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? "page" : undefined}
            className={cn(itemBase, "relative", active ? "text-brand" : inactiveClass)}
          >
            {active && (
              <span
                className="absolute top-0 h-[3px] w-7 rounded-b bg-[color:var(--color-earth)]"
                aria-hidden="true"
              />
            )}
            <span className="relative">
              <Icon className="h-6 w-6" />
              {badge > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--color-earth)] px-1 text-[0.625rem] font-bold leading-none text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>
            <span className={cn("text-[0.6875rem] leading-none", active && "font-semibold")}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
