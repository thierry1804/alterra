import { cn } from "../../lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-zinc-100 text-zinc-700",
        variant === "success" && "bg-emerald-50 text-emerald-800",
        variant === "warning" && "bg-amber-50 text-amber-900",
        variant === "danger" && "bg-red-50 text-red-800",
        className,
      )}
      {...props}
    />
  );
}
