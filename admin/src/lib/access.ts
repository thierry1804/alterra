import { api } from "./api";

export type AccessScope = "TOUS" | "SITE" | "EQUIPE";

/** Identifiant du rôle Administrateur (rôle système, identique côté serveur) : verrouillé dans la matrice. */
export const ADMIN_ROLE_ID = "00000000-0000-0000-000b-000000000001";

export const SCOPE_LABELS: Record<AccessScope, string> = {
  TOUS: "Tous les sites",
  SITE: "Son site",
  EQUIPE: "Son équipe",
};

export interface PermissionAction {
  action: string;
  label: string;
}

export interface PermissionResource {
  resource: string;
  label: string;
  actions: PermissionAction[];
}

export interface PermissionGroup {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  roleCount: number;
}

export interface AccessRole {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  scope: AccessScope;
  mfaRequired: boolean;
  groupIds: string[];
  permissions: string[];
  userCount: number;
  /** Horodatage de dernière modification : sert à refuser l'écrasement d'une modification plus récente. */
  version: string;
}

export interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  scope: AccessScope;
  isSystem: boolean;
}

export const accessApi = {
  catalog: () =>
    api.get<{ resources: PermissionResource[] }>("/access/catalog").then((r) => r.data.resources),
  roleOptions: () =>
    api.get<{ data: RoleOption[] }>("/access/role-options").then((r) => r.data.data),
  groups: () => api.get<{ data: PermissionGroup[] }>("/access/groups").then((r) => r.data.data),
  createGroup: (body: { name: string; description?: string | null; permissions: string[] }) =>
    api.post<PermissionGroup>("/access/groups", body).then((r) => r.data),
  updateGroup: (
    id: string,
    body: { name?: string; description?: string | null; permissions?: string[] },
  ) => api.patch<PermissionGroup>(`/access/groups/${id}`, body).then((r) => r.data),
  deleteGroup: (id: string) => api.delete(`/access/groups/${id}`),
  roles: () => api.get<{ data: AccessRole[] }>("/access/roles").then((r) => r.data.data),
  createRole: (body: {
    name: string;
    description?: string | null;
    scope: AccessScope;
    mfaRequired?: boolean;
    groupIds: string[];
  }) => api.post<AccessRole>("/access/roles", body).then((r) => r.data),
  updateRole: (
    id: string,
    body: {
      name?: string;
      description?: string | null;
      scope?: AccessScope;
      mfaRequired?: boolean;
      groupIds?: string[];
    },
  ) => api.patch<AccessRole>(`/access/roles/${id}`, body).then((r) => r.data),
  deleteRole: (id: string) => api.delete(`/access/roles/${id}`),
  /** Sauvegarde groupée, tout ou rien : renvoie les rôles après et avant modification. */
  bulkUpdateRoles: (
    changes: Array<{
      roleId: string;
      expectedVersion?: string;
      name?: string;
      description?: string | null;
      scope?: AccessScope;
      mfaRequired?: boolean;
      groupIds?: string[];
    }>,
  ) =>
    api
      .post<{ data: AccessRole[]; before: AccessRole[] }>("/access/roles/bulk", { changes })
      .then((r) => r.data),
};
