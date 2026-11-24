import { useMemo } from "react";
import type { AccessRole, PermissionResource } from "../../lib/access";
import { summarizeAccess } from "../../lib/access-roles";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

const VISIBLE_PILLS = 3;

interface AccessSummaryProps {
  role: AccessRole;
  resources: PermissionResource[];
}

/** Pastilles par domaine d'accès (Pointages, Badges…) avec le détail des droits dans un popover. */
export default function AccessSummary({ role, resources }: AccessSummaryProps) {
  const domains = useMemo(
    () => summarizeAccess(role.permissions, resources),
    [role.permissions, resources],
  );

  if (domains.length === 0) {
    return <span className="text-sm text-subtle">Aucun accès</span>;
  }

  const shown = domains.slice(0, VISIBLE_PILLS);
  const rest = domains.length - shown.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Accès de ${role.name} : ${domains.length} domaine${domains.length > 1 ? "s" : ""}. Voir le détail`}
          className="alterra-focus flex min-h-8 flex-wrap items-center gap-1 rounded-md px-1 text-left hover:bg-zinc-100"
        >
          {shown.map((domain) => (
            <span
              key={domain.resource}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200"
            >
              {domain.label}
            </span>
          ))}
          {rest > 0 && <span className="text-xs font-medium text-subtle">+{rest}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-80 w-80 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
          {role.name} : {role.permissions.length} droits
        </p>
        <ul className="space-y-2">
          {domains.map((domain) => (
            <li key={domain.resource}>
              <p className="text-sm font-medium text-zinc-900">{domain.label}</p>
              <p className="text-xs text-muted">{domain.actions.join(" · ")}</p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
