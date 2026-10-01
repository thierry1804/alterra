import { createContext } from "react";
import type { AuthUser } from "../lib/api";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  bootstrapped: boolean;
  login: (email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
