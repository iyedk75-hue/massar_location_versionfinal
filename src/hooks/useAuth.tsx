import { createContext, useContext, useEffect, useState } from "react";
import { getAuthState, loginUser, logoutUser, registerUser } from "@/services/auth.service";
import type { AuthState, LoginDto, RegisterUserDto } from "@/types/auth";

type AuthContextValue = AuthState & {
  loading: boolean;
  login: (data: LoginDto) => Promise<AuthState>;
  logout: () => Promise<AuthState>;
  refresh: () => Promise<AuthState>;
  register: (data: RegisterUserDto) => Promise<AuthState>;
};

const defaultAuthState: AuthState = {
  authenticated: false,
  requiresSetup: false,
  user: null,
};

const AuthContext = createContext<AuthContextValue>({
  ...defaultAuthState,
  loading: true,
  login: async () => defaultAuthState,
  logout: async () => defaultAuthState,
  refresh: async () => defaultAuthState,
  register: async () => defaultAuthState,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(defaultAuthState);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const next = await getAuthState();
    setAuthState(next);
    return next;
  }

  useEffect(() => {
    void refresh()
      .catch(() => setAuthState(defaultAuthState))
      .finally(() => setLoading(false));
  }, []);

  async function login(data: LoginDto) {
    const next = await loginUser(data);
    setAuthState(next);
    return next;
  }

  async function register(data: RegisterUserDto) {
    const next = await registerUser(data);
    setAuthState(next);
    return next;
  }

  async function logout() {
    const next = await logoutUser();
    setAuthState(next);
    return next;
  }

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        loading,
        login,
        logout,
        refresh,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
