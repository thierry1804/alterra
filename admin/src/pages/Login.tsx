import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Email ou mot de passe incorrect.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">ALTERRA — Connexion</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          type="email"
          placeholder="email@alterra.mg"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2"
          required
        />
        <button type="submit" className="w-full rounded bg-slate-900 py-2 text-white">
          Se connecter
        </button>
      </form>
    </div>
  );
}
