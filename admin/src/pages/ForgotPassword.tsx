import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import AuthLayout from "../components/auth/AuthLayout";
import { api } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(isAxiosError(err) ? "Une erreur est survenue, réessayez." : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout subtitle="Mot de passe oublié">
      {sent ? (
        <div className="space-y-4">
          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            Si ce compte existe, un email de réinitialisation vient d&apos;être envoyé à{" "}
            <strong>{email}</strong>. Le lien est valable 1 heure.
          </p>
          <Link to="/login" className="text-sm font-medium text-brand hover:underline">
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <p className="text-sm text-muted">
            Saisissez votre email administrateur : un lien de réinitialisation vous sera envoyé.
          </p>

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

          <Button type="submit" className="w-full" loading={loading}>
            {loading ? "Envoi…" : "Envoyer le lien de réinitialisation"}
          </Button>

          <p className="text-center text-sm">
            <Link to="/login" className="font-medium text-brand hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
