import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "../lib/logger.js";
import {
  processWeeklyPdfJob,
  type WeeklyPdfJobResult,
} from "../services/reports/weekly-pdf.service.js";
import type { WeeklyPdfJobInput } from "../services/reports/weekly-data.service.js";
import {
  processDailyPdfJob,
  type DailyPdfJobResult,
} from "../services/reports/daily-pdf.service.js";
import type { DailyPdfJobInput } from "../services/reports/daily-data.service.js";

export const WEEKLY_PDF_QUEUE_NAME = "weekly-pdf";
export const DAILY_PDF_QUEUE_NAME = "daily-pdf";

export type WeeklyPdfJobPayload = WeeklyPdfJobInput;

export interface WeeklyPdfJobStatus {
  id: string;
  state: "waiting" | "active" | "completed" | "failed";
  result?: WeeklyPdfJobResult;
  error?: string;
}

export interface DailyPdfJobStatus {
  id: string;
  state: "waiting" | "active" | "completed" | "failed";
  result?: DailyPdfJobResult;
  error?: string;
}

const syncWeeklyJobStore = new Map<string, WeeklyPdfJobStatus>();
const syncDailyJobStore = new Map<string, DailyPdfJobStatus>();

function useSyncJobs(): boolean {
  return process.env.NODE_ENV === "test" || process.env.REDIS_IN_MEMORY === "true";
}

let queue: Queue<WeeklyPdfJobPayload, WeeklyPdfJobResult> | null = null;
let worker: Worker<WeeklyPdfJobPayload, WeeklyPdfJobResult> | null = null;
let dailyQueue: Queue<DailyPdfJobInput, DailyPdfJobResult> | null = null;
let dailyWorker: Worker<DailyPdfJobInput, DailyPdfJobResult> | null = null;

function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new Redis(url, { maxRetriesPerRequest: null });
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
    syncWeeklyJobStore.set(jobId, { id: jobId, state: "active" });

    void processWeeklyPdfJob(input)
      .then((result) => {
        syncWeeklyJobStore.set(jobId, { id: jobId, state: "completed", result });
      })
      .catch((error: unknown) => {
        syncWeeklyJobStore.set(jobId, {
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
    return syncWeeklyJobStore.get(jobId) ?? null;
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

export function getDailyPdfQueue(): Queue<DailyPdfJobInput, DailyPdfJobResult> | null {
  if (useSyncJobs()) return null;
  if (!dailyQueue) {
    dailyQueue = new Queue<DailyPdfJobInput, DailyPdfJobResult>(DAILY_PDF_QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return dailyQueue;
}

export async function enqueueDailyPdfJob(
  input: DailyPdfJobInput,
): Promise<{ jobId: string }> {
  if (useSyncJobs()) {
    const jobId = `sync-daily-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    syncDailyJobStore.set(jobId, { id: jobId, state: "active" });

    void processDailyPdfJob(input)
      .then((result) => {
        syncDailyJobStore.set(jobId, { id: jobId, state: "completed", result });
      })
      .catch((error: unknown) => {
        syncDailyJobStore.set(jobId, {
          id: jobId,
          state: "failed",
          error: error instanceof Error ? error.message : "Job failed",
        });
      });

    return { jobId };
  }

  const pdfQueue = getDailyPdfQueue();
  if (!pdfQueue) {
    throw new Error("Daily PDF queue unavailable");
  }

  const job = await pdfQueue.add("generate", input);
  return { jobId: job.id! };
}

export async function getDailyPdfJobStatus(jobId: string): Promise<DailyPdfJobStatus | null> {
  if (jobId.startsWith("sync-daily-")) {
    return syncDailyJobStore.get(jobId) ?? null;
  }

  const pdfQueue = getDailyPdfQueue();
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

export function startDailyPdfWorker(): void {
  if (useSyncJobs() || dailyWorker) return;

  dailyWorker = new Worker<DailyPdfJobInput, DailyPdfJobResult>(
    DAILY_PDF_QUEUE_NAME,
    async (job: Job<DailyPdfJobInput>) => processDailyPdfJob(job.data),
    { connection: createRedisConnection(), concurrency: 1 },
  );

  dailyWorker.on("completed", (job) => {
    logger.info({ jobId: job.id, date: job.data.date }, "Daily PDF job completed");
  });

  dailyWorker.on("failed", (job, err) => {
    logger.warn({ jobId: job?.id, err }, "Daily PDF job failed");
  });

  logger.info("Daily PDF worker started");
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

export async function stopDailyPdfWorker(): Promise<void> {
  if (dailyWorker) {
    await dailyWorker.close();
    dailyWorker = null;
  }
  if (dailyQueue) {
    await dailyQueue.close();
    dailyQueue = null;
  }
}

/** Reset sync job store between tests. */
export function resetWeeklyPdfJobsForTests(): void {
  syncWeeklyJobStore.clear();
}

export function resetDailyPdfJobsForTests(): void {
  syncDailyJobStore.clear();
}
