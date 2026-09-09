import { randomUUID } from "node:crypto";
import { BUCKETS, presignedUploadUrl } from "./minio.js";

/** Presigned MinIO PUT URL for a worker KYC photo. */
export async function workerPhotoUploadUrl(workerId: string) {
  const photoKey = `workers/${workerId}/${randomUUID()}.jpg`;
  const uploadUrl = await presignedUploadUrl(BUCKETS.photos, photoKey);
  return { uploadUrl, photoKey, bucket: BUCKETS.photos, expiresInSeconds: 15 * 60 };
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
