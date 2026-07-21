import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type AuthUser } from "../lib/api";
import {
  clearPersistedSession,
  configurePinAndPersistSession,
  getMemoryUser,
  hasPersistedSession,
  hasPinConfigured,
  isSessionUnlocked,
  lockSession,
  shouldLockForInactivity,
  touchActivity,
  persistSessionWithMemoryKey,
  unlockSessionWithPin,
} from "../lib/session";

interface PendingSession {
  accessToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  needsPinSetup: boolean;
  bootstrapped: boolean;
  pendingSession: PendingSession | null;
  login: (email: string, password: string) => Promise<"/unlock?setup=1" | "/unlock" | "/">;
  completePinSetup: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<void>;
  lock: () => void;
  logout: () => Promise<void>;
  touch: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(null);

  useEffect(() => {
    async function bootstrap() {
      const pinConfigured = await hasPinConfigured();
      const persisted = await hasPersistedSession();

      if (pinConfigured && persisted) {
        const inactiveLock = await shouldLockForInactivity();
        if (inactiveLock) {
          lockSession();
          setIsLocked(true);
        } else {
          setIsLocked(true);
        }
      } else {
        setIsLocked(false);
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

    const pinConfigured = await hasPinConfigured();
    if (!pinConfigured) {
      setPendingSession({ accessToken: res.data.accessToken, user: res.data.user });
      setNeedsPinSetup(true);
      setUser(null);
      setIsLocked(false);
      return "/unlock?setup=1";
    }

    setPendingSession({ accessToken: res.data.accessToken, user: res.data.user });
    setNeedsPinSetup(false);
    setUser(null);
    setIsLocked(true);
    return "/unlock";
  }, []);

  const completePinSetup = useCallback(
    async (pin: string) => {
      if (!pendingSession) throw new Error("NO_PENDING_SESSION");
      await configurePinAndPersistSession(
        pin,
        pendingSession.accessToken,
        pendingSession.user,
      );
      setUser(pendingSession.user);
      setPendingSession(null);
      setNeedsPinSetup(false);
      setIsLocked(false);
    },
    [pendingSession],
  );

  const unlock = useCallback(async (pin: string) => {
    await unlockSessionWithPin(pin);

    if (pendingSession) {
      await persistSessionWithMemoryKey(
        pendingSession.accessToken,
        pendingSession.user,
      );
      setUser(pendingSession.user);
      setPendingSession(null);
    } else {
      setUser(getMemoryUser());
    }

    setIsLocked(false);
  }, [pendingSession]);

  const lock = useCallback(() => {
    lockSession();
    setUser(null);
    setIsLocked(true);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => undefined);
    await clearPersistedSession();
    setPendingSession(null);
    setNeedsPinSetup(false);
    setUser(null);
    setIsLocked(false);
  }, []);

  const touch = useCallback(() => {
    if (!isSessionUnlocked()) return;
    void touchActivity();
    setUser(getMemoryUser());
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user && !isLocked,
      isLocked,
      needsPinSetup,
      bootstrapped,
      pendingSession,
      login,
      completePinSetup,
      unlock,
      lock,
      logout,
      touch,
    }),
    [
      user,
      isLocked,
      needsPinSetup,
      bootstrapped,
      pendingSession,
      login,
      completePinSetup,
      unlock,
      lock,
      logout,
      touch,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
