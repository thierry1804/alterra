import { useEffect, useMemo, useState } from "react";
import type { AccessRole, PermissionGroup } from "../../lib/access";
import {
  describeChanges,
  needsExplicitConfirmation,
  type RolesDraft,
} from "../../lib/access-draft";
import { confirmationFor } from "../../lib/access-roles";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

interface ReviewChangesDialogProps {
  open: boolean;
  roles: AccessRole[];
  groups: PermissionGroup[];
  draft: RolesDraft;
  busy?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

/** Résumé lisible des changements et de leur impact, avant l'enregistrement groupé. */
export default function ReviewChangesDialog({
  open,
  roles,
  groups,
  draft,
  busy = false,
  onConfirm,
  onOpenChange,
}: ReviewChangesDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (open) setAcknowledged(false);
  }, [open]);

  const entries = useMemo(
    () =>
      roles
        .filter((role) => draft[role.id])
        .map((role) => {
          const { patch } = draft[role.id];
          return {
            role,
            lines: describeChanges(role, patch, groups),
            sensitive: needsExplicitConfirmation(role, patch),
            warning: confirmationFor(role, patch),
          };
        }),
    [roles, groups, draft],
  );
  const sensitive = entries.some((entry) => entry.sensitive);
  const canConfirm = !sensitive || acknowledged;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enregistrer les modifications ?</DialogTitle>
          <DialogDescription>
            Tout est appliqué en une fois : si un changement est refusé, aucun n'est enregistré.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-4">
          {entries.map(({ role, lines, sensitive: isSensitive }) => (
            <li key={role.id} className="rounded-lg border border-zinc-200 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900">{role.name}</p>
                <p className="text-xs text-muted">
                  {role.userCount === 0
                    ? "Aucun utilisateur concerné"
                    : `${role.userCount} utilisateur${role.userCount > 1 ? "s" : ""} concerné${role.userCount > 1 ? "s" : ""}`}
                  {isSensitive && " · changement sensible"}
                </p>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {lines.map((line) => (
                  <li
                    key={`${line.kind}:${line.text}`}
                    className={
                      line.kind === "added"
                        ? "text-success"
                        : line.kind === "removed"
                          ? "text-danger"
                          : "text-zinc-700"
                    }
                  >
                    {line.kind === "added" && <span aria-label="Ajouté">+ Groupe : </span>}
                    {line.kind === "removed" && <span aria-label="Retiré">− Groupe : </span>}
                    {line.text}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        {sensitive && (
          <label className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-warning-bg p-3 text-sm text-zinc-900">
            <Checkbox
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              Je confirme ces changements, dont au moins un touche un rôle système ou retire
              l'exigence de double authentification.
            </span>
          </label>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Revenir
          </Button>
          <Button type="button" disabled={busy || !canConfirm} onClick={onConfirm}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
