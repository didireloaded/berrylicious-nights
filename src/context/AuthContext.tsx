import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Profile {
  display_name: string | null;
  phone: string | null;
  total_orders: number;
  total_visits: number;
  last_order: unknown;
  loyalty_points?: number | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEV_ADMIN_EMAILS = new Set(
  (import.meta.env.VITE_DEV_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean),
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const activeUserIdRef = useRef<string | null>(null);
  const inflightUserLoadRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, phone, total_orders, total_visits, last_order")
      .eq("user_id", userId)
      .single();
    if (activeUserIdRef.current === userId) {
      setProfile(data);
    }
  }, []);

  const checkAdmin = useCallback(async (userId: string, email?: string | null) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (activeUserIdRef.current !== userId) return;

    if (data) {
      setIsAdmin(true);
      return;
    }
    if (import.meta.env.DEV && email && DEV_ADMIN_EMAILS.has(email.toLowerCase())) {
      setIsAdmin(true);
      return;
    }
    setIsAdmin(false);
  }, []);

  const loadUserMetadata = useCallback(
    async (nextUser: User) => {
      if (inflightUserLoadRef.current === nextUser.id) return;
      inflightUserLoadRef.current = nextUser.id;
      try {
        await Promise.all([fetchProfile(nextUser.id), checkAdmin(nextUser.id, nextUser.email)]);
      } finally {
        if (inflightUserLoadRef.current === nextUser.id) {
          inflightUserLoadRef.current = null;
        }
      }
    },
    [fetchProfile, checkAdmin],
  );

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const applySessionUser = (nextUser: User | null) => {
      if (!mounted) return;
      const prevId = activeUserIdRef.current;
      const nextId = nextUser?.id ?? null;
      activeUserIdRef.current = nextId;
      setUser(nextUser);

      if (nextUser) {
        if (prevId !== nextId) {
          setTimeout(() => {
            if (mounted && activeUserIdRef.current === nextUser.id) {
              void loadUserMetadata(nextUser);
            }
          }, 0);
        }
      } else {
        inflightUserLoadRef.current = null;
        setProfile(null);
        setIsAdmin(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySessionUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      applySessionUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserMetadata]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      profile,
      loading,
      isAdmin,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [user, profile, loading, isAdmin, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
