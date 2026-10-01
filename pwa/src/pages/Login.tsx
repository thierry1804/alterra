import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/ui/Button";
import LoginAccessPanel from "../components/auth/LoginAccessPanel";
import { ADMIN_APP, DEMO_ACCOUNTS, TERRAIN_APP_ROLES } from "../lib/access-info";
import { useAppSettings } from "../hooks/useAppSettings";
import LoginLandscape from "../components/auth/LoginLandscape";
import LoginLeaves from "../components/auth/LoginLeaves";

export default function Login() {
  const { login } = useAuth();
  const { appName, iconUrl } = useAppSettings();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const nextPath = await login(email, password);
      navigate(nextPath);
    } catch (err) {
      if (isAxiosError(err) && err.response?.data?.code === "MFA_REQUIRED") {
        setError("Ce compte nécessite MFA — utilisez l'administration web.");
      } else {
        setError("Email ou mot de passe incorrect.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative flex min-h-full items-center justify-center overflow-hidden p-4"
      style={{
        background:
          "radial-gradient(circle at 12% 18%, rgba(24,144,96,0.48), transparent 55%)," +
          "radial-gradient(circle at 88% 12%, rgba(228,84,48,0.40), transparent 52%)," +
          "radial-gradient(circle at 80% 85%, rgba(47,97,153,0.42), transparent 58%)," +
          "radial-gradient(circle at 15% 88%, rgba(234,178,92,0.46), transparent 55%)," +
          "#fafafa",
      }}
    >
      <LoginLandscape />
      <LoginLeaves />
      <div className="relative z-10 grid w-full max-w-md gap-4 lg:max-w-2xl lg:grid-cols-2 lg:items-start">
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6"
        >
          <div>
            <img src={iconUrl} alt={appName} className="h-14 w-auto" />
            <h1 className="mt-4 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-brand">
              Terrain · Registre de suivi
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Connexion chef d&apos;équipe / chef de service
            </p>
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-zinc-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-zinc-700">
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 pr-9 text-sm"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-zinc-500 hover:text-zinc-700"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>

        <LoginAccessPanel
          roles={TERRAIN_APP_ROLES}
          otherApp={ADMIN_APP}
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
