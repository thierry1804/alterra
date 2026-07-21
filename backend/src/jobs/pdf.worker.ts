import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { logger } from "../lib/logger.js";
import {
  processWeeklyPdfJob,
  type WeeklyPdfJobResult,
} from "../services/reports/weekly-pdf.service.js";
import type { WeeklyPdfJobInput } from "../services/reports/weekly-data.service.js";

export const WEEKLY_PDF_QUEUE_NAME = "weekly-pdf";

export type WeeklyPdfJobPayload = WeeklyPdfJobInput;

export interface WeeklyPdfJobStatus {
  id: string;
  state: "waiting" | "active" | "completed" | "failed";
  result?: WeeklyPdfJobResult;
  error?: string;
}

const syncJobStore = new Map<string, WeeklyPdfJobStatus>();

function useSyncJobs(): boolean {
  return process.env.NODE_ENV === "test" || process.env.REDIS_IN_MEMORY === "true";
}

let queue: Queue<WeeklyPdfJobPayload, WeeklyPdfJobResult> | null = null;
let worker: Worker<WeeklyPdfJobPayload, WeeklyPdfJobResult> | null = null;

function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export function getWeeklyPdfQueue(): Queue<WeeklyPdfJobPayload, WeeklyPdfJobResult> | null {
  if (useSyncJobs()) return null;
  if (!queue) {
    queue = new Queue<WeeklyPdfJobPayload, WeeklyPdfJobResult>(WEEKLY_PDF_QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return queue;
}

export async function enqueueWeeklyPdfJob(
  input: WeeklyPdfJobInput,
): Promise<{ jobId: string }> {
  if (useSyncJobs()) {
    const jobId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    syncJobStore.set(jobId, { id: jobId, state: "active" });

    void processWeeklyPdfJob(input)
      .then((result) => {
        syncJobStore.set(jobId, { id: jobId, state: "completed", result });
      })
      .catch((error: unknown) => {
        syncJobStore.set(jobId, {
          id: jobId,
          state: "failed",
          error: error instanceof Error ? error.message : "Job failed",
        });
      });

    return { jobId };
  }

  const pdfQueue = getWeeklyPdfQueue();
  if (!pdfQueue) {
    throw new Error("Weekly PDF queue unavailable");
  }

  const job = await pdfQueue.add("generate", input, {
    jobId: undefined,
  });

  return { jobId: job.id! };
}

export async function getWeeklyPdfJobStatus(jobId: string): Promise<WeeklyPdfJobStatus | null> {
  if (jobId.startsWith("sync-")) {
    return syncJobStore.get(jobId) ?? null;
  }

  const pdfQueue = getWeeklyPdfQueue();
  if (!pdfQueue) return null;

  const job = await pdfQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const mappedState =
    state === "completed"
      ? "completed"
      : state === "failed"
        ? "failed"
        : state === "active"
          ? "active"
          : "waiting";

  return {
    id: job.id!,
    state: mappedState,
    result: job.returnvalue ?? undefined,
    error: job.failedReason ?? undefined,
  };
}

export function startWeeklyPdfWorker(): void {
  if (useSyncJobs() || worker) return;

  worker = new Worker<WeeklyPdfJobPayload, WeeklyPdfJobResult>(
    WEEKLY_PDF_QUEUE_NAME,
    async (job: Job<WeeklyPdfJobPayload>) => processWeeklyPdfJob(job.data),
    { connection: createRedisConnection(), concurrency: 1 },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, weekIso: job.data.weekIso }, "Weekly PDF job completed");
  });

  worker.on("failed", (job, err) => {
    logger.warn({ jobId: job?.id, err }, "Weekly PDF job failed");
  });

  logger.info("Weekly PDF worker started");
}

export async function stopWeeklyPdfWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}

/** Reset sync job store between tests. */
export function resetWeeklyPdfJobsForTests(): void {
  syncJobStore.clear();
}
