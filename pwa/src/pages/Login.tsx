import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/ui/Button";
import LoginAccessPanel from "../components/auth/LoginAccessPanel";
import { ADMIN_APP, DEMO_ACCOUNTS, TERRAIN_APP_ROLES } from "../lib/access-info";
import { useAppSettings } from "../hooks/useAppSettings";

export default function Login() {
  const { login } = useAuth();
  const { appName, iconUrl, loginBackgroundUrl, loginBranchUrl, loginLeafUrl } = useAppSettings();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);

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
    <div className="relative flex min-h-full overflow-hidden bg-white">
      <img
        src={loginBranchUrl}
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 z-10 w-40 xl:w-56"
      />
      <img
        src={loginLeafUrl}
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 z-10 w-32 xl:w-48"
      />

      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${loginBackgroundUrl}')` }}
        role="img"
        aria-label="Champ agricole ALTERRA"
      />
      <div className="hidden lg:block lg:w-1/2" />

      <div className="relative flex w-full flex-col justify-center bg-white/85 px-6 py-10 backdrop-blur-sm sm:px-10 lg:w-1/2 lg:px-14">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <img src={iconUrl} alt="ALTERRA" className="h-20 w-auto" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-900">{appName}</h1>
              <p className="mt-1 text-sm text-zinc-600">
                Connexion chef d&apos;équipe / chef de service
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
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

            <div className="text-center text-sm">
              <button
                type="button"
                className="font-medium text-brand hover:underline"
                onClick={() => setShowForgotHelp((v) => !v)}
              >
                Mot de passe oublié ?
              </button>
              {showForgotHelp && (
                <p className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-zinc-600">
                  Contactez votre administrateur ou chef de service : il réinitialise votre mot de
                  passe et vous communique le nouveau.
                </p>
              )}
            </div>
          </form>

          <LoginAccessPanel
            variant="embedded"
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
    </div>
  );
}
