import { useAuthStore } from "../lib/auth-store";
import { api } from "../lib/api";

export function useAuth() {
  const { user, accessToken, setSession, logout } = useAuthStore();

  async function login(email: string, password: string, mfaCode?: string) {
    const payload: { email: string; password: string; mfaCode?: string } = {
      email,
      password,
    };
    if (mfaCode) payload.mfaCode = mfaCode;

    const res = await api.post("/auth/login", payload);
    setSession(res.data.accessToken, res.data.user);
  }

  async function signOut() {
    await api.post("/auth/logout").catch(() => undefined);
    logout();
  }

  return { user, isAuthenticated: !!accessToken, login, signOut };
}
