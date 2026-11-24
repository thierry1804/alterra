import { FormEvent, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../../lib/api";
import { useAuthStore, type AuthUser } from "../../lib/auth-store";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface MfaEnrollmentProps {
  /** Jeton à usage restreint reçu au refus de connexion (`MFA_ENROLLMENT_REQUIRED`). */
  enrollmentToken: string;
  onSessionOpen: () => void;
  onBack: () => void;
}

function message(err: unknown): string {
  if (isAxiosError(err)) {
    if (!err.response) return "Le serveur ne répond pas : vérifiez la connexion.";
    const code = err.response.data?.code;
    if (code === "INVALID_MFA_CODE")
      return "Code invalide. Vérifiez l'heure de votre téléphone et réessayez.";
    if (code === "INVALID_ENROLLMENT_TOKEN") return "Session expirée : reconnectez-vous.";
    if (err.response.status === 429) return "Trop de tentatives : patientez quelques minutes.";
    if (typeof err.response.data?.message === "string") return err.response.data.message;
  }
  return "Activation impossible.";
}

/** Activation obligatoire de la double authentification : QR code à scanner, puis code à 6 chiffres. */
export default function MfaEnrollment({
  enrollmentToken,
  onSessionOpen,
  onBack,
}: MfaEnrollmentProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const headers = { Authorization: `Bearer ${enrollmentToken}` };

  useEffect(() => {
    let cancelled = false;
    api
      .post<{ qrCodeDataUrl: string }>("/auth/mfa/enroll/setup", {}, { headers })
      .then((res) => !cancelled && setQrCode(res.data.qrCodeDataUrl))
      .catch((err) => !cancelled && setError(message(err)));
    return () => {
      cancelled = true;
    };
    // Le jeton ne change pas pendant l'activation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentToken]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ accessToken: string; user: AuthUser }>(
        "/auth/mfa/enroll/verify",
        { code },
        { headers },
      );
      useAuthStore.getState().setSession(res.data.accessToken, res.data.user);
      onSessionOpen();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" aria-labelledby="mfa-enroll-title">
      <div className="space-y-1">
        <h2 id="mfa-enroll-title" className="text-base font-semibold text-zinc-900">
          Activer la double authentification
        </h2>
        <p className="text-sm text-muted">
          Votre rôle l&apos;exige. Cela se fait une seule fois, avec une application
          d&apos;authentification (Google Authenticator, Microsoft Authenticator, Authy…).
        </p>
      </div>

      {error && (
        <p
          className="rounded-md border border-red-200 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      <ol className="space-y-4 text-sm text-zinc-700">
        <li className="space-y-2">
          <p className="font-medium">1. Scannez ce code avec l&apos;application</p>
          {qrCode ? (
            <img
              src={qrCode}
              alt="Code QR à scanner avec votre application d'authentification"
              className="h-44 w-44 rounded-md border border-zinc-200"
            />
          ) : (
            !error && <p className="text-muted">Génération du code…</p>
          )}
        </li>
        <li className="space-y-2">
          <label htmlFor="enroll-code" className="font-medium">
            2. Saisissez le code à 6 chiffres affiché
          </label>
          <Input
            id="enroll-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            required
          />
        </li>
      </ol>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={busy}
        disabled={!qrCode || code.length !== 6}
      >
        {busy ? "Activation…" : "Activer et me connecter"}
      </Button>
      <p className="text-center text-sm">
        <button
          type="button"
          onClick={onBack}
          className="alterra-focus font-medium text-brand hover:underline"
        >
          Retour à la connexion
        </button>
      </p>
    </form>
  );
}
