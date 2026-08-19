import { Button } from "../ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="alterra-rule inline-block pb-1.5 text-xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
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
