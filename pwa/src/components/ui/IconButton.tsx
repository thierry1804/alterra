import type { ButtonHTMLAttributes, SVGProps, ComponentType } from "react";
import { cn } from "../../lib/cn";

type IconButtonVariant = "default" | "brand" | "destructive";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Nom accessible + infobulle (obligatoire : bouton sans texte visible). */
  label: string;
  variant?: IconButtonVariant;
}

const variants: Record<IconButtonVariant, string> = {
  default: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  brand: "text-zinc-600 hover:bg-brand-tint hover:text-brand",
  destructive: "text-zinc-600 hover:bg-red-50 hover:text-red-700",
};

/**
 * Action utilitaire en icône seule — cible tactile terrain 44px (min-h-touch).
 * Réservé aux actions évidentes (fermer, actualiser) ; les gestes à enjeu
 * gardent un libellé.
 */
export default function IconButton({
  icon: Icon,
  label,
  variant = "default",
  type = "button",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
