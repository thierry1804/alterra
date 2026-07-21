import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getMemoryUser } from "../lib/session";

function PinInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-center text-lg tracking-[0.4em]"
      />
    </div>
  );
}

export default function UnlockPin() {
  const { needsPinSetup, completePinSetup, unlock, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setupMode = needsPinSetup || searchParams.get("setup") === "1";

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const title = useMemo(
    () => (setupMode ? "Créer un code PIN" : "Déverrouiller"),
    [setupMode],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (pin.length !== 4) {
      setError("Le PIN doit contenir 4 chiffres.");
      return;
    }

    if (setupMode && pin !== confirmPin) {
      setError("Les codes PIN ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      if (setupMode) {
        await completePinSetup(pin);
      } else {
        await unlock(pin);
      }
      const role = getMemoryUser()?.role;
      navigate(role === "CHEF_SERVICE" ? "/validation" : "/");
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "PIN_INCORRECT") {
        setError("Code PIN incorrect.");
      } else if (code === "PIN_INVALID") {
        setError("Le PIN doit contenir 4 chiffres.");
      } else {
        setError("Impossible de déverrouiller la session.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-100 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 bg-white p-6"
      >
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {setupMode
              ? "Ce code protège vos données locales après 30 min d'inactivité."
              : "Saisissez votre PIN pour accéder à l'application."}
          </p>
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <PinInput id="pin" label="Code PIN (4 chiffres)" value={pin} onChange={setPin} />

        {setupMode && (
          <PinInput
            id="confirmPin"
            label="Confirmer le PIN"
            value={confirmPin}
            onChange={setConfirmPin}
          />
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Validation…" : setupMode ? "Enregistrer" : "Déverrouiller"}
        </button>

        {!setupMode && (
          <button
            type="button"
            onClick={() => void logout().then(() => navigate("/login"))}
            className="w-full text-sm text-zinc-600 underline"
          >
            Se déconnecter
          </button>
        )}
      </form>
    </div>
  );
}
