import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useRejectedCount } from "../../hooks/useRejectedCount";
import { IconChevronRight, IconRejected } from "../icons";

export default function RejectedBanner() {
  const count = useRejectedCount();
  if (count === 0) return null;

  return (
    <Link
      to="/rejected"
      aria-label={`${count} pointage(s) rejeté(s) — voir et corriger`}
      className={cn(
        "flex items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-brand-ring)]",
      )}
    >
      <span className="inline-flex items-center gap-2 font-medium">
        <IconRejected className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {count} pointage{count > 1 ? "s" : ""} rejeté{count > 1 ? "s" : ""} — à corriger
      </span>
      <IconChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
    </Link>
  );
}
