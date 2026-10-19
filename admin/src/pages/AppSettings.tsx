import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Download, TriangleAlert } from "lucide-react";
import { api } from "../lib/api";
import {
  APP_ICON_URL,
  LOGIN_BACKGROUND_URL,
  LOGIN_BRANCH_URL,
  LOGIN_LEAF_URL,
} from "../hooks/useAppSettings";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "../hooks/use-toast";

interface AppSettingsResponse {
  appName: string;
  iconUpdatedAt: string | null;
  loginBackgroundUpdatedAt: string | null;
  loginBranchUpdatedAt: string | null;
  loginLeafUpdatedAt: string | null;
  mapTilerKeyConfigured: boolean;
  bioValidationRequired: boolean;
}

const ICON_MAX_BYTES = 2 * 1024 * 1024;
const ICON_MIME_TO_EXT: Record<string, "png" | "jpg" | "svg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

const LOGIN_ASSET_MAX_BYTES = 5 * 1024 * 1024;
const LOGIN_ASSET_MIME_TO_EXT: Record<string, "png" | "jpg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

type LoginAssetSlot = "loginBackground" | "loginBranch" | "loginLeaf";

interface LoginAssetConfig {
  slot: LoginAssetSlot;
  urlSegment: string;
  label: string;
  description: string;
  previewClassName: string;
}

const LOGIN_ASSET_CONFIGS: LoginAssetConfig[] = [
  {
    slot: "loginBackground",
    urlSegment: "login-background",
    label: "Fond de l'écran de connexion",
    description: "PNG, JPG ou WebP — 5 Mo maximum.",
    previewClassName: "h-16 w-28 object-cover",
  },
  {
    slot: "loginBranch",
    urlSegment: "login-branch",
    label: "Décor coin supérieur droit",
    description: "PNG, JPG ou WebP — 5 Mo maximum.",
    previewClassName: "h-16 w-16 object-contain",
  },
  {
    slot: "loginLeaf",
    urlSegment: "login-leaf",
    label: "Décor coin inférieur gauche",
    description: "PNG, JPG ou WebP — 5 Mo maximum.",
    previewClassName: "h-16 w-16 object-contain",
  },
];

const RESTORE_CONFIRM_PHRASE = "RESTAURER";

export default function AppSettingsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const loginBackgroundInputRef = useRef<HTMLInputElement>(null);
  const loginBranchInputRef = useRef<HTMLInputElement>(null);
  const loginLeafInputRef = useRef<HTMLInputElement>(null);
  const loginAssetInputRefs: Record<LoginAssetSlot, React.RefObject<HTMLInputElement>> = {
    loginBackground: loginBackgroundInputRef,
    loginBranch: loginBranchInputRef,
    loginLeaf: loginLeafInputRef,
  };
  const [appName, setAppName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<LoginAssetSlot | null>(null);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [pendingBackupKey, setPendingBackupKey] = useState<string | null>(null);
  const [pendingBackupName, setPendingBackupName] = useState<string | null>(null);
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [mapApiKeyInput, setMapApiKeyInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => api.get<AppSettingsResponse>("/app-settings").then((r) => r.data),
  });

  const iconUrl = data?.iconUpdatedAt
    ? `${APP_ICON_URL}?v=${encodeURIComponent(data.iconUpdatedAt)}`
    : APP_ICON_URL;

  const LOGIN_ASSET_BASE_URL: Record<LoginAssetSlot, string> = {
    loginBackground: LOGIN_BACKGROUND_URL,
    loginBranch: LOGIN_BRANCH_URL,
    loginLeaf: LOGIN_LEAF_URL,
  };
  const LOGIN_ASSET_UPDATED_AT: Record<LoginAssetSlot, string | null | undefined> = {
    loginBackground: data?.loginBackgroundUpdatedAt,
    loginBranch: data?.loginBranchUpdatedAt,
    loginLeaf: data?.loginLeafUpdatedAt,
  };
  function loginAssetUrl(slot: LoginAssetSlot): string {
    const base = LOGIN_ASSET_BASE_URL[slot];
    const updatedAt = LOGIN_ASSET_UPDATED_AT[slot];
    return updatedAt ? `${base}?v=${encodeURIComponent(updatedAt)}` : base;
  }

  const savedAppName = data?.appName ?? "";
  const editedAppName = appName || savedAppName;

  const saveNameMutation = useMutation({
    mutationFn: (name: string) =>
      api.patch<AppSettingsResponse>("/app-settings", { appName: name }),
    onSuccess: () => {
      toast({ title: "Nom de l'application mis à jour" });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      setAppName("");
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : err;
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const setMapKeyMutation = useMutation({
    mutationFn: (apiKey: string) => api.post("/app-settings/map-key", { apiKey }),
    onSuccess: () => {
      toast({ title: "Clé MapTiler enregistrée" });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      setMapApiKeyInput("");
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : err;
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const setBioValidationRequiredMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch<AppSettingsResponse>("/app-settings/bio-validation-required", { enabled }),
    onSuccess: (res) => {
      toast({
        title: res.data.bioValidationRequired
          ? "Contrôle biométrique exigé pour valider"
          : "Contrôle biométrique contourné temporairement",
      });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : err;
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const deleteMapKeyMutation = useMutation({
    mutationFn: () => api.delete("/app-settings/map-key"),
    onSuccess: () => {
      toast({ title: "Clé MapTiler supprimée" });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : err;
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  async function handleIconChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const ext = ICON_MIME_TO_EXT[file.type];
    if (!ext) {
      toast({
        title: "Format non supporté",
        description: "PNG, JPG, SVG ou WebP uniquement.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > ICON_MAX_BYTES) {
      toast({
        title: "Fichier trop volumineux",
        description: "2 Mo maximum.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Upload direct au backend : pas de presigned URL MinIO (injoignable depuis le navigateur,
      // bloquée par la CSP) — même raison que pour les photos de pointage/workflow.
      const { data } = await api.post<{ iconKey: string }>(
        "/app-settings/icon-upload",
        await file.arrayBuffer(),
        { headers: { "Content-Type": file.type } },
      );
      await api.post("/app-settings/icon", { iconKey: data.iconKey });
      toast({ title: "Icône mise à jour" });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : err;
      toast({ title: "Échec de l'upload", description: String(message), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleLoginAssetChange(
    config: LoginAssetConfig,
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const ext = LOGIN_ASSET_MIME_TO_EXT[file.type];
    if (!ext) {
      toast({
        title: "Format non supporté",
        description: "PNG, JPG ou WebP uniquement.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > LOGIN_ASSET_MAX_BYTES) {
      toast({
        title: "Fichier trop volumineux",
        description: "5 Mo maximum.",
        variant: "destructive",
      });
      return;
    }

    setUploadingSlot(config.slot);
    try {
      const { data } = await api.post<{ key: string }>(
        `/app-settings/${config.urlSegment}/upload`,
        await file.arrayBuffer(),
        { headers: { "Content-Type": file.type } },
      );
      await api.post(`/app-settings/${config.urlSegment}`, { key: data.key });
      toast({ title: `${config.label} mis à jour` });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : err;
      toast({ title: "Échec de l'upload", description: String(message), variant: "destructive" });
    } finally {
      setUploadingSlot(null);
    }
  }

  async function handleDownloadBackup() {
    setDownloadingBackup(true);
    try {
      const res = await api.get("/system/backup", { responseType: "blob" });
      const disposition = res.headers["content-disposition"] as string | undefined;
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "alterra-backup.dump";
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Sauvegarde téléchargée" });
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : err;
      toast({
        title: "Échec de la sauvegarde",
        description: String(message),
        variant: "destructive",
      });
    } finally {
      setDownloadingBackup(false);
    }
  }

  async function handleBackupFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingBackup(true);
    setRestoreConfirmText("");
    try {
      const { data } = await api.post<{ backupKey: string }>(
        "/system/backup-upload",
        await file.arrayBuffer(),
        { headers: { "Content-Type": "application/octet-stream" } },
      );
      setPendingBackupKey(data.backupKey);
      setPendingBackupName(file.name);
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : err;
      toast({ title: "Échec de l'upload", description: String(message), variant: "destructive" });
    } finally {
      setUploadingBackup(false);
    }
  }

  function cancelPendingRestore() {
    setPendingBackupKey(null);
    setPendingBackupName(null);
    setRestoreConfirmText("");
  }

  async function handleRestore() {
    if (!pendingBackupKey) return;
    setRestoring(true);
    try {
      await api.post("/system/restore", { backupKey: pendingBackupKey });
      toast({
        title: "Base restaurée",
        description: "Rechargez la page — les données affichées peuvent avoir changé.",
      });
      cancelPendingRestore();
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : err;
      toast({
        title: "Échec de la restauration",
        description: String(message),
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres de l'application"
        description="Identité, écran de connexion et données portés par l'Admin et la PWA terrain."
      />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="login">Écran de connexion</TabsTrigger>
          <TabsTrigger value="map">Carte</TabsTrigger>
          <TabsTrigger value="database">Base de données</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,32rem)_minmax(0,20rem)]">
            <div className="space-y-6">
              <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6">
                <div className="space-y-2">
                  <Label htmlFor="app-name">Nom de l'application</Label>
                  <div className="flex gap-2">
                    <Input
                      id="app-name"
                      value={editedAppName}
                      disabled={isLoading}
                      onChange={(e) => setAppName(e.target.value)}
                      maxLength={60}
                    />
                    <Button
                      type="button"
                      disabled={
                        saveNameMutation.isPending ||
                        !editedAppName.trim() ||
                        editedAppName === savedAppName
                      }
                      onClick={() => saveNameMutation.mutate(editedAppName.trim())}
                    >
                      {saveNameMutation.isPending ? "Enregistrement…" : "Enregistrer"}
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Affiché dans l'Admin, la PWA terrain, et le titre de l'onglet — jusqu'à 60
                    caractères.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Icône</Label>
                  <div className="flex items-center gap-4">
                    <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-zinc-200 bg-surface p-2">
                      <img src={iconUrl} alt="" className="max-h-full max-w-full object-contain" />
                    </span>
                    <div className="space-y-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={(e) => void handleIconChange(e)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploading ? "Envoi…" : "Changer l'icône"}
                      </Button>
                      <p className="text-xs text-zinc-500">PNG, JPG, SVG ou WebP — 2 Mo maximum.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-6">
                <div className="min-w-0 flex-1">
                  <Label id="bio-validation-label" htmlFor="bio-validation-required">
                    Contrôle biométrique à la validation
                  </Label>
                  <p className="mt-1 text-sm text-zinc-700">
                    Exiger un contrôle biométrique OK avant de valider un pointage.
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    À désactiver temporairement si le contrôle biométrique terrain n'est pas encore
                    opérationnel : la validation ne sera plus bloquée par son absence. À réactiver
                    dès que prêt.
                  </p>
                  <p
                    className={`mt-2 text-xs font-semibold ${
                      (data?.bioValidationRequired ?? true) ? "text-brand" : "text-warning"
                    }`}
                  >
                    {(data?.bioValidationRequired ?? true)
                      ? "Activé : le contrôle est exigé."
                      : "Désactivé : la validation n'est pas bloquée."}
                  </p>
                </div>
                <Switch
                  id="bio-validation-required"
                  aria-labelledby="bio-validation-label"
                  checked={data?.bioValidationRequired ?? true}
                  disabled={isLoading || setBioValidationRequiredMutation.isPending}
                  onCheckedChange={(checked) => setBioValidationRequiredMutation.mutate(checked)}
                />
              </div>
            </div>

            <aside
              aria-label="Aperçu de l'application terrain"
              className="h-max rounded-xl border border-zinc-200 bg-surface p-4"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">
                Aperçu de l'application terrain
              </p>
              <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <img src={iconUrl} alt="" className="h-9 w-auto" />
                  <span className="alterra-display flex-1 truncate text-base font-extrabold">
                    {editedAppName || savedAppName}
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                    CE
                  </span>
                </div>
                <div className="mt-4 rounded-xl border border-dashed border-zinc-300 px-3 py-8 text-center text-xs text-muted">
                  En-tête de l'application, tel qu'affiché sur les téléphones
                </div>
              </div>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="login">
          <div className="max-w-lg space-y-5 rounded-md border border-zinc-200 bg-white p-6">
            <p className="text-xs text-zinc-500">
              Fond et décors affichés sur l'écran de connexion de l'Admin et de la PWA terrain.
            </p>

            {LOGIN_ASSET_CONFIGS.map((config) => (
              <div key={config.slot} className="space-y-2">
                <Label>{config.label}</Label>
                <div className="flex items-center gap-4">
                  <img
                    src={loginAssetUrl(config.slot)}
                    alt=""
                    className={`rounded border border-zinc-200 ${config.previewClassName}`}
                  />
                  <div className="space-y-1">
                    <input
                      ref={loginAssetInputRefs[config.slot]}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => void handleLoginAssetChange(config, e)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingSlot === config.slot}
                      onClick={() => loginAssetInputRefs[config.slot].current?.click()}
                    >
                      {uploadingSlot === config.slot ? "Envoi…" : "Changer"}
                    </Button>
                    <p className="text-xs text-zinc-500">{config.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="map">
          <div className="max-w-lg space-y-5 rounded-md border border-zinc-200 bg-white p-6">
            <p className="text-xs text-zinc-500">
              Clé API MapTiler utilisée pour les fonds de carte de l'Admin (sites, zones,
              parcelles). Sans clé, l'application bascule sur OpenStreetMap.
            </p>

            <div className="space-y-2">
              <Label>Statut</Label>
              <p className="text-sm text-zinc-700">
                {data?.mapTilerKeyConfigured
                  ? "Clé configurée en base de données."
                  : "Aucune clé en base."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="map-api-key">Nouvelle clé MapTiler</Label>
              <div className="flex gap-2">
                <Input
                  id="map-api-key"
                  type="password"
                  autoComplete="off"
                  value={mapApiKeyInput}
                  onChange={(e) => setMapApiKeyInput(e.target.value)}
                  placeholder="Coller la clé MapTiler"
                />
                <Button
                  type="button"
                  disabled={setMapKeyMutation.isPending || !mapApiKeyInput.trim()}
                  onClick={() => setMapKeyMutation.mutate(mapApiKeyInput.trim())}
                >
                  {setMapKeyMutation.isPending ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                La valeur n'est jamais réaffichée une fois enregistrée.
              </p>
            </div>

            {data?.mapTilerKeyConfigured && (
              <div className="border-t border-zinc-200 pt-5">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteMapKeyMutation.isPending}
                  onClick={() => deleteMapKeyMutation.mutate()}
                >
                  {deleteMapKeyMutation.isPending ? "Suppression…" : "Supprimer la clé de la base"}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="database">
          <div className="max-w-lg space-y-5 rounded-md border border-zinc-200 bg-white p-6">
            <div>
              <p className="text-xs text-zinc-500">
                Instantané complet de la base — indépendant des sauvegardes automatiques nocturnes.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Sauvegarde</Label>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={downloadingBackup}
                  onClick={() => void handleDownloadBackup()}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {downloadingBackup ? "Génération…" : "Télécharger une sauvegarde"}
                </Button>
              </div>
            </div>

            <div className="space-y-2 border-t border-zinc-200 pt-5">
              <Label>Restauration</Label>
              {!pendingBackupKey ? (
                <div>
                  <input
                    ref={backupFileInputRef}
                    type="file"
                    accept=".dump"
                    className="hidden"
                    onChange={(e) => void handleBackupFileChange(e)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingBackup}
                    onClick={() => backupFileInputRef.current?.click()}
                  >
                    {uploadingBackup ? "Envoi…" : "Choisir un fichier .dump"}
                  </Button>
                  <p className="mt-1 text-xs text-zinc-500">
                    Remplace intégralement les données actuelles — à utiliser avec précaution.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 rounded-md border border-danger/40 bg-danger-bg p-4">
                  <div className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
                    <div className="space-y-1 text-sm text-danger">
                      <p className="font-semibold">Zone dangereuse</p>
                      <p>
                        Restaurer <span className="font-mono text-xs">{pendingBackupName}</span> va{" "}
                        <strong>remplacer toutes les données actuelles</strong> (sites,
                        travailleurs, pointages, paiements…). Cette action est irréversible.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="restore-confirm" className="text-danger">
                      Tapez {RESTORE_CONFIRM_PHRASE} pour confirmer
                    </Label>
                    <Input
                      id="restore-confirm"
                      value={restoreConfirmText}
                      onChange={(e) => setRestoreConfirmText(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={restoring}
                      onClick={cancelPendingRestore}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={restoring || restoreConfirmText !== RESTORE_CONFIRM_PHRASE}
                      onClick={() => void handleRestore()}
                    >
                      {restoring ? "Restauration…" : "Restaurer maintenant"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
