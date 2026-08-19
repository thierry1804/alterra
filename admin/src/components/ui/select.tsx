import * as React from "react";
import { cn } from "../../lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/** Select natif stylé, cohérent avec Input (même hauteur, même focus de marque). */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-xs transition-colors",
        "hover:border-zinc-400",
        "focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-1 focus-visible:ring-offset-white",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
