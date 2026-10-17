import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import LoginAccessPanel from "../components/auth/LoginAccessPanel";
import { ADMIN_APP_ROLES, DEMO_ACCOUNTS, TERRAIN_APP } from "../lib/access-info";
import { useAppSettings } from "../hooks/useAppSettings";

export default function Login() {
  const { login } = useAuth();
  const { appName, iconUrl, loginBackgroundUrl } = useAppSettings();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="flex min-h-screen bg-white">
      <div
        className="hidden bg-cover bg-center lg:block lg:w-1/2"
        style={{ backgroundImage: `url('${loginBackgroundUrl}')` }}
        role="img"
        aria-label="Champ agricole ALTERRA"
      />

      <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-10 lg:w-1/2 lg:px-14">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <img src={iconUrl} alt="ALTERRA" className="h-14 w-auto" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-900">{appName}</h1>
              <p className="mt-1 text-sm text-muted">Connexion administration</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9"
                  required
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
            variant="embedded"
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
    </div>
  );
}
