import { useAuthStore } from "../lib/auth-store";
import { api } from "../lib/api";

export function useAuth() {
  const { user, accessToken, setSession, logout } = useAuthStore();

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    setSession(res.data.accessToken, res.data.user);
  }

  async function signOut() {
    await api.post("/auth/logout").catch(() => undefined);
    logout();
  }

  return { user, isAuthenticated: !!accessToken, login, signOut };
}
