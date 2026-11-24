import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { PermissionGroup, PermissionResource } from "../../lib/access";
import { groupBeyondActor } from "../../lib/access-forms";
import { buildSections, groupShortName, permissionLabelList } from "../../lib/access-matrix";
import { cn } from "../../lib/utils";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";

interface GroupPickerProps {
  groups: PermissionGroup[];
  resources: PermissionResource[];
  selected: Set<string>;
  held: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}

/** Choix des groupes d'un rôle : regroupés par domaine, avec recherche et « tout » par domaine. */
export default function GroupPicker({
  groups,
  resources,
  selected,
  held,
  onChange,
}: GroupPickerProps) {
  const [query, setQuery] = useState("");
  const [toggledOpen, setToggledOpen] = useState<Record<string, boolean>>({});
  const searching = query.trim().length > 0;
  const sections = useMemo(
    () => buildSections(groups, resources, query),
    [groups, resources, query],
  );

  return (
    <fieldset className="space-y-3">
      <legend className="flex w-full items-center justify-between text-sm font-medium text-zinc-900">
        Groupes de permissions
        <span className="text-xs font-normal text-muted" aria-live="polite">
          {selected.size} sur {groups.length}
        </span>
      </legend>

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
          className="pl-8"
        />
      </div>

      {sections.length === 0 && (
        <p className="rounded-md border border-zinc-200 px-3 py-4 text-center text-sm text-muted">
          Aucun groupe ne correspond à « {query} ».
        </p>
      )}

      {sections.map((section) => {
        const choosable = section.groups.filter(
          (group) => !groupBeyondActor(group, held) || selected.has(group.id),
        );
        const count = section.groups.filter((group) => selected.has(group.id)).length;
        const open = searching || (toggledOpen[section.domain] ?? count > 0);
        const allChecked =
          choosable.length > 0 && choosable.every((group) => selected.has(group.id));
        const someChecked = !allChecked && choosable.some((group) => selected.has(group.id));
        return (
          <div key={section.domain} className="rounded-md border border-zinc-200">
            <div className="flex min-h-10 items-center gap-2 px-3">
              <Checkbox
                aria-label={`Tout sélectionner : ${section.domain}`}
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                disabled={choosable.length === 0}
                onChange={(event) => {
                  const next = new Set(selected);
                  for (const group of choosable) {
                    if (event.target.checked) next.add(group.id);
                    else next.delete(group.id);
                  }
                  onChange(next);
                }}
              />
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setToggledOpen((current) => ({ ...current, [section.domain]: !open }))
                }
                className="alterra-focus flex min-h-8 flex-1 items-center gap-1.5 rounded-sm text-left text-sm font-semibold text-zinc-900"
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5 text-subtle" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-subtle" aria-hidden />
                )}
                {section.domain}
                <span
                  className={cn(
                    "ml-auto text-xs font-normal",
                    count > 0 ? "text-brand" : "text-muted",
                  )}
                >
                  {count}/{section.groups.length}
                </span>
              </button>
            </div>
            {open && (
              <div className="grid gap-0.5 border-t border-zinc-100 px-3 py-2">
                {section.groups.map((group) => {
                  const beyond = groupBeyondActor(group, held);
                  const checked = selected.has(group.id);
                  return (
                    <label
                      key={group.id}
                      title={
                        beyond
                          ? "Ce groupe contient des droits que vous ne détenez pas"
                          : permissionLabelList(group.permissions, resources).join(" · ")
                      }
                      className={cn(
                        "flex min-h-8 items-center gap-2 text-sm",
                        beyond && !checked ? "text-subtle" : "text-zinc-700",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={beyond && !checked}
                        onChange={() => {
                          const next = new Set(selected);
                          if (checked) next.delete(group.id);
                          else next.add(group.id);
                          onChange(next);
                        }}
                      />
                      {groupShortName(group)}
                      <span className="text-xs text-muted">({group.permissions.length})</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
