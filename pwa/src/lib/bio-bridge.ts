import { api } from "./api";

export type BridgeSessionStatus = "PENDING" | "STARTED" | "COMPLETED" | "EXPIRED";

export type BridgeOutcome =
  | "MATCH"
  | "NO_MATCH"
  | "FACE_NOT_DETECTED"
  | "LIVENESS_FAILED"
  | "CANCELLED"
  | "UPDATE_REQUIRED"
  | "LICENSE_PROBLEM"
  | "FAILURE";

export interface BridgeSession {
  id: string;
  reference: string;
  expiresAt: string;
}

export interface BridgeSessionView {
  id: string;
  status: BridgeSessionStatus;
  outcome: BridgeOutcome | null;
  bioResult: "OK" | "KO" | null;
  expiresAt: string;
}

const BRIDGE_PACKAGE = import.meta.env.VITE_BIO_BRIDGE_PACKAGE ?? "app.pontbio";
const BRIDGE_SCHEME = "pontbio";

export function bridgeIntentUrl(
  reference: string,
  packageName: string = BRIDGE_PACKAGE,
  scheme: string = BRIDGE_SCHEME,
): string {
  return `intent://verifier?ref=${encodeURIComponent(reference)}#Intent;scheme=${scheme};package=${packageName};end`;
}

export function isAndroidBrowser(userAgent: string = navigator.userAgent): boolean {
  return /Android/i.test(userAgent);
}

export function isFinalSession(view: Pick<BridgeSessionView, "status">): boolean {
  return view.status === "COMPLETED" || view.status === "EXPIRED";
}

export function bridgeOutcomeMessage(
  outcome: BridgeOutcome | null,
  status: BridgeSessionStatus,
): string {
  if (status === "EXPIRED") return "La vérification a expiré. Relancez-la.";
  switch (outcome) {
    case "MATCH":
      return "Identité confirmée.";
    case "NO_MATCH":
      return "La personne ne correspond pas à la photo de référence.";
    case "FACE_NOT_DETECTED":
      return "Aucun visage détecté. Réessayez face à la caméra.";
    case "LIVENESS_FAILED":
      return "Contrôle de présence refusé. Réessayez sans photo ni écran.";
    case "CANCELLED":
      return "Vérification annulée.";
    case "UPDATE_REQUIRED":
      return "Le moteur biométrique doit être mis à jour.";
    case "LICENSE_PROBLEM":
      return "Licence du moteur invalide ou expirée. Contactez le support.";
    case "FAILURE":
      return "La vérification a échoué. Réessayez.";
    default:
      return "En attente du résultat…";
  }
}

export async function createBridgeSession(
  workerId: string,
  referenceDate?: string,
): Promise<BridgeSession> {
  const response = await api.post<BridgeSession>("/biometric/sessions", {
    workerId,
    referenceDate,
  });
  return response.data;
}

export async function fetchBridgeSession(id: string): Promise<BridgeSessionView> {
  const response = await api.get<BridgeSessionView>(`/biometric/sessions/${id}`);
  return response.data;
}

export interface WaitOptions {
  intervalMs?: number;
  signal?: AbortSignal;
  onUpdate?: (view: BridgeSessionView) => void;
  fetchView?: (id: string) => Promise<BridgeSessionView>;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitForBridgeSession(
  id: string,
  options: WaitOptions = {},
): Promise<BridgeSessionView | null> {
  const fetchView = options.fetchView ?? fetchBridgeSession;
  const sleep = options.sleep ?? defaultSleep;
  const interval = options.intervalMs ?? 2000;

  while (!options.signal?.aborted) {
    try {
      const view = await fetchView(id);
      options.onUpdate?.(view);
      if (isFinalSession(view)) return view;
    } catch {
      if (options.signal?.aborted) return null;
    }
    await sleep(interval);
  }
  return null;
}
