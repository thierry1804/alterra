import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type AuthUser } from "../lib/api";
import {
  clearPersistedSession,
  getMemoryUser,
  persistSession,
  restoreSession,
} from "../lib/session";
import { clearBiometricTemplates } from "../services/biometric/TemplateCache";
import { purgeLocalData } from "../db/db";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const restored = await restoreSession();
      if (restored) {
        setUser(getMemoryUser());
        connectSocket();
      }
      setBootstrapped(true);
    }

    void bootstrap();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string; user: AuthUser }>("/auth/login", {
      email,
      password,
    });
    await persistSession(res.data.accessToken, res.data.user);
    setUser(res.data.user);
    connectSocket();
    return "/";
  }, []);

  const logout = useCallback(async () => {
    disconnectSocket();
    await api.post("/auth/logout").catch(() => undefined);
    await clearBiometricTemplates().catch(() => undefined);
    await purgeLocalData().catch(() => undefined);
    await clearPersistedSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      bootstrapped,
      login,
      logout,
    }),
    [user, bootstrapped, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
