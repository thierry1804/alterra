import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { IconPlus } from "../icons";
import { isActivePath, type NavItem } from "./nav-config";

interface BottomNavProps {
  items: NavItem[];
  currentPath: string;
  moreActive: boolean;
  onOpenMore: () => void;
}

const itemBase =
  "flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-touch transition-colors active:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-brand-ring)]";

const inactiveClass = "text-zinc-500 hover:text-zinc-800";

export default function BottomNav({ items, currentPath, moreActive, onOpenMore }: BottomNavProps) {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-zinc-200 bg-white"
      style={{ paddingBottom: "var(--safe-area-bottom)", height: "calc(var(--bottom-nav-h) + var(--safe-area-bottom))" }}
    >
      {items.map(({ to, label, Icon }) => {
        const active = isActivePath(currentPath, to);
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? "page" : undefined}
            className={cn(itemBase, active ? "text-brand" : inactiveClass)}
          >
            <Icon className="h-6 w-6" />
            <span className={cn("text-[0.6875rem] leading-none", active && "font-semibold")}>
              {label}
            </span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOpenMore}
        aria-haspopup="dialog"
        aria-label="Plus d'options"
        className={cn(itemBase, moreActive ? "text-brand" : inactiveClass)}
      >
        <IconPlus className="h-6 w-6" />
        <span className={cn("text-[0.6875rem] leading-none", moreActive && "font-semibold")}>
          Plus
        </span>
      </button>
    </nav>
  );
}
