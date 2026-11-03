import { api } from "./api";

/** MinIO n'est pas exposé publiquement : la photo transite par le backend, pas une URL présignée. */
export async function uploadPointagePhoto(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const { data } = await api.post<{ photoKey: string }>("/pointages/photo", arrayBuffer, {
    headers: { "Content-Type": "image/jpeg" },
  });
  return data.photoKey;
}

/** Rattache a posteriori une photo à un pointage déjà synchronisé (envoi initial échoué/retardé). */
export async function attachPointagePhoto(pointageId: string, photoKey: string): Promise<void> {
  await api.patch(`/pointages/${pointageId}/photo`, { photoKey });
}
