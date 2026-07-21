import { api } from "./api";

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ClarificationStatus = "OPEN" | "ANSWERED" | "CLOSED";
export type RequestTab = "activities" | "workers" | "clarifications";

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
  requestedById: string;
  siteId: string | null;
  status: RequestStatus;
  decisionReason: string | null;
  createdActivityId: string | null;
  createdAt: string;
  decisionAt: string | null;
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
  requestedById: string;
  status: RequestStatus;
  decisionReason: string | null;
  createdWorkerId: string | null;
  createdAt: string;
  decisionAt: string | null;
}

export interface ClarificationRequestRow {
  id: string;
  pointageId: string;
  question: string;
  requestedPhoto: boolean;
  status: ClarificationStatus;
  answerText: string | null;
  answerPhotoKey: string | null;
  requestedById: string;
  createdAt: string;
  answeredAt: string | null;
  resolvedAt: string | null;
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Acceptée",
  REJECTED: "Refusée",
};

export const CLARIFICATION_STATUS_LABELS: Record<ClarificationStatus, string> = {
  OPEN: "Ouverte",
  ANSWERED: "Répondue",
  CLOSED: "Clôturée",
};

export function requestStatusVariant(status: RequestStatus): "default" | "success" | "warning" | "danger" {
  switch (status) {
    case "PENDING":
      return "warning";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
  }
}

export function clarificationStatusVariant(
  status: ClarificationStatus,
): "default" | "success" | "warning" | "danger" {
  switch (status) {
    case "OPEN":
      return "warning";
    case "ANSWERED":
      return "default";
    case "CLOSED":
      return "success";
  }
}

export function sortByOldest<T extends { createdAt: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

async function fetchAllPages<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;

  do {
    const response = await api.get<Paginated<T>>(path, {
      params: { ...params, cursor },
    });
    rows.push(...response.data.data);
    cursor = response.data.hasMore ? (response.data.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return rows;
}

export function fetchActivityRequests(status?: RequestStatus) {
  return fetchAllPages<ActivityRequestRow>("/activity-requests", { status });
}

export function fetchWorkerRequests(status?: RequestStatus) {
  return fetchAllPages<WorkerRequestRow>("/worker-requests", { status });
}

export function fetchClarificationRequests(status?: ClarificationStatus) {
  return fetchAllPages<ClarificationRequestRow>("/clarification-requests", { status });
}

export function decideActivityRequest(
  id: string,
  decision: "APPROVED" | "REJECTED",
  decisionReason?: string,
) {
  return api.patch<ActivityRequestRow>(`/activity-requests/${id}/decision`, {
    decision,
    decisionReason,
  });
}

export function complementActivityRequest(id: string, comment: string) {
  return api.patch<ActivityRequestRow>(`/activity-requests/${id}/complement`, { comment });
}

export function decideWorkerRequest(
  id: string,
  decision: "APPROVED" | "REJECTED",
  decisionReason?: string,
) {
  return api.patch<WorkerRequestRow>(`/worker-requests/${id}/decision`, {
    decision,
    decisionReason,
  });
}

export function complementWorkerRequest(id: string, comment: string) {
  return api.patch<WorkerRequestRow>(`/worker-requests/${id}/complement`, { comment });
}
