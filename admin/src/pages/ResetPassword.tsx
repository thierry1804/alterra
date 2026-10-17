import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import AuthLayout from "../components/auth/AuthLayout";
import { api } from "../lib/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      navigate("/login", { state: { passwordReset: true } });
    } catch (err) {
      if (isAxiosError(err) && err.response?.data?.code === "INVALID_RESET_TOKEN") {
        setError("Ce lien de réinitialisation est invalide ou a expiré.");
      } else {
        setError("Une erreur est survenue, réessayez.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout subtitle="Réinitialiser le mot de passe">
        <p className="rounded-md border border-red-200 bg-danger-bg px-3 py-2 text-sm text-danger">
          Lien de réinitialisation manquant ou invalide.
        </p>
        <p className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className="font-medium text-brand hover:underline">
            Demander un nouveau lien
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout subtitle="Réinitialiser le mot de passe">
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
          <label htmlFor="password" className="text-sm font-medium text-zinc-700">
            Nouveau mot de passe
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-9"
              minLength={8}
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
          <p className="text-xs text-muted">8 caractères minimum.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-700">
            Confirmer le mot de passe
          </label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        <Button type="submit" className="w-full" loading={loading}>
          {loading ? "Réinitialisation…" : "Réinitialiser le mot de passe"}
        </Button>
      </form>
    </AuthLayout>
  );
}
