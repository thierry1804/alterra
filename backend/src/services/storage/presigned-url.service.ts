import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { BUCKETS, minioClient, presignedUploadUrl } from "./minio.js";

/** Presigned MinIO PUT URL for a worker KYC photo. */
export async function workerPhotoUploadUrl(workerId: string) {
  const photoKey = `workers/${workerId}/${randomUUID()}.jpg`;
  const uploadUrl = await presignedUploadUrl(BUCKETS.photos, photoKey);
  return { uploadUrl, photoKey, bucket: BUCKETS.photos, expiresInSeconds: 15 * 60 };
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

/** Presigned MinIO PUT URL for workflow attachments (demandes terrain). */
export async function workflowPhotoUploadUrl(prefix: WorkflowPhotoPrefix) {
  const photoKey = `workflows/${prefix}/${randomUUID()}.jpg`;
  const uploadUrl = await presignedUploadUrl(BUCKETS.photos, photoKey);
  return { uploadUrl, photoKey, bucket: BUCKETS.photos, expiresInSeconds: 15 * 60 };
}

/** Presigned MinIO PUT URL for the app's custom icon/logo (bucket dédié, non partagé avec les photos). */
export async function iconUploadUrl(ext: "png" | "jpg" | "svg" | "webp") {
  const iconKey = `app-settings/icon/${randomUUID()}.${ext}`;
  const uploadUrl = await presignedUploadUrl(BUCKETS.assets, iconKey);
  return { uploadUrl, iconKey, bucket: BUCKETS.assets, expiresInSeconds: 15 * 60 };
}

export type LoginAssetSlot = "loginBackground" | "loginBranch" | "loginLeaf";

/** Presigned MinIO PUT URL for the login screen's background/corner images. */
export async function loginAssetUploadUrl(slot: LoginAssetSlot, ext: "png" | "jpg" | "webp") {
  const key = `app-settings/${slot}/${randomUUID()}.${ext}`;
  const uploadUrl = await presignedUploadUrl(BUCKETS.assets, key);
  return { uploadUrl, key, bucket: BUCKETS.assets, expiresInSeconds: 15 * 60 };
}

/** Presigned MinIO PUT URL for a database backup upload (restauration) — objet éphémère, supprimé après usage. */
export async function backupUploadUrl() {
  const backupKey = `backups/${randomUUID()}.dump`;
  const uploadUrl = await presignedUploadUrl(BUCKETS.assets, backupKey);
  return { uploadUrl, backupKey, bucket: BUCKETS.assets, expiresInSeconds: 15 * 60 };
}
