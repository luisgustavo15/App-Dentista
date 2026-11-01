// Auth context: stores token in secure storage, exposes user + login/logout.
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";

import {
  AUTH_TOKEN_KEY,
  api,
  getAuthToken,
  loadStoredToken,
  setAuthToken,
  type User,
} from "@/src/api/client";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  status: "loading" | "authenticated" | "unauthenticated";
  user: User | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

const processedIds = new Set<string>();

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<User | null>(null);
  const captured = useRef<string | null>(null);

  const exchangeSessionId = async (sid: string) => {
    if (processedIds.has(sid)) return;
    processedIds.add(sid);
    try {
      const resp = await api.post<{ session_token: string; user: User }>("/auth/session", {
        session_id: sid,
      });
      setAuthToken(resp.session_token);
      await storage.secureSet(AUTH_TOKEN_KEY, resp.session_token);
      setUser(resp.user);
      setStatus("authenticated");
    } catch (e) {
      console.error("[auth] session exchange failed", e);
      setStatus("unauthenticated");
    }
  };

  const refresh = async () => {
    const t = getAuthToken();
    if (!t) {
      setStatus("unauthenticated");
      return;
    }
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
      setStatus("authenticated");
    } catch (e: any) {
      if (e?.status === 401) {
        await storage.secureRemove(AUTH_TOKEN_KEY);
        setAuthToken(null);
      }
      setUser(null);
      setStatus("unauthenticated");
    }
  };

  // Listen for deep links before any auth session opens.
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) captured.current = sid;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    (async () => {
      // Web: check URL for session_id first (processes it before any token check)
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const sid =
          extractSessionId(window.location.hash) ||
          extractSessionId(window.location.search);
        if (sid) {
          await exchangeSessionId(sid);
          try {
            const url = new URL(window.location.href);
            url.hash = "";
            url.searchParams.delete("session_id");
            window.history.replaceState(window.history.state, "", url.toString());
          } catch {}
          return;
        }
      } else {
        const initial = await Linking.getInitialURL();
        const sid = extractSessionId(initial);
        if (sid) {
          await exchangeSessionId(sid);
          return;
        }
      }

      await loadStoredToken();
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async () => {
    const redirectUrl =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin + "/"
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = authUrl;
      return;
    }

    captured.current = null;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let urlToParse: string | null = null;
    if (result.type === "success" && (result as any).url) {
      urlToParse = (result as any).url;
    }
    let sid = extractSessionId(urlToParse);
    if (!sid && captured.current) sid = extractSessionId(captured.current);
    if (!sid) {
      const init = await Linking.getInitialURL();
      sid = extractSessionId(init);
    }
    if (sid) {
      await exchangeSessionId(sid);
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await storage.secureRemove(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
    setStatus("unauthenticated");
    router.replace("/login");
  };

  const value = useMemo<AuthState>(
    () => ({ status, user, login, logout, refresh }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
