import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "CHEF_SERVICE" | "CHEF_EQUIPE";
  siteId: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  /** "idle" tant que la restauration de session au chargement de l'app n'est pas terminée. */
  status: "idle" | "ready";
  setSession: (accessToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
  setReady: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: "idle",
  setSession: (accessToken, user) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  logout: () => set({ accessToken: null, user: null }),
  setReady: () => set({ status: "ready" }),
}));
