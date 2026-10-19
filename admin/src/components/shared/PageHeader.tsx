import { Button } from "../ui/button";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Bouton « ? » (ContextHelp) affiché à côté du titre. */
  help?: React.ReactNode;
}

export default function PageHeader({ title, description, action, help }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="alterra-display text-2xl font-extrabold leading-tight text-zinc-900">
            {title}
          </h1>
          {help}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function LoadMoreButton({
  hasMore,
  loading,
  onClick,
}: {
  hasMore: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center pt-4">
      <Button type="button" variant="outline" onClick={onClick} disabled={loading}>
        {loading ? "Chargement…" : "Charger plus"}
      </Button>
    </div>
  );
}
