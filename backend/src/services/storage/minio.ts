import { Client } from "minio";

export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT ?? "localhost",
  port: Number(process.env.MINIO_PORT ?? 9000),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY ?? "",
  secretKey: process.env.MINIO_SECRET_KEY ?? "",
});

export const BUCKETS = {
  photos: process.env.MINIO_BUCKET_PHOTOS ?? "photos-pointages",
  reports: process.env.MINIO_BUCKET_REPORTS ?? "rapports-pdf",
} as const;

const PRESIGN_TTL_SECONDS = 15 * 60;

export async function ensureBuckets() {
  for (const bucket of Object.values(BUCKETS)) {
    const exists = await minioClient.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await minioClient.makeBucket(bucket);
    }
  }
}

export function presignedUploadUrl(bucket: string, key: string) {
  return minioClient.presignedPutObject(bucket, key, PRESIGN_TTL_SECONDS);
}

export function presignedDownloadUrl(bucket: string, key: string) {
  return minioClient.presignedGetObject(bucket, key, PRESIGN_TTL_SECONDS);
}
