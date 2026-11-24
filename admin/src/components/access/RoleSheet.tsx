import { Lock, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ADMIN_ROLE_ID,
  SCOPE_LABELS,
  type AccessRole,
  type AccessScope,
  type PermissionGroup,
  type PermissionResource,
} from "../../lib/access";
import {
  isRoleFormDirty,
  permissionsOfGroups,
  roleFormFrom,
  validateName,
  type RoleFormValues,
} from "../../lib/access-forms";
import { summarizeAccess } from "../../lib/access-roles";
import { lacksMfaOnSensitive, sensitiveLabels } from "../../lib/access-sensitive";
import { cn } from "../../lib/utils";
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
import { Switch } from "../ui/switch";
import GroupPicker from "./GroupPicker";

const SCOPE_RANK: Record<AccessScope, number> = { EQUIPE: 0, SITE: 1, TOUS: 2 };

const SCOPE_HELP: Record<AccessScope, string> = {
  TOUS: "Voit les données de tous les sites.",
  SITE: "Ne voit que les données de son site.",
  EQUIPE: "Ne voit que les données de son équipe.",
};

interface RoleSheetProps {
  /** Rôle édité, ou null pour en créer un. Monté à l'ouverture : l'état repart de zéro. */
  role: AccessRole | null;
  roles: AccessRole[];
  groups: PermissionGroup[];
  resources: PermissionResource[];
  held: ReadonlySet<string>;
  /** Portée de l'acteur : il ne peut pas en donner une plus large. */
  actorScope: AccessScope | undefined;
  saving: boolean;
  error: string | null;
  onSubmit: (values: RoleFormValues) => void;
  onClose: () => void;
}

/** Panneau de création et de modification d'un rôle. */
export default function RoleSheet({
  role,
  roles,
  groups,
  resources,
  held,
  actorScope,
  saving,
  error,
  onSubmit,
  onClose,
}: RoleSheetProps) {
  const initial = useMemo(() => roleFormFrom(role), [role]);
  const [values, setValues] = useState<RoleFormValues>(initial);
  const [touched, setTouched] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const locked = role?.id === ADMIN_ROLE_ID;
  const dirty = isRoleFormDirty(initial, values);
  const nameError = validateName(values.name, roles, role?.id);
  const canSave = !nameError && (dirty || role === null) && !saving;

  const permissions = useMemo(
    () => permissionsOfGroups(groups, values.groupIds),
    [groups, values.groupIds],
  );
  const domains = useMemo(() => summarizeAccess(permissions, resources), [permissions, resources]);
  const needsMfa = lacksMfaOnSensitive({ permissions, mfaRequired: values.mfaRequired });

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
              {role ? "Modifier le rôle" : "Nouveau rôle"}
              {role?.isSystem && (
                <Lock className="h-3.5 w-3.5 text-subtle" aria-label="Rôle système" />
              )}
            </SheetTitle>
            <SheetDescription>
              Un rôle regroupe des groupes de permissions et fixe la portée des données visibles.
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

              {role && (role.userCount > 0 || role.isSystem) && (
                <div className="rounded-md border border-amber-200 bg-warning-bg px-3 py-2 text-sm text-zinc-900">
                  {role.userCount > 0 && (
                    <p className="font-medium">
                      {role.userCount} utilisateur{role.userCount > 1 ? "s ont" : " a"} ce rôle : la
                      modification s&apos;applique à tous.
                    </p>
                  )}
                  {role.isSystem && (
                    <p className="text-xs text-zinc-700">
                      Rôle système, utilisé par défaut dans l&apos;application.
                    </p>
                  )}
                  {locked && (
                    <p className="text-xs text-zinc-700">
                      Les groupes et la portée de l&apos;Administrateur sont verrouillés pour éviter
                      de perdre l&apos;accès à l&apos;administration.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="r-name">Nom</Label>
                <Input
                  id="r-name"
                  autoFocus
                  value={values.name}
                  maxLength={60}
                  aria-invalid={touched && nameError ? true : undefined}
                  aria-describedby={touched && nameError ? "r-name-error" : undefined}
                  onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
                  onBlur={() => setTouched(true)}
                />
                {touched && nameError && (
                  <p id="r-name-error" className="text-xs text-danger">
                    {nameError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="r-description">Description</Label>
                <Input
                  id="r-description"
                  value={values.description}
                  maxLength={200}
                  onChange={(event) =>
                    setValues((v) => ({ ...v, description: event.target.value }))
                  }
                />
              </div>

              <fieldset className="space-y-2" disabled={locked}>
                <legend className="text-sm font-medium text-zinc-900">Portée des données</legend>
                <div
                  role="radiogroup"
                  aria-label="Portée des données"
                  className="grid gap-2 sm:grid-cols-3"
                >
                  {(["TOUS", "SITE", "EQUIPE"] as AccessScope[]).map((scope) => {
                    const tooWide = !!actorScope && SCOPE_RANK[scope] > SCOPE_RANK[actorScope];
                    const selected = values.scope === scope;
                    return (
                      <button
                        key={scope}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={(tooWide && !selected) || locked}
                        title={tooWide ? "Plus large que votre propre portée" : undefined}
                        onClick={() => setValues((v) => ({ ...v, scope }))}
                        className={cn(
                          "alterra-focus min-h-16 rounded-md border p-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                          selected
                            ? "border-brand bg-brand-tint"
                            : "border-zinc-200 bg-white hover:bg-zinc-50",
                        )}
                      >
                        <span className="block text-sm font-medium text-zinc-900">
                          {SCOPE_LABELS[scope]}
                        </span>
                        <span className="block text-xs text-muted">{SCOPE_HELP[scope]}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-2 rounded-md border border-zinc-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label id="r-mfa-label" htmlFor="r-mfa">
                      Double authentification
                    </Label>
                    <p className="text-xs text-muted">
                      Un code à 6 chiffres est demandé à chaque connexion. À la première connexion,
                      l&apos;utilisateur doit activer son application d&apos;authentification.
                    </p>
                  </div>
                  <Switch
                    id="r-mfa"
                    aria-labelledby="r-mfa-label"
                    checked={values.mfaRequired}
                    onCheckedChange={(mfaRequired) => setValues((v) => ({ ...v, mfaRequired }))}
                  />
                </div>
                {needsMfa && (
                  <p className="flex items-start gap-2 rounded-md bg-warning-bg px-2.5 py-2 text-xs text-zinc-900">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                    <span>
                      Ce rôle peut{" "}
                      {sensitiveLabels({ permissions }, resources).join(", ").toLowerCase()} : la
                      double authentification est recommandée.
                    </span>
                  </p>
                )}
              </div>

              <div
                className={cn(locked && "pointer-events-none opacity-60")}
                aria-disabled={locked}
              >
                <GroupPicker
                  groups={groups}
                  resources={resources}
                  selected={values.groupIds}
                  held={held}
                  onChange={(groupIds) => setValues((v) => ({ ...v, groupIds }))}
                />
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-medium text-zinc-900">
                  Droits obtenus ({permissions.length})
                </p>
                {domains.length === 0 ? (
                  <p className="text-xs text-muted">Aucun groupe sélectionné.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {domains.map((domain) => (
                      <li
                        key={domain.resource}
                        title={domain.actions.join(" · ")}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200"
                      >
                        {domain.label} · {domain.actions.length}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="outline" className="flex-1" onClick={requestClose}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={!canSave} loading={saving}>
                {role ? "Enregistrer" : "Créer le rôle"}
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
