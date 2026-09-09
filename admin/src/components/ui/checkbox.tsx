import * as React from "react";
import { cn } from "../../lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "checked"> {
  checked: boolean | "indeterminate";
}

/** Case à cocher native stylée — supporte l'état "indeterminate" (sélection partielle). */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, className, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(forwardedRef, () => innerRef.current!, []);

    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = checked === "indeterminate";
    }, [checked]);

    return (
      <input
        ref={innerRef}
        type="checkbox"
        checked={checked === "indeterminate" ? false : checked}
        className={cn(
          "h-4 w-4 shrink-0 rounded border-zinc-300 text-brand focus-visible:ring-2 focus-visible:ring-brand-ring",
          className,
        )}
        {...props}
      />
    );
  },
);
Checkbox.displayName = "Checkbox";
