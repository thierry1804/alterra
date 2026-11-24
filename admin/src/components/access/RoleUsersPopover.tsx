import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import type { AccessRole } from "../../lib/access";
import type { AppUser, Site } from "../../lib/referentials";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

const PREVIEW_SIZE = 8;

interface RoleUsersPopoverProps {
  role: AccessRole;
}

/** Nombre d'utilisateurs du rôle, cliquable : aperçu (nom, site) et lien vers la page Utilisateurs filtrée. */
export default function RoleUsersPopover({ role }: RoleUsersPopoverProps) {
  const [open, setOpen] = useState(false);
  const usersQuery = useQuery({
    queryKey: ["access", "role-users", role.id],
    enabled: open && role.userCount > 0,
    queryFn: () =>
      api
        .get<{ data: AppUser[] }>("/users", { params: { roleId: role.id, take: PREVIEW_SIZE } })
        .then((r) => r.data.data),
  });
  const sitesQuery = useQuery({
    queryKey: ["sites"],
    enabled: open,
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
  });
  const siteName = (id: string | null) =>
    sitesQuery.data?.find((site) => site.id === id)?.name ?? "Tous les sites";

  if (role.userCount === 0) return <span className="px-2 text-sm text-subtle">0</span>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          aria-label={`${role.userCount} utilisateur${role.userCount > 1 ? "s" : ""} avec le rôle ${role.name}. Voir la liste`}
          className="alterra-focus min-h-8 min-w-8 rounded-md px-2 text-sm font-medium tabular-nums text-brand underline-offset-2 hover:bg-brand-tint hover:underline"
        >
          {role.userCount}
        </button>
      </PopoverTrigger>
      <PopoverContent onClick={(event) => event.stopPropagation()}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
          {role.name}
        </p>
        {usersQuery.isLoading && <p className="text-sm text-muted">Chargement…</p>}
        {usersQuery.isError && (
          <p className="text-sm text-danger">Liste indisponible (droit « utilisateurs » requis).</p>
        )}
        {usersQuery.data && (
          <ul className="space-y-1">
            {usersQuery.data.map((user) => (
              <li key={user.id} className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-zinc-900">
                  {user.firstName} {user.lastName}
                </span>
                <span className="shrink-0 text-xs text-muted">{siteName(user.siteId)}</span>
              </li>
            ))}
          </ul>
        )}
        {usersQuery.data && role.userCount > usersQuery.data.length && (
          <p className="mt-1 text-xs text-muted">
            et {role.userCount - usersQuery.data.length} autre
            {role.userCount - usersQuery.data.length > 1 ? "s" : ""}
          </p>
        )}
        <Link
          to={`/users?roleId=${role.id}`}
          className="alterra-focus mt-3 inline-block rounded-sm text-sm font-medium text-brand hover:underline"
        >
          Ouvrir dans Utilisateurs
        </Link>
      </PopoverContent>
    </Popover>
  );
}
