import { createContext, useEffect, useMemo, useState } from "react";
import apiClient, {
  AUTH_STORAGE_EVENT,
  clearStoredSession,
  getStoredToken,
  getStoredUser,
  persistSession
} from "../api/client";

export const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getStoredToken());
  const [isLoading, setIsLoading] = useState(false);

  const syncCurrentUser = async () => {
    const { data } = await apiClient.get("/auth/me");
    const nextUser = {
      id: data.user?.id || data.id,
      email: data.user?.email || data.email,
      role: data.user?.role || data.role
    };

    setUser(nextUser);
    persistSession({ token: getStoredToken(), user: nextUser });
    return nextUser;
  };

  useEffect(() => {
    const syncFromStorage = () => {
      setToken(getStoredToken());
      setUser(getStoredUser());
    };

    window.addEventListener(AUTH_STORAGE_EVENT, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener(AUTH_STORAGE_EVENT, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    const ensureCurrentUser = async () => {
      try {
        const nextUser = await syncCurrentUser();
        if (!active) {
          return;
        }

        setUser(nextUser);
      } catch {
        if (!active) {
          return;
        }

        clearStoredSession();
        setToken(null);
        setUser(null);
      }
    };

    ensureCurrentUser();

    return () => {
      active = false;
    };
  }, [token]);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.post("/auth/login", { email, password });

      persistSession({ token: data.token, user: data.user });
      setToken(data.token);
      setUser(data.user);
      await syncCurrentUser();
      return { ok: true, user: data.user };
    } catch (error) {
      return { ok: false, message: error.response?.data?.message || "Login failed" };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload) => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.post("/auth/register", payload);
      if (data.token) {
        persistSession({ token: data.token, user: data.user });
        setToken(data.token);
        setUser(data.user);
        await syncCurrentUser();
        return { ok: true };
      }

      return {
        ok: true,
        requiresEmailVerification: true,
        message: data.message || "Registration successful. Please verify your email."
      };
    } catch (error) {
      return { ok: false, message: error.response?.data?.message || "Registration failed" };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearStoredSession();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, token, isAuthenticated: Boolean(token), isLoading, login, register, logout }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
