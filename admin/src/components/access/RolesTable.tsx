import { useMemo, useState } from "react";
import { Lock, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  SCOPE_LABELS,
  type AccessRole,
  type AccessScope,
  type PermissionResource,
} from "../../lib/access";
import {
  EMPTY_ROLE_FILTERS,
  filterRoles,
  hasActiveFilters,
  type RoleFilters,
  type RolePatch,
} from "../../lib/access-roles";
import { cn } from "../../lib/utils";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/button";
import { useClientSort } from "../ui/data-table/useClientSort";
import { SortableHead } from "../ui/data-table/SortableHead";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Switch } from "../ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Hint, TooltipProvider } from "../ui/tooltip";
import AccessSummary from "./AccessSummary";
import InlineText from "./InlineText";
import RoleRowMenu from "./RoleRowMenu";
import RoleUsersPopover from "./RoleUsersPopover";

const SORT_ACCESSORS = {
  name: (role: AccessRole) => role.name,
  scope: (role: AccessRole) => SCOPE_LABELS[role.scope],
  mfa: (role: AccessRole) => (role.mfaRequired ? 1 : 0),
  access: (role: AccessRole) => role.permissions.length,
  users: (role: AccessRole) => role.userCount,
};

interface RolesTableProps {
  roles: AccessRole[];
  resources: PermissionResource[];
  onOpenDetail: (role: AccessRole) => void;
  onPatch: (role: AccessRole, patch: RolePatch) => void;
  onDuplicate: (role: AccessRole) => void;
  onDelete: (role: AccessRole) => void;
}

export default function RolesTable({
  roles,
  resources,
  onOpenDetail,
  onPatch,
  onDuplicate,
  onDelete,
}: RolesTableProps) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<RoleFilters>(EMPTY_ROLE_FILTERS);
  const filtered = useMemo(() => filterRoles(roles, filters), [roles, filters]);
  const { sorted, sortKey, sortDir, toggleSort } = useClientSort(filtered, "name", SORT_ACCESSORS);

  const set = <K extends keyof RoleFilters>(key: K, value: RoleFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-subtle"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Rechercher un rôle"
              placeholder="Rechercher un rôle…"
              value={filters.q}
              onChange={(event) => set("q", event.target.value)}
              className="w-64 pl-8"
            />
          </div>
          <Select
            aria-label="Filtrer par portée"
            value={filters.scope}
            onChange={(event) => set("scope", event.target.value as AccessScope | "")}
          >
            <option value="">Toutes les portées</option>
            {(Object.keys(SCOPE_LABELS) as AccessScope[]).map((scope) => (
              <option key={scope} value={scope}>
                {SCOPE_LABELS[scope]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrer par MFA"
            value={filters.mfa}
            onChange={(event) => set("mfa", event.target.value as RoleFilters["mfa"])}
          >
            <option value="">MFA : tous</option>
            <option value="avec">Avec MFA</option>
            <option value="sans">Sans MFA</option>
          </Select>
          <Select
            aria-label="Filtrer par usage"
            value={filters.usage}
            onChange={(event) => set("usage", event.target.value as RoleFilters["usage"])}
          >
            <option value="">Tous les rôles</option>
            <option value="utilises">Utilisés</option>
            <option value="inutilises">Sans utilisateur</option>
          </Select>
          {hasActiveFilters(filters) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilters(EMPTY_ROLE_FILTERS)}
            >
              Réinitialiser
            </Button>
          )}
          <p className="ml-auto text-sm text-muted" aria-live="polite">
            {sorted.length} rôle{sorted.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead
                  sortKey="name"
                  label="Rôle"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableHead
                  sortKey="scope"
                  hint="Étendue des données visibles : tous les sites, le site de l'utilisateur ou son équipe."
                  label="Portée"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableHead
                  sortKey="mfa"
                  label="MFA"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableHead
                  sortKey="access"
                  hint="Domaines couverts par les groupes de permissions du rôle. Cliquez pour le détail."
                  label="Accès"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableHead
                  sortKey="users"
                  label="Utilisateurs"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={toggleSort}
                />
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((role) => {
                const unused = role.userCount === 0;
                return (
                  <TableRow
                    key={role.id}
                    tabIndex={0}
                    aria-label={`Ouvrir le détail du rôle ${role.name}`}
                    onClick={() => onOpenDetail(role)}
                    onKeyDown={(event) => {
                      if (event.target === event.currentTarget && event.key === "Enter")
                        onOpenDetail(role);
                    }}
                    className="group/row cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring"
                  >
                    <TableCell className={cn("min-w-64", unused && "opacity-70")}>
                      <div className="flex items-center gap-1.5">
                        {role.isSystem && (
                          <Hint label="Rôle système : il ne peut pas être supprimé." side="top">
                            <span
                              tabIndex={0}
                              className="alterra-focus rounded-sm text-subtle"
                              aria-label="Rôle système"
                            >
                              <Lock className="h-3.5 w-3.5" aria-hidden />
                            </span>
                          </Hint>
                        )}
                        <InlineText
                          value={role.name}
                          label={`Nom du rôle ${role.name}`}
                          minLength={2}
                          maxLength={60}
                          onCommit={(name) => onPatch(role, { name })}
                          displayClassName="font-medium"
                        />
                      </div>
                      <InlineText
                        value={role.description ?? ""}
                        label={`Description du rôle ${role.name}`}
                        placeholder="Ajouter une description"
                        allowEmpty
                        maxLength={200}
                        onCommit={(description) =>
                          onPatch(role, { description: description || null })
                        }
                        displayClassName="text-xs text-muted"
                      />
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Select
                        aria-label={`Portée du rôle ${role.name}`}
                        value={role.scope}
                        onChange={(event) =>
                          onPatch(role, { scope: event.target.value as AccessScope })
                        }
                        className="min-h-8"
                      >
                        {(Object.keys(SCOPE_LABELS) as AccessScope[]).map((scope) => (
                          <option key={scope} value={scope}>
                            {SCOPE_LABELS[scope]}
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <span className="inline-flex min-h-8 items-center">
                        <Switch
                          checked={role.mfaRequired}
                          onCheckedChange={(mfaRequired) => onPatch(role, { mfaRequired })}
                          aria-label={`Double authentification exigée pour le rôle ${role.name}`}
                        />
                      </span>
                    </TableCell>
                    <TableCell className={cn(unused && "opacity-70")}>
                      <AccessSummary role={role} resources={resources} />
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <RoleUsersPopover role={role} />
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <RoleRowMenu
                        role={role}
                        onOpenDetail={() => onOpenDetail(role)}
                        onDuplicate={() => onDuplicate(role)}
                        onShowUsers={() => navigate(`/users?roleId=${role.id}`)}
                        onDelete={() => onDelete(role)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {sorted.length === 0 && (
            <EmptyState
              title="Aucun rôle ne correspond"
              hint="Modifiez la recherche ou réinitialisez les filtres."
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
