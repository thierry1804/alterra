import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Download, TriangleAlert } from "lucide-react";
import { api } from "../lib/api";
import { APP_ICON_URL } from "../hooks/useAppSettings";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "../hooks/use-toast";

interface AppSettingsResponse {
  appName: string;
  iconUpdatedAt: string | null;
}

const ICON_MAX_BYTES = 2 * 1024 * 1024;
const ICON_MIME_TO_EXT: Record<string, "png" | "jpg" | "svg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

const RESTORE_CONFIRM_PHRASE = "RESTAURER";

export default function AppSettingsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [appName, setAppName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [pendingBackupKey, setPendingBackupKey] = useState<string | null>(null);
  const [pendingBackupName, setPendingBackupName] = useState<string | null>(null);
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => api.get<AppSettingsResponse>("/app-settings").then((r) => r.data),
  });

  const iconUrl = data?.iconUpdatedAt
    ? `${APP_ICON_URL}?v=${encodeURIComponent(data.iconUpdatedAt)}`
    : APP_ICON_URL;

  const savedAppName = data?.appName ?? "";
  const editedAppName = appName || savedAppName;

  const saveNameMutation = useMutation({
    mutationFn: (name: string) => api.patch<AppSettingsResponse>("/app-settings", { appName: name }),
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

  async function handleIconChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const ext = ICON_MIME_TO_EXT[file.type];
    if (!ext) {
      toast({ title: "Format non supporté", description: "PNG, JPG, SVG ou WebP uniquement.", variant: "destructive" });
      return;
    }
    if (file.size > ICON_MAX_BYTES) {
      toast({ title: "Fichier trop volumineux", description: "2 Mo maximum.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: presign } = await api.post<{ uploadUrl: string; iconKey: string }>(
        "/app-settings/icon-upload-url",
        { ext },
      );
      await fetch(presign.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await api.post("/app-settings/icon", { iconKey: presign.iconKey });
      toast({ title: "Icône mise à jour" });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : err;
      toast({ title: "Échec de l'upload", description: String(message), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleDownloadBackup() {
    setDownloadingBackup(true);
    try {
      const res = await api.get("/system/backup", { responseType: "blob" });
      const disposition = res.headers["content-disposition"] as string | undefined;
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "alterra-backup.sql.gz";
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
      toast({ title: "Échec de la sauvegarde", description: String(message), variant: "destructive" });
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
      const { data: presign } = await api.post<{ uploadUrl: string; backupKey: string }>(
        "/system/backup-upload-url",
      );
      await fetch(presign.uploadUrl, { method: "PUT", body: file });
      setPendingBackupKey(presign.backupKey);
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
      toast({ title: "Échec de la restauration", description: String(message), variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres de l'application"
        description="Nom et icône portés par l'Admin et la PWA terrain."
      />

      <div className="max-w-lg space-y-6 rounded-md border border-zinc-200 bg-white p-6">
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
              disabled={saveNameMutation.isPending || !editedAppName.trim() || editedAppName === savedAppName}
              onClick={() => saveNameMutation.mutate(editedAppName.trim())}
            >
              {saveNameMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            Affiché dans l'Admin, la PWA terrain, et le titre de l'onglet — jusqu'à 60 caractères.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Icône</Label>
          <div className="flex items-center gap-4">
            <img src={iconUrl} alt="" className="h-16 w-16 rounded border border-zinc-200 object-cover" />
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

      <div className="max-w-lg space-y-5 rounded-md border border-zinc-200 bg-white p-6">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Base de données</h2>
          <p className="mt-1 text-xs text-zinc-500">
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
                accept=".gz"
                className="hidden"
                onChange={(e) => void handleBackupFileChange(e)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploadingBackup}
                onClick={() => backupFileInputRef.current?.click()}
              >
                {uploadingBackup ? "Envoi…" : "Choisir un fichier .sql.gz"}
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
                    <strong>remplacer toutes les données actuelles</strong> (sites, travailleurs,
                    pointages, paiements…). Cette action est irréversible.
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
                <Button type="button" variant="outline" disabled={restoring} onClick={cancelPendingRestore}>
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
    </div>
  );
}
