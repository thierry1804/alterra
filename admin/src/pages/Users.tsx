import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../lib/api";
import type { AppUser, Site } from "../lib/referentials";
import { USER_ROLE_LABELS, formatDate } from "../lib/referentials";
import PageHeader, { LoadMoreButton } from "../components/shared/PageHeader";
import { Pencil, KeyRound, UserX, Download } from "lucide-react";
import { Button } from "../components/ui/button";
import { IconButton, RowActions } from "../components/ui/IconButton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { useRowSelection } from "../components/ui/data-table/useRowSelection";
import { useServerSort } from "../components/ui/data-table/useServerSort";
import { SortableHead } from "../components/ui/data-table/SortableHead";
import { BulkActionBar } from "../components/ui/data-table/BulkActionBar";
import { exportToExcel } from "../components/ui/data-table/exportToExcel";
import { fetchAllCursorPages } from "../components/ui/data-table/fetchAllPages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "../hooks/use-toast";

interface UserForm {
  email: string;
  firstName: string;
  lastName: string;
  role: AppUser["role"];
  siteId: string;
  password: string;
}

const emptyForm: UserForm = {
  email: "",
  firstName: "",
  lastName: "",
  role: "CHEF_SERVICE",
  siteId: "",
  password: "",
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<AppUser["role"] | "">("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const { data: sites = [] } = useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
  });

  const { sortKey, sortDir, toggleSort } = useServerSort("lastName");

  const usersQuery = useInfiniteQuery({
    queryKey: ["users", roleFilter, sortKey, sortDir],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: AppUser[]; nextCursor: string | null; hasMore: boolean }>("/users", {
          params: {
            role: roleFilter || undefined,
            cursor: pageParam,
            take: 50,
            orderBy: sortKey ?? undefined,
            dir: sortKey ? sortDir : undefined,
          },
        })
        .then((r) => r.data),
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor ?? undefined : undefined),
  });

  const users = useMemo(
    () => usersQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [usersQuery.data],
  );

  const selection = useRowSelection(users.map((u) => u.id));

  const bulkDeactivateMutation = useMutation({
    mutationFn: () =>
      api.post<{ results: Array<{ id: string; status: string; error?: string }> }>(
        "/users/bulk-deactivate",
        { ids: [...selection.selectedIds] },
      ),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      const failed = res.data.results.filter((r) => r.status === "error");
      selection.clear();
      toast({
        title: failed.length
          ? `${res.data.results.length - failed.length} désactivé(s), ${failed.length} échec(s)`
          : "Utilisateurs désactivés",
        description: failed[0]?.error,
        variant: failed.length ? "destructive" : undefined,
      });
    },
  });

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const all = await fetchAllCursorPages<AppUser>((cursor) =>
        api
          .get<{ data: AppUser[]; nextCursor: string | null; hasMore: boolean }>("/users", {
            params: { role: roleFilter || undefined, cursor, take: 100 },
          })
          .then((r) => r.data),
      );
      await exportToExcel(
        all,
        [
          { header: "Prénom", accessor: (u) => u.firstName },
          { header: "Nom", accessor: (u) => u.lastName },
          { header: "Email", accessor: (u) => u.email ?? "" },
          { header: "Rôle", accessor: (u) => USER_ROLE_LABELS[u.role] },
          { header: "Site", accessor: (u) => siteName(u.siteId) },
          { header: "Dernière connexion", accessor: (u) => (u.lastLoginAt ? formatDate(u.lastLoginAt) : "") },
          { header: "Statut", accessor: (u) => (u.active ? "Actif" : "Inactif") },
        ],
        "utilisateurs",
      );
    } finally {
      setExporting(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        email: form.email.trim() || undefined,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role: form.role,
        siteId: form.siteId || null,
        password: form.password.trim() || undefined,
      };
      if (editing) {
        return api.patch<AppUser>(`/users/${editing.id}`, {
          firstName: payload.firstName,
          lastName: payload.lastName,
          role: payload.role,
          siteId: payload.siteId,
          email: payload.email ?? null,
        });
      }
      return api.post<{ user: AppUser; temporaryPassword?: string }>("/users", payload);
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setDialogOpen(false);
      if ("temporaryPassword" in res.data && res.data.temporaryPassword) {
        setTempPassword(res.data.temporaryPassword);
      }
      toast({ title: editing ? "Utilisateur mis à jour" : "Utilisateur créé" });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (user: AppUser) =>
      api.post<{ temporaryPassword?: string }>(`/users/${user.id}/reset-password`, {}),
    onSuccess: (res) => {
      setTempPassword(res.data.temporaryPassword ?? "Mot de passe défini");
      toast({ title: "Mot de passe réinitialisé" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (user: AppUser) => api.post(`/users/${user.id}/deactivate`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Utilisateur désactivé" });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, siteId: sites[0]?.id ?? "" });
    setDialogOpen(true);
  }

  function openEdit(user: AppUser) {
    setEditing(user);
    setForm({
      email: user.email ?? "",
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      siteId: user.siteId ?? "",
      password: "",
    });
    setDialogOpen(true);
  }

  const siteName = (siteId: string | null) =>
    siteId ? sites.find((s) => s.id === siteId)?.shortCode ?? "—" : "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilisateurs"
        description="Comptes Admin, CDS et CDE."
        action={
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={exporting} onClick={() => void handleExport()}>
              <Download className="h-4 w-4" aria-hidden />
              {exporting ? "Export…" : "Exporter"}
            </Button>
            <Button type="button" onClick={openCreate}>
              Nouvel utilisateur
            </Button>
          </div>
        }
      />

      <select
        className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
        value={roleFilter}
        onChange={(e) => setRoleFilter(e.target.value as AppUser["role"] | "")}
      >
        <option value="">Tous les rôles</option>
        {(Object.keys(USER_ROLE_LABELS) as AppUser["role"][]).map((role) => (
          <option key={role} value={role}>
            {USER_ROLE_LABELS[role]}
          </option>
        ))}
      </select>

      <BulkActionBar count={selection.selectedCount} onClear={selection.clear}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={bulkDeactivateMutation.isPending}
          onClick={() => bulkDeactivateMutation.mutate()}
        >
          <UserX className="h-3.5 w-3.5" aria-hidden />
          Désactiver
        </Button>
      </BulkActionBar>

      <div className="rounded-lg border border-zinc-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-9">
                <Checkbox
                  checked={
                    selection.allVisibleSelected
                      ? true
                      : selection.someVisibleSelected
                        ? "indeterminate"
                        : false
                  }
                  onChange={selection.toggleAllVisible}
                  aria-label="Tout sélectionner"
                />
              </TableHead>
              <SortableHead sortKey="lastName" label="Nom" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="email" label="Email" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="role" label="Rôle" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="siteId" label="Site" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="lastLoginAt" label="Dernière connexion" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="active" label="Statut" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <TableHead className="w-56">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!usersQuery.isLoading &&
              users.map((user) => (
                <TableRow key={user.id} data-state={selection.isSelected(user.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selection.isSelected(user.id)}
                      onChange={() => selection.toggle(user.id)}
                      aria-label={`Sélectionner ${user.firstName} ${user.lastName}`}
                    />
                  </TableCell>
                  <TableCell>
                    {user.firstName} {user.lastName}
                  </TableCell>
                  <TableCell>{user.email ?? "—"}</TableCell>
                  <TableCell>{USER_ROLE_LABELS[user.role]}</TableCell>
                  <TableCell>{siteName(user.siteId)}</TableCell>
                  <TableCell>{formatDate(user.lastLoginAt)}</TableCell>
                  <TableCell>
                    <Badge variant={user.active ? "success" : "danger"}>
                      {user.active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <RowActions>
                      <IconButton
                        icon={Pencil}
                        label="Modifier"
                        variant="brand"
                        onClick={() => openEdit(user)}
                      />
                      <IconButton
                        icon={KeyRound}
                        label="Réinitialiser le mot de passe"
                        loading={resetPasswordMutation.isPending}
                        onClick={() => resetPasswordMutation.mutate(user)}
                      />
                      {user.active && (
                        <IconButton
                          icon={UserX}
                          label="Désactiver"
                          variant="destructive"
                          loading={deactivateMutation.isPending}
                          onClick={() => deactivateMutation.mutate(user)}
                        />
                      )}
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <LoadMoreButton
        hasMore={!!usersQuery.hasNextPage}
        loading={usersQuery.isFetchingNextPage}
        onClick={() => void usersQuery.fetchNextPage()}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</DialogTitle>
            <DialogDescription>
              Mot de passe laissé vide = génération automatique à la création.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="u-first">Prénom</Label>
                <Input
                  id="u-first"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-last">Nom</Label>
                <Input
                  id="u-last"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-email">Email</Label>
              <Input
                id="u-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="u-role">Rôle</Label>
                <select
                  id="u-role"
                  className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value as AppUser["role"] }))
                  }
                >
                  {(Object.keys(USER_ROLE_LABELS) as AppUser["role"][]).map((role) => (
                    <option key={role} value={role}>
                      {USER_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-site">Site</Label>
                <select
                  id="u-site"
                  className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                  value={form.siteId}
                  onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}
                >
                  <option value="">Aucun</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.shortCode}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label htmlFor="u-password">Mot de passe (optionnel)</Label>
                <Input
                  id="u-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tempPassword} onOpenChange={() => setTempPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mot de passe temporaire</DialogTitle>
            <DialogDescription>Communiquez ce mot de passe à l&apos;utilisateur.</DialogDescription>
          </DialogHeader>
          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm">
            {tempPassword}
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setTempPassword(null)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
