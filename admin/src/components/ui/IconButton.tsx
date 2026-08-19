import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

type IconButtonVariant = "default" | "brand" | "destructive";

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  icon: LucideIcon;
  /** Nom accessible + infobulle native (obligatoire : bouton sans texte visible). */
  label: string;
  variant?: IconButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
}

const variants: Record<IconButtonVariant, string> = {
  default: "text-subtle hover:bg-zinc-100 hover:text-zinc-900",
  brand: "text-subtle hover:bg-brand-tint hover:text-brand",
  destructive: "text-subtle hover:bg-danger-bg hover:text-danger",
};

/** Action plate en icône seule — pour les listes et tableaux denses. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, variant = "default", size = "sm", loading = false, disabled, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-1 focus-visible:ring-offset-white",
        "disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Icon className="h-4 w-4" aria-hidden />
      )}
    </button>
  ),
);
IconButton.displayName = "IconButton";

/** Conteneur d'actions de ligne : aligne les IconButton à droite, sans déclencher le clic de ligne. */
export function RowActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-end gap-0.5", className)}>{children}</div>
  );
}
