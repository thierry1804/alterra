import { isAxiosError } from "axios";
import { api } from "./api";

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ClarificationStatus = "OPEN" | "ANSWERED" | "CLOSED";

export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ActivityRequestRow {
  id: string;
  proposedLabel: string;
  proposedUnit: string;
  proposedRate: string;
  justification: string;
  status: RequestStatus;
  decisionReason: string | null;
  createdActivityId: string | null;
  createdAt: string;
}

export interface WorkerRequestRow {
  id: string;
  firstName: string;
  lastName: string;
  mvolaNumber: string;
  cinNumber: string | null;
  proposedPhotoKey: string | null;
  targetTeamId: string | null;
  justification: string;
  status: RequestStatus;
  decisionReason: string | null;
  createdWorkerId: string | null;
  createdAt: string;
}

export interface ClarificationRequestRow {
  id: string;
  pointageId: string;
  question: string;
  requestedPhoto: boolean;
  status: ClarificationStatus;
  answerText: string | null;
  answerPhotoKey: string | null;
  createdAt: string;
  answeredAt: string | null;
  resolvedAt: string | null;
}

export interface PhotoUploadTarget {
  uploadUrl: string;
  photoKey: string;
}

export function workflowErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const message = err.response?.data?.message as string | undefined;
    const code = err.response?.data?.code as string | undefined;
    if (message) return message;
    if (code === "PHOTO_REQUIRED") return "Une photo est requise pour cette demande.";
    if (code === "FORBIDDEN") return "Action non autorisée.";
  }
  return fallback;
}

export function requestStatusLabel(status: RequestStatus): string {
  switch (status) {
    case "PENDING":
      return "En attente";
    case "APPROVED":
      return "Acceptée";
    case "REJECTED":
      return "Refusée";
  }
}

export function clarificationStatusLabel(status: ClarificationStatus): string {
  switch (status) {
    case "OPEN":
      return "Ouverte";
    case "ANSWERED":
      return "Répondue";
    case "CLOSED":
      return "Clôturée";
  }
}

export function requestStatusClass(status: RequestStatus): string {
  switch (status) {
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-800";
  }
}

export function clarificationStatusClass(status: ClarificationStatus): string {
  switch (status) {
    case "OPEN":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "ANSWERED":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "CLOSED":
      return "border-zinc-200 bg-zinc-100 text-zinc-700";
  }
}

export async function uploadWorkflowPhoto(
  blob: Blob,
  endpoint: "/worker-requests/photo-upload-url" | "/clarification-requests/photo-upload-url",
): Promise<string> {
  const { data } = await api.post<PhotoUploadTarget>(endpoint);
  const response = await fetch(data.uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": "image/jpeg" },
  });
  if (!response.ok) {
    throw new Error("Échec envoi photo");
  }
  return data.photoKey;
}

export async function fetchAllActivityRequests(status?: RequestStatus): Promise<ActivityRequestRow[]> {
  const rows: ActivityRequestRow[] = [];
  let cursor: string | undefined;

  do {
    const response = await api.get<Paginated<ActivityRequestRow>>("/activity-requests", {
      params: { status, cursor },
    });
    rows.push(...response.data.data);
    cursor = response.data.hasMore ? (response.data.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return rows;
}

export async function fetchAllWorkerRequests(status?: RequestStatus): Promise<WorkerRequestRow[]> {
  const rows: WorkerRequestRow[] = [];
  let cursor: string | undefined;

  do {
    const response = await api.get<Paginated<WorkerRequestRow>>("/worker-requests", {
      params: { status, cursor },
    });
    rows.push(...response.data.data);
    cursor = response.data.hasMore ? (response.data.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return rows;
}

export async function fetchAllClarificationRequests(
  status?: ClarificationStatus,
): Promise<ClarificationRequestRow[]> {
  const rows: ClarificationRequestRow[] = [];
  let cursor: string | undefined;

  do {
    const response = await api.get<Paginated<ClarificationRequestRow>>("/clarification-requests", {
      params: { status, cursor },
    });
    rows.push(...response.data.data);
    cursor = response.data.hasMore ? (response.data.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return rows;
}
