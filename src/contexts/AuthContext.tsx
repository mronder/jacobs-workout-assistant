import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

/** Lightweight user shape — no Supabase dependency */
export interface AppUser {
  id: string;
  email: string;
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  // Check session on mount via cookie
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data: { user: AppUser | null }) => {
        setState({ user: data.user, loading: false });
      })
      .catch(() => {
        setState({ user: null, loading: false });
      });
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string; user?: AppUser };
      if (!res.ok) return { error: data.error ?? 'Signup failed' };
      setState({ user: data.user ?? null, loading: false });
      return { error: null };
    } catch {
      return { error: 'Network error' };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string; user?: AppUser };
      if (!res.ok) return { error: data.error ?? 'Login failed' };
      setState({ user: data.user ?? null, loading: false });
      return { error: null };
    } catch {
      return { error: 'Network error' };
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    setState({ user: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
