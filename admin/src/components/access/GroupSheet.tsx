import { Lock } from "lucide-react";
import { useMemo, useState } from "react";
import type { AccessRole, PermissionGroup, PermissionResource } from "../../lib/access";
import {
  groupFormFrom,
  isGroupFormDirty,
  rolesUsingGroup,
  validateName,
  type GroupFormValues,
} from "../../lib/access-forms";
import { sensitivePermissionsOf } from "../../lib/access-sensitive";
import ConfirmDialog from "../ui/ConfirmDialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import PermissionPicker from "./PermissionPicker";

interface GroupSheetProps {
  /** Groupe édité, ou null pour en créer un. Le composant est monté à l'ouverture : l'état repart de zéro. */
  group: PermissionGroup | null;
  groups: PermissionGroup[];
  roles: AccessRole[];
  resources: PermissionResource[];
  held: ReadonlySet<string>;
  saving: boolean;
  error: string | null;
  onSubmit: (values: GroupFormValues) => void;
  onClose: () => void;
}

/** Panneau de création et de modification d'un groupe de permissions. */
export default function GroupSheet({
  group,
  groups,
  roles,
  resources,
  held,
  saving,
  error,
  onSubmit,
  onClose,
}: GroupSheetProps) {
  const initial = useMemo(() => groupFormFrom(group), [group]);
  const [values, setValues] = useState<GroupFormValues>(initial);
  const [touched, setTouched] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const dirty = isGroupFormDirty(initial, values);
  const nameError = validateName(values.name, groups, group?.id);
  const noPermission = values.permissions.size === 0;
  const canSave = !nameError && (dirty || group === null) && !saving;
  const usedBy = group ? rolesUsingGroup(roles, group.id) : [];
  const affectedUsers = usedBy.reduce((total, role) => total + role.userCount, 0);
  const sensitive = sensitivePermissionsOf({ permissions: [...values.permissions] });

  function requestClose() {
    if (dirty && !saving) setConfirmDiscard(true);
    else onClose();
  }

  function submit() {
    setTouched(true);
    if (canSave) onSubmit(values);
  }

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && requestClose()}>
        <SheetContent className="max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {group ? "Modifier le groupe" : "Nouveau groupe"}
              {group?.isSystem && (
                <span title="Groupe système" className="text-subtle">
                  <Lock className="h-3.5 w-3.5" aria-label="Groupe système" />
                </span>
              )}
            </SheetTitle>
            <SheetDescription>
              Un groupe est un paquet de permissions, réutilisable dans plusieurs rôles.
            </SheetDescription>
          </SheetHeader>
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                submit();
              }
            }}
          >
            <SheetBody className="space-y-5">
              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-danger-bg px-3 py-2 text-sm text-danger"
                >
                  {error}
                </p>
              )}

              {group && usedBy.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-warning-bg px-3 py-2 text-sm text-zinc-900">
                  <p className="font-medium">
                    Utilisé par {usedBy.length} rôle{usedBy.length > 1 ? "s" : ""}
                    {affectedUsers > 0 &&
                      ` · ${affectedUsers} utilisateur${affectedUsers > 1 ? "s" : ""} concerné${affectedUsers > 1 ? "s" : ""}`}
                  </p>
                  <p className="text-xs text-zinc-700">
                    {usedBy.map((role) => role.name).join(", ")}. La modification s&apos;applique à
                    tous ces rôles.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="g-name">Nom</Label>
                <Input
                  id="g-name"
                  autoFocus
                  value={values.name}
                  maxLength={60}
                  aria-invalid={touched && nameError ? true : undefined}
                  aria-describedby={touched && nameError ? "g-name-error" : undefined}
                  onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
                  onBlur={() => setTouched(true)}
                />
                {touched && nameError && (
                  <p id="g-name-error" className="text-xs text-danger">
                    {nameError}
                  </p>
                )}
                <p className="text-xs text-muted">
                  Astuce : « Domaine — détail » (ex. « Badges — gestion ») classe le groupe dans la
                  matrice.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="g-description">Description</Label>
                <Input
                  id="g-description"
                  value={values.description}
                  maxLength={200}
                  onChange={(event) =>
                    setValues((v) => ({ ...v, description: event.target.value }))
                  }
                />
              </div>

              <PermissionPicker
                resources={resources}
                selected={values.permissions}
                held={held}
                onChange={(permissions) => setValues((v) => ({ ...v, permissions }))}
              />

              {noPermission && (
                <p className="text-xs text-muted">
                  Aucune permission : ce groupe ne donnera aucun droit tant qu&apos;il est vide.
                </p>
              )}
              {sensitive.length > 0 && (
                <p className="rounded-md bg-surface-muted px-3 py-2 text-xs text-zinc-700">
                  Ce groupe donne des droits sensibles (validation, paiements, export). Pensez à
                  exiger la double authentification sur les rôles qui l&apos;utilisent.
                </p>
              )}
            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="outline" className="flex-1" onClick={requestClose}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={!canSave} loading={saving}>
                {group ? "Enregistrer" : "Créer le groupe"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDiscard}
        title="Abandonner les modifications ?"
        description="Ce que vous avez saisi dans ce panneau ne sera pas enregistré."
        confirmLabel="Abandonner"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onOpenChange={setConfirmDiscard}
      />
    </>
  );
}
