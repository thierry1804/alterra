import type { AccessRole, PermissionResource } from "./access";
import { permissionLabelList } from "./access-matrix";

/** Droits qui engagent de l'argent ou valident des données : un rôle qui les détient devrait exiger la MFA. */
export const SENSITIVE_PERMISSIONS = [
  "pointage:valider_site",
  "pointage:valider_technique",
  "bordereau:valider_finance",
  "bordereau:valider_dg",
  "paiement:generation",
  "paiement:correction",
  "paiement:suppression",
  "paiement:import_statut",
  "paiement:export",
] as const;

const SENSITIVE = new Set<string>(SENSITIVE_PERMISSIONS);

/** Droits sensibles (validation, paiements, export) détenus par le rôle. */
export function sensitivePermissionsOf(role: Pick<AccessRole, "permissions">): string[] {
  return role.permissions.filter((key) => SENSITIVE.has(key));
}

/** Vrai si le rôle détient un droit sensible sans exiger la double authentification. */
export function lacksMfaOnSensitive(
  role: Pick<AccessRole, "permissions" | "mfaRequired">,
): boolean {
  return !role.mfaRequired && sensitivePermissionsOf(role).length > 0;
}

/** Libellés lisibles des droits sensibles d'un rôle, pour l'infobulle d'alerte. */
export function sensitiveLabels(
  role: Pick<AccessRole, "permissions">,
  resources: readonly PermissionResource[],
): string[] {
  return permissionLabelList(sensitivePermissionsOf(role), resources);
}
