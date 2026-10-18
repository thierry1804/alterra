import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useOpenClarificationsCount } from "../../hooks/useOpenClarificationsCount";
import { IconChevronRight, IconPrecisions } from "../icons";

export default function ClarificationBanner() {
  const count = useOpenClarificationsCount();
  if (count === 0) return null;

  return (
    <Link
      to="/clarifications"
      aria-label={`${count} demande(s) de précision — répondre`}
      className={cn(
        "flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-brand-ring)]",
      )}
    >
      <span className="inline-flex items-center gap-2 font-medium">
        <IconPrecisions className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {count} demande{count > 1 ? "s" : ""} de précision — à répondre
      </span>
      <IconChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
    </Link>
  );
}
