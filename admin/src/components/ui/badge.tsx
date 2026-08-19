import { cn } from "../../lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "brand";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Affiche une pastille de statut colorée devant le libellé. */
  dot?: boolean;
}

const styles: Record<BadgeVariant, { chip: string; dot: string }> = {
  default: { chip: "bg-zinc-100 text-zinc-700 ring-zinc-200", dot: "bg-zinc-400" },
  success: { chip: "bg-success-bg text-success ring-emerald-200", dot: "bg-emerald-600" },
  warning: { chip: "bg-warning-bg text-warning ring-amber-200", dot: "bg-amber-500" },
  danger: { chip: "bg-danger-bg text-danger ring-red-200", dot: "bg-red-600" },
  info: { chip: "bg-people-bg text-people-fg ring-blue-200", dot: "bg-people-fg" },
  brand: { chip: "bg-brand-tint text-brand ring-brand-ring/40", dot: "bg-brand" },
};

export function Badge({ className, variant = "default", dot = false, children, ...props }: BadgeProps) {
  const s = styles[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        s.chip,
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />}
      {children}
    </span>
  );
}
