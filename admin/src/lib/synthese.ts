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

export interface SynthesisResponse {
  weekFrom: string;
  weekTo: string;
  rows: SynthesisRow[];
}

export const syntheseApi = {
  get: (params: { weekFrom: string; weekTo: string; siteId?: string; subActivityId?: string }) =>
    api.get<SynthesisResponse>("/pointages/synthese", { params }).then((r) => r.data),
  validateTechnical: (body: { weekIso: string; siteId: string; subActivityId: string }) =>
    api.post<{ validated: number }>("/pointages/validate-technical", body).then((r) => r.data),
};
