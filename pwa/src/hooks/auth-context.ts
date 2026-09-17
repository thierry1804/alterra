import { createContext } from "react";
import type { AuthUser } from "../lib/api";

interface PendingSession {
  accessToken: string;
  user: AuthUser;
}

export interface AuthContextValue {
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

export const AuthContext = createContext<AuthContextValue | null>(null);
