import { api } from "./api";

export type BioResult = "OK" | "KO" | "DOUBT" | "UNAVAILABLE";

export interface BiometricCheckResult {
  id: string;
  workerId: string;
  result: BioResult;
  score: number | null;
  weekIso: string | null;
  performedAt: string;
}

export async function submitBiometricCheck(input: {
  workerId: string;
  photoBase64?: string;
  referenceDate?: string;
}): Promise<BiometricCheckResult> {
  const response = await api.post<BiometricCheckResult>("/biometric/check", input);
  return response.data;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("READ_FAILED"));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("READ_FAILED"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("READ_FAILED"));
    reader.readAsDataURL(blob);
  });
}
