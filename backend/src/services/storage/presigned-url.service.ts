import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { BUCKETS, minioClient } from "./minio.js";

/**
 * Upload direct (serveur → MinIO) pour la photo KYC d'un travailleur — même raison que
 * uploadPointagePhoto : une URL présignée pointe vers l'hôte interne de MinIO, injoignable par un
 * navigateur (et bloqué par la CSP connect-src en plus).
 */
export async function uploadWorkerPhotoDirect(
  workerId: string,
  buffer: Buffer,
  contentType = "image/jpeg",
): Promise<string> {
  const photoKey = `workers/${workerId}/${randomUUID()}.jpg`;
  await minioClient.putObject(BUCKETS.photos, photoKey, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return photoKey;
}

/** Flux de lecture (MinIO → backend) d'une photo déjà stockée, pour relai direct au client. */
export async function getPhotoStream(photoKey: string): Promise<Readable> {
  return minioClient.getObject(BUCKETS.photos, photoKey);
}

/** Flux de lecture (MinIO → backend) d'un PDF du bucket rapports (facture, rapport hebdo), pour
 * relai direct au client — même raison que getPhotoStream : MinIO n'est pas exposé publiquement. */
export async function getReportStream(fileKey: string): Promise<Readable> {
  return minioClient.getObject(BUCKETS.reports, fileKey);
}

/**
 * Upload direct (serveur → MinIO) pour la photo d'un pointage. MinIO n'étant pas exposé
 * publiquement (seul le backend y accède), un navigateur ne peut pas écrire via une URL présignée
 * pointant vers son hôte interne — le fichier transite donc par cette route plutôt qu'en PUT direct.
 */
export async function uploadPointagePhoto(buffer: Buffer): Promise<string> {
  const photoKey = `pointages/${randomUUID()}.jpg`;
  await minioClient.putObject(BUCKETS.photos, photoKey, buffer, buffer.length, {
    "Content-Type": "image/jpeg",
  });
  return photoKey;
}

type WorkflowPhotoPrefix = "worker-requests" | "clarifications";

/** Upload direct (serveur → MinIO) pour une pièce jointe de demande terrain (même raison que
 * uploadPointagePhoto — pas de presigned URL, injoignable/bloquée CSP depuis le navigateur). */
export async function uploadWorkflowPhotoDirect(
  prefix: WorkflowPhotoPrefix,
  buffer: Buffer,
): Promise<string> {
  const photoKey = `workflows/${prefix}/${randomUUID()}.jpg`;
  await minioClient.putObject(BUCKETS.photos, photoKey, buffer, buffer.length, {
    "Content-Type": "image/jpeg",
  });
  return photoKey;
}

/** Upload direct (serveur → MinIO) pour l'icône/logo custom de l'app (bucket dédié, non partagé
 * avec les photos) — même raison que les autres uploads directs de ce fichier. */
export async function uploadIconDirect(
  ext: "png" | "jpg" | "svg" | "webp",
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const iconKey = `app-settings/icon/${randomUUID()}.${ext}`;
  await minioClient.putObject(BUCKETS.assets, iconKey, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return iconKey;
}

export type LoginAssetSlot = "loginBackground" | "loginBranch" | "loginLeaf";

/** Upload direct (serveur → MinIO) pour les visuels de l'écran de login. */
export async function uploadLoginAssetDirect(
  slot: LoginAssetSlot,
  ext: "png" | "jpg" | "webp",
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const key = `app-settings/${slot}/${randomUUID()}.${ext}`;
  await minioClient.putObject(BUCKETS.assets, key, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return key;
}

/** Upload direct (serveur → MinIO) d'une sauvegarde base pour restauration — objet éphémère,
 * supprimé après usage côté /system/restore. */
export async function uploadBackupDirect(buffer: Buffer): Promise<string> {
  const backupKey = `backups/${randomUUID()}.dump`;
  await minioClient.putObject(BUCKETS.assets, backupKey, buffer, buffer.length, {
    "Content-Type": "application/octet-stream",
  });
  return backupKey;
}
