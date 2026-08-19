import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import LoginAccessPanel from "../components/auth/LoginAccessPanel";
import { ADMIN_APP_ROLES, DEMO_ACCOUNTS, TERRAIN_APP } from "../lib/access-info";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password, needsMfa ? mfaCode : undefined);
      navigate("/");
    } catch (err) {
      if (isAxiosError(err) && err.response?.data?.code === "MFA_REQUIRED") {
        setNeedsMfa(true);
        setError("Saisissez le code MFA à 6 chiffres.");
      } else if (isAxiosError(err) && err.response?.data?.code === "INVALID_MFA_CODE") {
        setNeedsMfa(true);
        setError("Code MFA invalide.");
      } else {
        setError("Email ou mot de passe incorrect.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
      <div className="grid w-full max-w-md gap-4 lg:max-w-2xl lg:grid-cols-2 lg:items-start">
        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm"
        >
        <div className="alterra-rule pb-3">
          <span className="flex items-center gap-2.5">
            <img src="/brand/alterra-logo.png" alt="" className="h-8 w-8 rounded" aria-hidden />
            <span className="text-lg font-semibold tracking-tight text-zinc-900">ALTERRA</span>
          </span>
          <p className="mt-2 text-sm text-muted">Connexion administration</p>
        </div>

        {error && (
          <p
            className="rounded-md border border-red-200 bg-danger-bg px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="email@alterra.mg"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-zinc-700">
            Mot de passe
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {needsMfa && (
          <div className="space-y-2">
            <label htmlFor="mfaCode" className="text-sm font-medium text-zinc-700">
              Code MFA
            </label>
            <Input
              id="mfaCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              required
            />
          </div>
        )}

        <Button type="submit" className="w-full" loading={loading}>
          {loading ? "Connexion…" : "Se connecter"}
        </Button>
        </form>

        <LoginAccessPanel
          roles={ADMIN_APP_ROLES}
          otherApp={TERRAIN_APP}
          demoAccounts={DEMO_ACCOUNTS}
          onSelectDemo={(demoEmail, demoPassword) => {
            setEmail(demoEmail);
            setPassword(demoPassword);
            setError(null);
          }}
        />
      </div>
    </div>
  );
}
