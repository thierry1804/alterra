import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { PermissionResource } from "../../lib/access";
import {
  filterResources,
  resourceKeys,
  resourceState,
  setResourceChecked,
} from "../../lib/access-forms";
import { cn } from "../../lib/utils";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";

interface PermissionPickerProps {
  resources: PermissionResource[];
  selected: Set<string>;
  /** Droits que l'acteur détient : il ne peut pas en accorder d'autres. */
  held: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}

/** Choix des permissions d'un groupe : par ressource, avec recherche, « tout » par ressource et compteurs. */
export default function PermissionPicker({
  resources,
  selected,
  held,
  onChange,
}: PermissionPickerProps) {
  const [query, setQuery] = useState("");
  const [toggledOpen, setToggledOpen] = useState<Record<string, boolean>>({});
  const searching = query.trim().length > 0;
  const visible = useMemo(() => filterResources(resources, query), [resources, query]);

  const isOpen = (resource: PermissionResource) =>
    searching ||
    (toggledOpen[resource.resource] ?? resourceKeys(resource).some((key) => selected.has(key)));

  return (
    <fieldset className="space-y-3">
      <legend className="flex w-full items-center justify-between text-sm font-medium text-zinc-900">
        Permissions
        <span className="text-xs font-normal text-muted" aria-live="polite">
          {selected.size} sélectionnée{selected.size > 1 ? "s" : ""}
        </span>
      </legend>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-subtle"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Rechercher une permission"
          placeholder="Rechercher une permission…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-8"
        />
      </div>

      {visible.length === 0 && (
        <p className="rounded-md border border-zinc-200 px-3 py-4 text-center text-sm text-muted">
          Aucune permission ne correspond à « {query} ».
        </p>
      )}

      {visible.map((resource) => {
        const state = resourceState(resource, selected, held);
        const keys = resourceKeys(resource);
        const count = keys.filter((key) => selected.has(key)).length;
        const open = isOpen(resource);
        const nothingAllowed = keys.every((key) => !held.has(key) && !selected.has(key));
        return (
          <div key={resource.resource} className="rounded-md border border-zinc-200">
            <div className="flex min-h-10 items-center gap-2 px-3">
              <Checkbox
                aria-label={`Tout sélectionner : ${resource.label}`}
                checked={state === "all" ? true : state === "some" ? "indeterminate" : false}
                disabled={nothingAllowed}
                onChange={(event) =>
                  onChange(setResourceChecked(resource, selected, held, event.target.checked))
                }
              />
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setToggledOpen((current) => ({ ...current, [resource.resource]: !open }))
                }
                className="alterra-focus flex min-h-8 flex-1 items-center gap-1.5 rounded-sm text-left text-sm font-semibold text-zinc-900"
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5 text-subtle" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-subtle" aria-hidden />
                )}
                {resource.label}
                <span
                  className={cn(
                    "ml-auto text-xs font-normal",
                    count > 0 ? "text-brand" : "text-muted",
                  )}
                >
                  {count}/{keys.length}
                </span>
              </button>
            </div>
            {open && (
              <div className="grid gap-0.5 border-t border-zinc-100 px-3 py-2">
                {resource.actions.map((action) => {
                  const key = `${resource.resource}:${action.action}`;
                  const allowed = held.has(key);
                  const checked = selected.has(key);
                  return (
                    <label
                      key={key}
                      title={allowed ? undefined : "Vous ne détenez pas ce droit"}
                      className={cn(
                        "flex min-h-8 items-center gap-2 text-sm",
                        allowed || checked ? "text-zinc-700" : "text-subtle",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!allowed && !checked}
                        onChange={() => {
                          const next = new Set(selected);
                          if (checked) next.delete(key);
                          else next.add(key);
                          onChange(next);
                        }}
                      />
                      {action.label}
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
