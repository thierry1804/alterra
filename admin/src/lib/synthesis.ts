import { api } from "./api";

export interface SynthesisRow {
  weekIso: string;
  siteId: string;
  siteCode: string;
  siteName: string;
  subActivityId: string;
  activityLabel: string;
  categoryLabel: string;
  unit: string;
  people: number;
  quantity: number;
  cost: number;
  pointages: number;
  pendingSite: number;
  toValidate: number;
  validatedTechnical: number;
  rejected: number;
}

export type SynthesisStatusGroup = "TO_VALIDATE" | "PENDING_SITE" | "VALIDATED" | "ALL";

export interface SynthesisResponse {
  weekFrom: string;
  weekTo: string;
  rows: SynthesisRow[];
  hasMore: boolean;
  nextOffset: number | null;
  counts: Record<SynthesisStatusGroup, number>;
  totals: { cost: number; pendingSite: number; toValidate: number; validatedTechnical: number };
  categories: Array<{ id: string; label: string }>;
}

export const synthesisApi = {
  get: (params: {
    weekFrom: string;
    weekTo: string;
    siteId?: string;
    subActivityId?: string;
    categoryId?: string;
    group?: SynthesisStatusGroup;
    offset?: number;
  }) => api.get<SynthesisResponse>("/pointages/synthese", { params }).then((r) => r.data),
  validateTechnical: (body: { weekIso: string; siteId: string; subActivityId: string }) =>
    api.post<{ validated: number }>("/pointages/validate-technical", body).then((r) => r.data),
};
