import { ChevronDown, ChevronRight, Lock, Search } from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  ADMIN_ROLE_ID,
  SCOPE_LABELS,
  type AccessRole,
  type PermissionGroup,
  type PermissionResource,
} from "../../lib/access";
import { buildSections, groupShortName, permissionLabelList } from "../../lib/access-matrix";
import SensitiveMfaWarning from "./SensitiveMfaWarning";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Hint, TooltipProvider } from "../ui/tooltip";
import { cn } from "../../lib/utils";

const HIGHLIGHT = "bg-brand-tint/50";
const ADMIN_LOCK_HINT =
  "Le rôle Administrateur est verrouillé : ses droits ne peuvent pas être modifiés pour éviter de perdre l'accès à l'administration.";

interface MatrixCellProps {
  roleIndex: number;
  roleId: string;
  groupId: string;
  checked: boolean;
  locked: boolean;
  /** Case modifiée et non enregistrée. */
  changed: boolean;
  label: string;
  onToggle: (roleId: string, groupId: string, checked: boolean) => void;
}

const MatrixCell = memo(function MatrixCell({
  roleIndex,
  roleId,
  groupId,
  checked,
  locked,
  changed,
  label,
  onToggle,
}: MatrixCellProps) {
  return (
    <td
      data-col={roleIndex}
      className={cn("border-b border-zinc-100 p-0 text-center", changed && "bg-warning-bg")}
    >
      <label
        title={locked ? ADMIN_LOCK_HINT : undefined}
        className={cn(
          "flex h-9 w-full min-w-28 items-center justify-center",
          locked ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <Checkbox
          checked={checked}
          disabled={locked}
          aria-label={label}
          onChange={(event) => onToggle(roleId, groupId, event.target.checked)}
          className={cn("h-4 w-4", locked && "opacity-50")}
        />
      </label>
    </td>
  );
});

/** Identité d'une colonne : ne change que si un rôle est ajouté, retiré ou renommé. */
interface ColumnMeta {
  id: string;
  name: string;
}

interface MatrixRowProps {
  group: PermissionGroup;
  roles: ColumnMeta[];
  /** « 1011… » : appartenance du groupe à chaque rôle, pour ne re-rendre que les lignes modifiées. */
  bits: string;
  /** « 0100… » : cases modifiées par rapport à l'état enregistré. */
  changedBits: string;
  permissionLabels: string[];
  onToggle: (roleId: string, groupId: string, checked: boolean) => void;
}

const MatrixRow = memo(
  function MatrixRow({
    group,
    roles,
    bits,
    changedBits,
    permissionLabels,
    onToggle,
  }: MatrixRowProps) {
    return (
      <tr className="group/line hover:bg-zinc-50">
        <th
          scope="row"
          className="sticky left-0 z-10 border-b border-zinc-100 bg-white px-3 py-1 text-left text-sm font-normal group-hover/line:bg-zinc-50"
        >
          <Hint
            side="right"
            label={
              <span className="block max-w-xs">
                <span className="block font-semibold">{group.name}</span>
                {group.description && <span className="block opacity-80">{group.description}</span>}
                <span className="mt-1 block opacity-90">{permissionLabels.join(" · ")}</span>
              </span>
            }
          >
            <button type="button" className="alterra-focus rounded-sm text-left">
              {groupShortName(group)}
            </button>
          </Hint>
        </th>
        {roles.map((role, index) => (
          <MatrixCell
            key={role.id}
            roleIndex={index}
            roleId={role.id}
            groupId={group.id}
            checked={bits[index] === "1"}
            locked={role.id === ADMIN_ROLE_ID}
            changed={changedBits[index] === "1"}
            label={`${role.name} : ${group.name}`}
            onToggle={onToggle}
          />
        ))}
      </tr>
    );
  },
  (a, b) =>
    a.group === b.group &&
    a.roles === b.roles &&
    a.bits === b.bits &&
    a.changedBits === b.changedBits &&
    a.onToggle === b.onToggle &&
    a.permissionLabels === b.permissionLabels,
);

interface RolesMatrixProps {
  roles: AccessRole[];
  /** Rôles tels qu'enregistrés, pour repérer les cases modifiées dans le brouillon. */
  baseline?: AccessRole[];
  groups: PermissionGroup[];
  resources: PermissionResource[];
  onToggle: (role: AccessRole, group: PermissionGroup, checked: boolean) => void;
}

/** Matrice rôles × groupes de permissions : une case = un groupe accordé à un rôle. */
export default function RolesMatrix({
  roles,
  baseline,
  groups,
  resources,
  onToggle,
}: RolesMatrixProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const tableRef = useRef<HTMLTableElement>(null);
  const hovered = useRef<string | null>(null);

  // Administrateur en premier, puis l'ordre du serveur : les colonnes ne bougent pas pendant l'édition.
  const columns = useMemo(
    () =>
      [...roles].sort((a, b) => Number(b.id === ADMIN_ROLE_ID) - Number(a.id === ADMIN_ROLE_ID)),
    [roles],
  );
  const sections = useMemo(
    () => buildSections(groups, resources, query),
    [groups, resources, query],
  );
  const labelsByGroup = useMemo(
    () => new Map(groups.map((g) => [g.id, permissionLabelList(g.permissions, resources)])),
    [groups, resources],
  );
  // Référence stable tant que ni les ids ni les noms ne changent : les lignes ne se re-rendent pas
  // quand seules des appartenances changent.
  const metaSignature = columns.map((role) => `${role.id}|${role.name}`).join("\n");
  const metaCache = useRef<{ signature: string; value: ColumnMeta[] }>({
    signature: "",
    value: [],
  });
  if (metaCache.current.signature !== metaSignature) {
    metaCache.current = {
      signature: metaSignature,
      value: columns.map((role) => ({ id: role.id, name: role.name })),
    };
  }
  const columnMeta = metaCache.current.value;
  const membership = useMemo(() => columns.map((role) => new Set(role.groupIds)), [columns]);
  const baseMembership = useMemo(() => {
    const byId = new Map((baseline ?? roles).map((role) => [role.id, new Set(role.groupIds)]));
    return columns.map((role) => byId.get(role.id) ?? new Set<string>());
  }, [baseline, roles, columns]);
  const searching = query.trim().length > 0;

  // Les données courantes passent par une ref : le rappel reste stable, donc les lignes inchangées ne se re-rendent pas.
  const latest = useRef({ columns, groups, onToggle });
  latest.current = { columns, groups, onToggle };
  const handleToggle = useCallback((roleId: string, groupId: string, checked: boolean) => {
    const { columns: cols, groups: all, onToggle: notify } = latest.current;
    const role = cols.find((r) => r.id === roleId);
    const group = all.find((g) => g.id === groupId);
    if (role && group) notify(role, group, checked);
  }, []);

  // Surbrillance de la colonne survolée ou focalisée, sans re-rendu React.
  function highlight(col: string | null) {
    if (hovered.current === col) return;
    const table = tableRef.current;
    if (!table) return;
    if (hovered.current !== null) {
      table
        .querySelectorAll(`[data-col="${hovered.current}"]`)
        .forEach((el) => el.classList.remove(HIGHLIGHT));
    }
    if (col !== null) {
      table.querySelectorAll(`[data-col="${col}"]`).forEach((el) => el.classList.add(HIGHLIGHT));
    }
    hovered.current = col;
  }

  function colOf(target: EventTarget): string | null {
    return (target as HTMLElement).closest?.("[data-col]")?.getAttribute("data-col") ?? null;
  }

  function toggleDomain(domain: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-subtle"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Rechercher un groupe"
              placeholder="Rechercher un groupe…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-64 pl-8"
            />
          </div>
          <p className="text-sm text-muted" aria-live="polite">
            {sections.reduce((n, s) => n + s.groups.length, 0)} groupe
            {sections.reduce((n, s) => n + s.groups.length, 0) > 1 ? "s" : ""} · {columns.length}{" "}
            rôles
          </p>
        </div>

        <div className="max-h-[70vh] overflow-auto rounded-lg border border-zinc-200">
          <table
            ref={tableRef}
            aria-label="Matrice des droits : rôles en colonnes, groupes de permissions en lignes"
            className="w-full border-separate border-spacing-0 text-sm"
            onMouseOver={(event) => highlight(colOf(event.target))}
            onMouseLeave={() => highlight(null)}
            onFocus={(event) => highlight(colOf(event.target))}
            onBlur={() => highlight(null)}
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-30 min-w-56 border-b border-zinc-200 bg-white px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-subtle"
                >
                  Groupe de permissions
                </th>
                {columns.map((role, index) => (
                  <th
                    key={role.id}
                    scope="col"
                    data-col={index}
                    className="sticky top-0 z-20 border-b border-zinc-200 bg-white px-2 py-2 text-center align-bottom"
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="flex items-center gap-1 text-xs font-semibold text-zinc-900">
                        {role.id === ADMIN_ROLE_ID && (
                          <Hint label={ADMIN_LOCK_HINT} side="bottom">
                            <span
                              tabIndex={0}
                              role="img"
                              aria-label="Rôle verrouillé"
                              className="alterra-focus rounded-sm text-subtle"
                            >
                              <Lock className="h-3 w-3" aria-hidden />
                            </span>
                          </Hint>
                        )}
                        {role.name}
                        <SensitiveMfaWarning role={role} resources={resources} />
                      </span>
                      <span className="text-[11px] font-normal text-muted">
                        {SCOPE_LABELS[role.scope]} · {role.userCount} util.
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => {
                const open = searching || !collapsed.has(section.domain);
                return (
                  <SectionRows
                    key={section.domain}
                    domain={section.domain}
                    groups={section.groups}
                    open={open}
                    columns={columnMeta}
                    membership={membership}
                    baseMembership={baseMembership}
                    labelsByGroup={labelsByGroup}
                    onToggleDomain={toggleDomain}
                    onToggle={handleToggle}
                  />
                );
              })}
            </tbody>
          </table>
          {sections.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Aucun groupe ne correspond à « {query} ».
            </p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

interface SectionRowsProps {
  domain: string;
  groups: PermissionGroup[];
  open: boolean;
  columns: ColumnMeta[];
  membership: Set<string>[];
  baseMembership: Set<string>[];
  labelsByGroup: Map<string, string[]>;
  onToggleDomain: (domain: string) => void;
  onToggle: (roleId: string, groupId: string, checked: boolean) => void;
}

function SectionRows({
  domain,
  groups,
  open,
  columns,
  membership,
  baseMembership,
  labelsByGroup,
  onToggleDomain,
  onToggle,
}: SectionRowsProps) {
  return (
    <>
      <tr>
        <td
          colSpan={columns.length + 1}
          className="border-b border-zinc-200 bg-surface-muted/70 p-0"
        >
          <button
            type="button"
            aria-expanded={open}
            onClick={() => onToggleDomain(domain)}
            className="alterra-focus sticky left-0 flex min-h-9 items-center gap-1.5 px-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700"
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            )}
            {domain}
            <span className="font-normal normal-case text-muted">
              ({groups.length} groupe{groups.length > 1 ? "s" : ""})
            </span>
          </button>
        </td>
      </tr>
      {open &&
        groups.map((group) => (
          <MatrixRow
            key={group.id}
            group={group}
            roles={columns}
            bits={membership.map((set) => (set.has(group.id) ? "1" : "0")).join("")}
            changedBits={membership
              .map((set, index) =>
                set.has(group.id) !== baseMembership[index].has(group.id) ? "1" : "0",
              )
              .join("")}
            permissionLabels={labelsByGroup.get(group.id) ?? []}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}
