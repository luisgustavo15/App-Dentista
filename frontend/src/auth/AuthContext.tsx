// Auth context: email/password for patients, access password for admin.
// Token lives in secure storage; the root layout gate handles navigation.
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { AUTH_TOKEN_KEY, api, loadStoredToken, setAuthToken, type User } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { storage } from "@/src/utils/storage";

type RegisterInput = { name: string; email: string; password: string; phone?: string };

type AuthState = {
  status: "loading" | "authenticated" | "unauthenticated";
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  adminLogin: (password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

type AuthResponse = { access_token: string; user: User };

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<User | null>(null);

  const clear = async () => {
    await storage.secureRemove(AUTH_TOKEN_KEY);
    setAuthToken(null);
    queryClient.clear();
    setUser(null);
    setStatus("unauthenticated");
  };

  const accept = async (resp: AuthResponse) => {
    setAuthToken(resp.access_token);
    await storage.secureSet(AUTH_TOKEN_KEY, resp.access_token);
    setUser(resp.user);
    setStatus("authenticated");
  };

  useEffect(() => {
    (async () => {
      const token = await loadStoredToken();
      if (!token) {
        setStatus("unauthenticated");
        return;
      }
      try {
        setUser(await api.get<User>("/auth/me"));
        setStatus("authenticated");
      } catch {
        await clear();
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      login: async (email, password) =>
        accept(await api.post<AuthResponse>("/auth/login", { email: email.trim(), password })),
      register: async (input) =>
        accept(await api.post<AuthResponse>("/auth/register", { ...input, email: input.email.trim() })),
      adminLogin: async (password) =>
        accept(await api.post<AuthResponse>("/auth/admin-login", { password })),
      logout: async () => {
        try {
          await api.post("/auth/logout");
        } catch {}
        await clear();
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
