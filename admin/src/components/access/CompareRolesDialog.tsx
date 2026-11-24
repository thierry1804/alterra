import { Check, Minus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  SCOPE_LABELS,
  type AccessRole,
  type PermissionGroup,
  type PermissionResource,
} from "../../lib/access";
import { compareRoles } from "../../lib/access-compare";
import { groupShortName } from "../../lib/access-matrix";
import { cn } from "../../lib/utils";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Label } from "../ui/label";
import { Select } from "../ui/select";

interface CompareRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: AccessRole[];
  groups: PermissionGroup[];
  resources: PermissionResource[];
  /** Rôle de gauche à l'ouverture (ex. depuis le menu d'une ligne). */
  initialLeftId?: string | null;
}

function Mark({ on, label }: { on: boolean; label: string }) {
  return on ? (
    <span role="img" aria-label={`${label} : oui`} className="inline-flex text-success">
      <Check className="h-4 w-4" aria-hidden />
    </span>
  ) : (
    <span role="img" aria-label={`${label} : non`} className="inline-flex text-zinc-300">
      <Minus className="h-4 w-4" aria-hidden />
    </span>
  );
}

/** Comparaison côte à côte des groupes, de la portée et du MFA de deux rôles. */
export default function CompareRolesDialog({
  open,
  onOpenChange,
  roles,
  groups,
  resources,
  initialLeftId,
}: CompareRolesDialogProps) {
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [onlyDifferences, setOnlyDifferences] = useState(false);

  useEffect(() => {
    if (!open) return;
    const left = roles.find((role) => role.id === initialLeftId) ?? roles[0];
    const right = roles.find((role) => role.id !== left?.id);
    setLeftId(left?.id ?? "");
    setRightId(right?.id ?? "");
    setOnlyDifferences(false);
  }, [open, initialLeftId, roles]);

  const left = roles.find((role) => role.id === leftId);
  const right = roles.find((role) => role.id === rightId);
  const comparison = useMemo(
    () => (left && right ? compareRoles(left, right, groups, resources, onlyDifferences) : null),
    [left, right, groups, resources, onlyDifferences],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparer deux rôles</DialogTitle>
          <DialogDescription>
            Groupes de permissions, portée et MFA des rôles enregistrés, côte à côte.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["Premier rôle", leftId, setLeftId, rightId],
              ["Second rôle", rightId, setRightId, leftId],
            ] as const
          ).map(([label, value, setValue, other]) => (
            <div key={label} className="space-y-1">
              <Label>{label}</Label>
              <Select
                aria-label={label}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="w-full"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id} disabled={role.id === other}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>

        {left && right && comparison && (
          <div className="mt-4 space-y-4">
            <dl className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Portée</dt>
              {[left, right].map((role) => (
                <dd
                  key={role.id}
                  className={cn(!comparison.scope.same && "font-semibold text-zinc-900")}
                >
                  {SCOPE_LABELS[role.scope]}
                </dd>
              ))}
              <dt className="text-muted">MFA</dt>
              {[left, right].map((role) => (
                <dd
                  key={role.id}
                  className={cn(!comparison.mfa.same && "font-semibold text-zinc-900")}
                >
                  {role.mfaRequired ? "Exigée" : "Non exigée"}
                </dd>
              ))}
              <dt className="text-muted">Utilisateurs</dt>
              {[left, right].map((role) => (
                <dd key={role.id}>{role.userCount}</dd>
              ))}
            </dl>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted" aria-live="polite">
                {comparison.common} en commun · {comparison.onlyA} seulement dans {left.name} ·{" "}
                {comparison.onlyB} seulement dans {right.name}
              </p>
              <label className="flex min-h-8 items-center gap-2 text-sm">
                <Checkbox
                  checked={onlyDifferences}
                  onChange={(event) => setOnlyDifferences(event.target.checked)}
                />
                Différences seulement
              </label>
            </div>

            {comparison.sections.length === 0 ? (
              <p className="rounded-md border border-zinc-200 bg-surface-muted/60 px-4 py-6 text-center text-sm text-muted">
                {onlyDifferences
                  ? "Ces deux rôles ont exactement les mêmes groupes."
                  : "Aucun de ces rôles n'a de groupe."}
              </p>
            ) : (
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="border-b border-zinc-200 py-2 text-left text-xs font-semibold uppercase tracking-wide text-subtle"
                    >
                      Groupe
                    </th>
                    <th
                      scope="col"
                      className="w-32 border-b border-zinc-200 py-2 text-center text-xs font-semibold text-zinc-900"
                    >
                      {left.name}
                    </th>
                    <th
                      scope="col"
                      className="w-32 border-b border-zinc-200 py-2 text-center text-xs font-semibold text-zinc-900"
                    >
                      {right.name}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.sections.map((section) => (
                    <SectionBody
                      key={section.domain}
                      domain={section.domain}
                      rows={section.rows}
                      leftName={left.name}
                      rightName={right.name}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionBody({
  domain,
  rows,
  leftName,
  rightName,
}: {
  domain: string;
  rows: { group: PermissionGroup; inA: boolean; inB: boolean }[];
  leftName: string;
  rightName: string;
}) {
  return (
    <>
      <tr>
        <th
          scope="colgroup"
          colSpan={3}
          className="bg-surface-muted/70 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700"
        >
          {domain}
        </th>
      </tr>
      {rows.map(({ group, inA, inB }) => (
        <tr key={group.id} className={cn(inA !== inB && "bg-warning-bg/60")}>
          <th scope="row" className="border-b border-zinc-100 px-2 py-1.5 text-left font-normal">
            {groupShortName(group)}
          </th>
          <td className="border-b border-zinc-100 text-center">
            <Mark on={inA} label={`${leftName} : ${group.name}`} />
          </td>
          <td className="border-b border-zinc-100 text-center">
            <Mark on={inB} label={`${rightName} : ${group.name}`} />
          </td>
        </tr>
      ))}
    </>
  );
}
