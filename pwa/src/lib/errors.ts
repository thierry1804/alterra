import { isAxiosError } from "axios";

const API_MESSAGES: Record<string, string> = {
  BIO_NOT_OK: "Lancez le contrôle biométrique avant de valider ce pointage.",
  CONFIRM_REQUIRED: "Confirmez la clôture malgré les pointages non finalisés.",
  PIN_INCORRECT: "Code PIN incorrect.",
  PIN_INVALID: "Le PIN doit contenir 4 chiffres.",
  MFA_REQUIRED: "Ce compte nécessite MFA — utilisez l'administration web.",
  INVALID_MFA_CODE: "Code MFA invalide.",
};

export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const code = err.response?.data?.code as string | undefined;
    const message = err.response?.data?.message as string | undefined;
    if (code && API_MESSAGES[code]) return API_MESSAGES[code];
    if (message) return String(message);
  }
  if (err instanceof Error && API_MESSAGES[err.message]) {
    return API_MESSAGES[err.message];
  }
  return fallback;
}

export function workflowErrorMessage(err: unknown, fallback: string): string {
  return apiErrorMessage(err, fallback);
}
