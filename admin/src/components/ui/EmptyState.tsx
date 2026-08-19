import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "../../lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}

/** État vide qui oriente l'utilisateur (prochaine action), pas un simple « aucune donnée ». */
export function EmptyState({ icon: Icon = Inbox, title, hint, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-brand">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-900">{title}</p>
        {hint && <p className="mx-auto max-w-sm text-sm text-muted">{hint}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
