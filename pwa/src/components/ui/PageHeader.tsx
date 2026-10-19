import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  /** Une ligne maximum : contexte utile, pas une explication du mode d'emploi. */
  subtitle?: ReactNode;
  /** Bouton « ? » (ContextHelp) affiché à côté du titre. */
  help?: ReactNode;
  /** Action principale de l'en-tête (ex. actualiser). */
  action?: ReactNode;
}

export default function PageHeader({ title, subtitle, help, action }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="alterra-display text-2xl font-extrabold leading-tight text-zinc-900">
            {title}
          </h1>
          {help}
        </div>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-600">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
