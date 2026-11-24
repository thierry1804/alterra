import { Copy, Lock, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { AccessRole, PermissionGroup, PermissionResource } from "../../lib/access";
import {
  EMPTY_GROUP_FILTERS,
  filterGroups,
  groupDeleteBlock,
  groupDomains,
  hasActiveGroupFilters,
  type GroupFilters,
} from "../../lib/access-groups";
import { groupDomain, groupShortName } from "../../lib/access-matrix";
import { summarizeAccess } from "../../lib/access-roles";
import { cn } from "../../lib/utils";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/button";
import { SortableHead } from "../ui/data-table/SortableHead";
import { useClientSort } from "../ui/data-table/useClientSort";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Select } from "../ui/select";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "../ui/table";
import { Hint, TooltipProvider } from "../ui/tooltip";

interface GroupsTableProps {
  groups: PermissionGroup[];
  roles: AccessRole[];
  resources: PermissionResource[];
  onOpen: (group: PermissionGroup) => void;
  onDuplicate: (group: PermissionGroup) => void;
  onDelete: (group: PermissionGroup) => void;
}

const PILLS = 3;

function PermissionSummary({
  group,
  resources,
}: {
  group: PermissionGroup;
  resources: PermissionResource[];
}) {
  const domains = useMemo(
    () => summarizeAccess(group.permissions, resources),
    [group.permissions, resources],
  );
  if (domains.length === 0) return <span className="text-sm text-subtle">Aucune permission</span>;
  const shown = domains.slice(0, PILLS);
  const rest = domains.length - shown.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Permissions de ${group.name} : ${group.permissions.length}. Voir le détail`}
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
          <span className="text-xs text-muted">· {group.permissions.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-80 w-80 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
          {group.name}
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

function UsedBy({ group, roles }: { group: PermissionGroup; roles: AccessRole[] }) {
  const using = roles.filter((role) => role.groupIds.includes(group.id));
  if (using.length === 0) return <span className="px-2 text-sm text-subtle">0</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          aria-label={`${using.length} rôle${using.length > 1 ? "s" : ""} utilisent ${group.name}. Voir la liste`}
          className="alterra-focus min-h-8 min-w-8 rounded-md px-2 text-sm font-medium tabular-nums text-brand underline-offset-2 hover:bg-brand-tint hover:underline"
        >
          {using.length}
        </button>
      </PopoverTrigger>
      <PopoverContent onClick={(event) => event.stopPropagation()}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
          Rôles qui utilisent ce groupe
        </p>
        <ul className="space-y-1">
          {using.map((role) => (
            <li key={role.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-zinc-900">{role.name}</span>
              <span className="shrink-0 text-xs text-muted">
                {role.userCount} utilisateur{role.userCount > 1 ? "s" : ""}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

const SORT_ACCESSORS = {
  name: (group: PermissionGroup) => group.name,
  permissions: (group: PermissionGroup) => group.permissions.length,
  roles: (group: PermissionGroup) => group.roleCount,
};

export default function GroupsTable({
  groups,
  roles,
  resources,
  onOpen,
  onDuplicate,
  onDelete,
}: GroupsTableProps) {
  const [filters, setFilters] = useState<GroupFilters>(EMPTY_GROUP_FILTERS);
  const domains = useMemo(() => groupDomains(groups, resources), [groups, resources]);
  const filtered = useMemo(
    () => filterGroups(groups, resources, filters),
    [groups, resources, filters],
  );
  const { sorted, sortKey, sortDir, toggleSort } = useClientSort(filtered, "name", SORT_ACCESSORS);
  const set = <K extends keyof GroupFilters>(key: K, value: GroupFilters[K]) =>
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
              aria-label="Rechercher un groupe"
              placeholder="Rechercher un groupe…"
              value={filters.q}
              onChange={(event) => set("q", event.target.value)}
              className="w-64 pl-8"
            />
          </div>
          <Select
            aria-label="Filtrer par domaine"
            value={filters.domain}
            onChange={(event) => set("domain", event.target.value)}
          >
            <option value="">Tous les domaines</option>
            {domains.map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrer par type"
            value={filters.kind}
            onChange={(event) => set("kind", event.target.value as GroupFilters["kind"])}
          >
            <option value="">Système et personnalisés</option>
            <option value="systeme">Système</option>
            <option value="personnalise">Personnalisés</option>
          </Select>
          <Select
            aria-label="Filtrer par usage"
            value={filters.usage}
            onChange={(event) => set("usage", event.target.value as GroupFilters["usage"])}
          >
            <option value="">Tous les groupes</option>
            <option value="utilises">Utilisés</option>
            <option value="inutilises">Sans rôle</option>
          </Select>
          {hasActiveGroupFilters(filters) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilters(EMPTY_GROUP_FILTERS)}
            >
              Réinitialiser
            </Button>
          )}
          <p className="ml-auto text-sm text-muted" aria-live="polite">
            {sorted.length} groupe{sorted.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead
                  sortKey="name"
                  label="Groupe"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableHead
                  sortKey="permissions"
                  label="Permissions"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={toggleSort}
                  hint="Domaines couverts par le groupe. Cliquez pour voir le détail des droits."
                />
                <SortableHead
                  sortKey="roles"
                  label="Rôles"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={toggleSort}
                  hint="Nombre de rôles qui utilisent ce groupe : modifier le groupe change leurs droits à tous."
                />
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((group) => {
                const blocked = groupDeleteBlock(group, roles);
                const domain = groupDomain(group, resources);
                const unused = group.roleCount === 0;
                return (
                  <TableRow
                    key={group.id}
                    tabIndex={0}
                    aria-label={`Ouvrir le groupe ${group.name}`}
                    onClick={() => onOpen(group)}
                    onKeyDown={(event) => {
                      if (event.target === event.currentTarget && event.key === "Enter")
                        onOpen(group);
                    }}
                    className="group/row cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring"
                  >
                    <TableCell className={cn("min-w-64", unused && "opacity-70")}>
                      <div className="flex items-center gap-1.5">
                        {group.isSystem && (
                          <Hint label="Groupe système : il ne peut pas être supprimé." side="top">
                            <span
                              tabIndex={0}
                              className="alterra-focus rounded-sm text-subtle"
                              aria-label="Groupe système"
                            >
                              <Lock className="h-3.5 w-3.5" aria-hidden />
                            </span>
                          </Hint>
                        )}
                        <span className="font-medium text-zinc-900">{groupShortName(group)}</span>
                        <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-medium text-brand">
                          {domain}
                        </span>
                      </div>
                      {group.description && (
                        <p className="mt-0.5 text-xs text-muted">{group.description}</p>
                      )}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <PermissionSummary group={group} resources={resources} />
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <UsedBy group={group} roles={roles} />
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions du groupe ${group.name}`}
                            className="alterra-focus inline-flex h-8 w-8 items-center justify-center rounded-md text-subtle opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-900 focus-visible:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => onOpen(group)}>
                            <Pencil className="h-3.5 w-3.5" aria-hidden /> Ouvrir le détail
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onDuplicate(group)}>
                            <Copy className="h-3.5 w-3.5" aria-hidden /> Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            destructive
                            disabled={blocked !== null}
                            onSelect={() => onDelete(group)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            <span className="flex flex-col">
                              Supprimer
                              {blocked && (
                                <span className="text-[11px] font-normal text-subtle">
                                  {blocked}
                                </span>
                              )}
                            </span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {sorted.length === 0 && (
            <EmptyState
              title="Aucun groupe ne correspond"
              hint="Modifiez la recherche ou réinitialisez les filtres."
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
